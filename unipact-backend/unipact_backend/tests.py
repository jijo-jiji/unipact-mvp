import os
import subprocess
import sys
from pathlib import Path

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User, CompanyProfile, StudentProfile
from campaigns.models import Campaign

BACKEND_DIR = Path(__file__).resolve().parent.parent


def rates(**overrides):
    from django.conf import settings
    config = {**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {**settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], **overrides}}
    return override_settings(REST_FRAMEWORK=config)


class RateLimitTests(APITestCase):
    def setUp(self):
        cache.clear()
        User.objects.create_user(username='a@corp.com', email='a@corp.com', password='CorrectHorse42!', role=User.Role.COMPANY)

    def tearDown(self):
        cache.clear()

    def test_login_is_rate_limited_per_ip(self):
        with rates(login='3/min'):
            for _ in range(3):
                res = self.client.post(reverse('login'), {'email': 'a@corp.com', 'password': 'wrong'}, format='json')
                self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
            blocked = self.client.post(reverse('login'), {'email': 'a@corp.com', 'password': 'CorrectHorse42!'}, format='json')
            self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_registration_is_rate_limited(self):
        with rates(register='2/hour'):
            for i in range(2):
                self.client.post(reverse('register_company'), {'email': f'r{i}@corp.com', 'password': 'CorrectHorse42!', 'company_name': 'R'}, format='json')
                self.client.cookies.clear()
            res = self.client.post(reverse('register_company'), {'email': 'r9@corp.com', 'password': 'CorrectHorse42!', 'company_name': 'R'}, format='json')
            self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class PasswordPolicyTests(APITestCase):
    def test_weak_passwords_rejected_on_every_signup(self):
        cases = [
            ('register_company', {'email': 'w@corp.com', 'company_name': 'W'}),
            ('register_club', {'email': 'w@club.my', 'club_name': 'W', 'university': 'UM'}),
            ('register_student', {'email': 'w@siswa.my', 'full_name': 'W', 'university': 'UM'}),
        ]
        for url_name, payload in cases:
            for weak in ('1', '12345678', 'password123'):
                res = self.client.post(reverse(url_name), {**payload, 'password': weak}, format='json')
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, f'{url_name} accepted "{weak}"')
                self.assertIn('password', res.data)
        self.assertFalse(User.objects.filter(email__startswith='w@').exists())

    def test_strong_password_accepted(self):
        res = self.client.post(reverse('register_company'), {'email': 's@corp.com', 'password': 'Blue-Kettle-Run-88', 'company_name': 'S'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)


class UploadValidationTests(APITestCase):
    def setUp(self):
        self.company_user = User.objects.create_user(username='u@corp.com', email='u@corp.com', password='CorrectHorse42!', role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='U', verification_status='VERIFIED')
        self.campaign = Campaign.objects.create(company=self.company, title='T', description='d', type='DIGITAL_MARKETING', budget=500, status='OPEN')
        self.client.force_authenticate(self.company_user)
        self.url = reverse('client_assets', kwargs={'campaign_id': self.campaign.id})

    def upload(self, name, content=b'data', content_type='application/octet-stream'):
        return self.client.post(self.url, {'file': SimpleUploadedFile(name, content, content_type=content_type)}, format='multipart')

    def test_allowed_project_file(self):
        self.assertEqual(self.upload('brief.pdf', b'%PDF-1.4').status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.upload('footage.mp4', b'\x00\x00\x00 ftypmp42').status_code, status.HTTP_201_CREATED)

    def test_dangerous_files_rejected(self):
        for name, content in [('setup.exe', b'MZ\x90'), ('invoice.pdf.exe', b'MZ'), ('logo.svg', b'<svg onload=alert(1)>'),
                              ('page.html', b'<html>'), ('fake.pdf', b'<!DOCTYPE html><script>')]:
            res = self.upload(name, content)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, name)
            self.assertIn('not allowed', res.data['error'])

    @override_settings(MAX_PROJECT_FILE_UPLOAD_MB=1)
    def test_oversized_file_rejected(self):
        res = self.upload('big.zip', b'PK' + b'0' * (1024 * 1024 + 10))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('at most 1 MB', res.data['error'])

    def test_student_id_document_must_be_document_type(self):
        self.client.force_authenticate(None)
        res = self.client.post(reverse('register_student'), {
            'email': 'doc@siswa.my', 'password': 'Blue-Kettle-Run-88', 'full_name': 'D', 'university': 'UM',
            'verification_doc': SimpleUploadedFile('id.zip', b'PK\x03\x04'),
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(StudentProfile.objects.filter(user__email='doc@siswa.my').exists())


class CookieAndHealthTests(APITestCase):
    def test_health_endpoint(self):
        res = self.client.get('/api/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'ok')

    @override_settings(AUTH_COOKIE_SECURE=True, AUTH_COOKIE_SAMESITE='Lax', AUTH_COOKIE_DOMAIN='.unipact.my')
    def test_auth_cookies_follow_settings(self):
        User.objects.create_user(username='c@corp.com', email='c@corp.com', password='CorrectHorse42!', role=User.Role.COMPANY)
        res = self.client.post(reverse('login'), {'email': 'c@corp.com', 'password': 'CorrectHorse42!'}, format='json')
        cookie = res.cookies['access_token']
        self.assertTrue(cookie['secure'])
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Lax')
        self.assertEqual(cookie['domain'], '.unipact.my')


class ProductionSettingsTests(TestCase):
    """Boot Django in a subprocess with production settings to prove the safeguards work."""

    def run_check(self, extra_env, *args):
        env = {k: v for k, v in os.environ.items() if not k.startswith(('DJANGO_', 'DATABASE_', 'USE_S3', 'AWS_', 'CORS_', 'CSRF_'))}
        env.update({'DJANGO_ENV': 'production', **extra_env})
        return subprocess.run([sys.executable, 'manage.py', 'check', *args], cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=120)

    def test_production_refuses_to_start_without_secrets(self):
        result = self.run_check({})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DJANGO_SECRET_KEY', result.stderr)

    def test_production_configuration_passes_deploy_checks(self):
        result = self.run_check({
            'DJANGO_SECRET_KEY': 'x' * 30 + 'Q7f!kP2@zL9#mW4$vB8^nR3&cT6*hY1(',
            'DJANGO_ALLOWED_HOSTS': 'api.unipact.my',
            'DATABASE_URL': 'postgres://u:p@localhost:5432/unipact',
            'CORS_ALLOWED_ORIGINS': 'https://unipact.my',
            'USE_S3': 'true', 'AWS_ACCESS_KEY_ID': 'k', 'AWS_SECRET_ACCESS_KEY': 's', 'AWS_STORAGE_BUCKET_NAME': 'b',
            'DJANGO_ADMIN_URL': 'ops-secret/',
        }, '--deploy', '--fail-level', 'WARNING')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
