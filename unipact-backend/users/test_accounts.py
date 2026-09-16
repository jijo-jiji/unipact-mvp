import re
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign
from users.models import User, CompanyProfile, StudentProfile

STRONG = 'Blue-Kettle-Run-88'


def make_student(email='sam@siswa.my', **profile):
    user = User.objects.create_user(username=email, email=email, password=STRONG, role=User.Role.STUDENT)
    StudentProfile.objects.create(user=user, full_name=profile.pop('full_name', 'Sam Lee'), university='UM', **profile)
    return user


def make_company(email='boss@corp.com', tier='PRO'):
    user = User.objects.create_user(username=email, email=email, password=STRONG, role=User.Role.COMPANY)
    CompanyProfile.objects.create(user=user, company_name='Corp Sdn Bhd', tier=tier, verification_status='VERIFIED')
    return user


def reset_link_from(message):
    url = re.search(r'https?://\S+/reset-password\?\S+', message.body).group(0)
    params = parse_qs(urlparse(url).query)
    return params['uid'][0], params['token'][0]


class PasswordResetTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_student()

    def request_reset(self, email):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('password_reset_request'), {'email': email}, format='json')

    def test_full_reset_flow(self):
        res = self.request_reset('SAM@siswa.my')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['sam@siswa.my'])
        self.assertIn('Reset your password', mail.outbox[0].subject)
        self.assertTrue(mail.outbox[0].alternatives, 'HTML version missing')

        uid, token = reset_link_from(mail.outbox[0])
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('password_reset_confirm'), {'uid': uid, 'token': token, 'password': 'New-Harbour-Lights-7'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('New-Harbour-Lights-7'))
        self.assertIn('password was changed', mail.outbox[-1].subject)

        # The link only works once
        again = self.client.post(reverse('password_reset_confirm'), {'uid': uid, 'token': token, 'password': 'Another-Pass-Word-9'}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_email_gets_same_answer_and_no_email(self):
        known = self.request_reset('sam@siswa.my')
        unknown = self.request_reset('nobody@siswa.my')
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_blocked_user_gets_no_email(self):
        self.user.is_active = False
        self.user.save()
        self.request_reset('sam@siswa.my')
        self.assertEqual(len(mail.outbox), 0)

    def test_bad_token_and_weak_password_rejected(self):
        self.request_reset('sam@siswa.my')
        uid, token = reset_link_from(mail.outbox[0])
        bad = self.client.post(reverse('password_reset_confirm'), {'uid': uid, 'token': 'nope', 'password': STRONG + 'x'}, format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        weak = self.client.post(reverse('password_reset_confirm'), {'uid': uid, 'token': token, 'password': '12345678'}, format='json')
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', weak.data)


class PasswordChangeTests(APITestCase):
    def setUp(self):
        self.user = make_student()
        self.client.force_authenticate(self.user)

    def test_change_requires_current_password(self):
        res = self.client.post(reverse('password_change'), {'current_password': 'wrong', 'new_password': 'New-Harbour-Lights-7'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', res.data)

    def test_change_password_success(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('password_change'), {'current_password': STRONG, 'new_password': 'New-Harbour-Lights-7'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('New-Harbour-Lights-7'))
        self.assertIn('access_token', res.cookies)
        self.assertEqual(len(mail.outbox), 1)

    def test_weak_new_password_rejected(self):
        res = self.client.post(reverse('password_change'), {'current_password': STRONG, 'new_password': 'password'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', res.data)


class AccountSettingsTests(APITestCase):
    def test_student_updates_profile_but_not_protected_fields(self):
        user = make_student(verification_status='VERIFIED')
        self.client.force_authenticate(user)
        res = self.client.patch(reverse('account_settings'), {
            'full_name': 'Samantha Lee', 'skills': ['React', 'react', ' Django '], 'bio': 'Builder',
            'verification_status': 'REJECTED', 'rating': '1.00', 'email': 'hacker@x.com',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        profile = StudentProfile.objects.get(user=user)
        self.assertEqual(profile.full_name, 'Samantha Lee')
        self.assertEqual(profile.skills, ['React', 'Django'])
        self.assertEqual(profile.verification_status, 'VERIFIED')
        self.assertEqual(float(profile.rating), 5.0)
        user.refresh_from_db()
        self.assertEqual(user.email, 'sam@siswa.my')
        self.assertEqual(res.data['student_profile']['full_name'], 'Samantha Lee')

    def test_rejected_student_resubmits_document_back_to_review(self):
        user = make_student(verification_status='REJECTED')
        self.client.force_authenticate(user)
        res = self.client.patch(reverse('account_settings'), {'verification_document': SimpleUploadedFile('id.pdf', b'%PDF-1.4 id')}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(StudentProfile.objects.get(user=user).verification_status, 'PENDING_VERIFICATION')

    def test_company_updates_details_and_bad_document_rejected(self):
        user = make_company()
        self.client.force_authenticate(user)
        ok = self.client.patch(reverse('account_settings'), {'company_name': 'Corp Holdings'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(CompanyProfile.objects.get(user=user).company_name, 'Corp Holdings')
        bad = self.client.patch(reverse('account_settings'), {'ssm_document': SimpleUploadedFile('ssm.exe', b'MZ')}, format='multipart')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_blank_name_rejected(self):
        user = make_company()
        self.client.force_authenticate(user)
        res = self.client.patch(reverse('account_settings'), {'company_name': ''}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_sign_in(self):
        self.assertIn(self.client.patch(reverse('account_settings'), {}, format='json').status_code, (401, 403))


class TermsConsentTests(APITestCase):
    def test_signup_requires_consent_and_records_it(self):
        base = {'email': 'c@siswa.my', 'password': STRONG, 'full_name': 'C', 'university': 'UM'}
        refused = self.client.post(reverse('register_student'), base, format='json')
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('accept_terms', refused.data)
        self.assertFalse(User.objects.filter(email='c@siswa.my').exists())

        ok = self.client.post(reverse('register_student'), {**base, 'accept_terms': 'true'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(User.objects.get(email='c@siswa.my').terms_accepted_at)

    def test_company_signup_requires_consent(self):
        res = self.client.post(reverse('register_company'), {'email': 'x@corp.com', 'password': STRONG, 'company_name': 'X', 'accept_terms': False}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('accept_terms', res.data)


class NotificationEmailTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password=STRONG, role=User.Role.ADMIN)
        self.company_user = make_company(tier='PRO')
        self.student_user = make_student(verification_status='VERIFIED')
        self.campaign = Campaign.objects.create(company=self.company_user.company_profile, title='Portal', description='d',
                                                type='SOFTWARE_DEVELOPMENT', budget=1000, status='OPEN')

    def subjects(self):
        return [m.subject for m in mail.outbox]

    def test_registration_sends_welcome(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('register_student'), {'accept_terms': True, 'email': 'new@siswa.my', 'password': STRONG, 'full_name': 'New', 'university': 'UM'}, format='json')
        self.assertEqual(mail.outbox[0].to, ['new@siswa.my'])
        self.assertIn('Welcome', mail.outbox[0].subject)

    def test_verification_email(self):
        pending = make_student('pending@siswa.my')
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('admin_verify', kwargs={'entity_type': 'STUDENT', 'entity_id': pending.student_profile.id}), {'action': 'approve'}, format='json')
        self.assertEqual(mail.outbox[0].to, ['pending@siswa.my'])
        self.assertIn('verified', mail.outbox[0].subject)

    def test_project_lifecycle_emails(self):
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('admin_matchmaking_assign', kwargs={'campaign_id': self.campaign.id}),
                             {'student_ids': [self.student_user.student_profile.id], 'match_notes': 'Great fit'}, format='json')
        # The offer goes to the student first; the company hears once the student accepts
        self.assertEqual([m.to for m in mail.outbox], [['sam@siswa.my']])
        self.assertIn('Project offer', mail.outbox[0].subject)

        mail.outbox.clear()
        self.client.force_authenticate(self.student_user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('respond_match_offer', kwargs={'campaign_id': self.campaign.id}), {'action': 'accept'}, format='json')
        self.assertEqual([m.to for m in mail.outbox], [['boss@corp.com']])
        self.assertIn('is ready', mail.outbox[0].subject)

        mail.outbox.clear()
        self.client.force_authenticate(self.company_user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')
        self.assertTrue(any('has started' in s for s in self.subjects()))

        mail.outbox.clear()
        self.client.force_authenticate(self.student_user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('project_team_invite', kwargs={'campaign_id': self.campaign.id}),
                             {'email': 'friend@siswa.my', 'role_in_project': 'Designer', 'payout_share_percentage': 20}, format='json')
            self.client.post(reverse('student_submit_deliverable', kwargs={'campaign_id': self.campaign.id}),
                             {'title': 'MVP', 'external_url': 'https://github.com/x/y'}, format='json')
        invite = next(m for m in mail.outbox if m.to == ['friend@siswa.my'])
        self.assertIn('/register/student', invite.body)  # not registered yet, so they're asked to sign up
        self.assertTrue(any(m.to == ['boss@corp.com'] and 'New work' in m.subject for m in mail.outbox))

        mail.outbox.clear()
        self.client.force_authenticate(self.company_user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('campaign_complete', kwargs={'campaign_id': self.campaign.id}), {'rating': 5}, format='json')
        done = next(m for m in mail.outbox if m.to == ['sam@siswa.my'])
        self.assertIn('complete', done.subject)
        self.assertIn('5 out of 5', done.body)

    def test_user_content_is_escaped_in_html(self):
        self.campaign.title = '<script>alert(1)</script>'
        self.campaign.save()
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('admin_matchmaking_assign', kwargs={'campaign_id': self.campaign.id}),
                             {'student_ids': [self.student_user.student_profile.id]}, format='json')
        html = mail.outbox[0].alternatives[0][0]
        self.assertNotIn('<script>alert(1)</script>', html)
        self.assertIn('&lt;script&gt;', html)

    def test_email_failure_does_not_break_request(self):
        from unittest import mock
        self.client.force_authenticate(self.admin)
        with mock.patch('django.core.mail.EmailMultiAlternatives.send', side_effect=OSError('smtp down')), \
                self.assertLogs('unipact.email', level='ERROR'), \
                self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('admin_matchmaking_assign', kwargs={'campaign_id': self.campaign.id}),
                                   {'student_ids': [self.student_user.student_profile.id]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
