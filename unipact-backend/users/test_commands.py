import csv
import json
import os
import tempfile
from io import StringIO
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from users.models import User
from unipact_backend.demo_data import refuse_in_production



class CreateAdminCommandTests(TestCase):
    def run_command(self, password, *args):
        out = StringIO()
        with mock.patch.dict('os.environ', {'ADMIN_PASSWORD': password}):
            call_command('create_admin', *args, stdout=out)
        return out.getvalue()

    def test_creates_admin_with_strong_password(self):
        output = self.run_command('Correct-Horse-Battery-42', '--email', 'Ops@UniPact.my', '--name', 'Nur Aisyah')
        admin = User.objects.get(email='ops@unipact.my')
        self.assertEqual(admin.role, User.Role.ADMIN)
        self.assertTrue(admin.is_superuser and admin.is_staff and admin.is_verified)
        self.assertTrue(admin.check_password('Correct-Horse-Battery-42'))
        self.assertIn('Admin account created', output)

    def test_rejects_weak_or_short_passwords(self):
        for weak in ('password123', 'Short-Pass1'):
            with self.assertRaises(CommandError):
                self.run_command(weak, '--email', 'ops@unipact.my')
        self.assertFalse(User.objects.filter(email='ops@unipact.my').exists())

    def test_existing_admin_needs_reset_flag(self):
        self.run_command('Correct-Horse-Battery-42', '--email', 'ops@unipact.my')
        with self.assertRaises(CommandError):
            self.run_command('Another-Strong-Pass-77', '--email', 'ops@unipact.my')
        self.run_command('Another-Strong-Pass-77', '--email', 'ops@unipact.my', '--reset-password')
        self.assertTrue(User.objects.get(email='ops@unipact.my').check_password('Another-Strong-Pass-77'))

    def test_warns_when_demo_accounts_exist(self):
        User.objects.create_user(username='company@unipact.com', email='company@unipact.com', password='x', role=User.Role.COMPANY)
        output = self.run_command('Correct-Horse-Battery-42', '--email', 'ops@unipact.my')
        self.assertIn('demo account', output)


class RemoveDemoAccountsCommandTests(TestCase):
    def setUp(self):
        for email in ('student@unipact.com', 'cybercorp@test.com', 'company_3_4821@example.com'):
            User.objects.create_user(username=email, email=email, password='x')
        User.objects.create_user(username='real@corp.com', email='real@corp.com', password='x')

    def test_lists_without_deleting_by_default(self):
        out = StringIO()
        call_command('remove_demo_accounts', stdout=out)
        self.assertIn('Found 3 demo account(s)', out.getvalue())
        self.assertEqual(User.objects.count(), 4)

    def test_deletes_only_demo_accounts_with_yes(self):
        call_command('remove_demo_accounts', '--yes', stdout=StringIO())
        self.assertEqual(list(User.objects.values_list('email', flat=True)), ['real@corp.com'])


class SeedScriptGuardTests(TestCase):
    @override_settings(IS_PRODUCTION=True)
    def test_seed_scripts_refuse_to_run_in_production(self):
        with self.assertRaises(ImproperlyConfigured):
            refuse_in_production('create_seed_users.py')
        with self.assertRaises(ImproperlyConfigured):
            call_command('seed_data', stdout=StringIO())

    def test_allowed_locally(self):
        refuse_in_production('create_seed_users.py')  # no error in development


class OnboardCohortCommandTests(TestCase):
    def setUp(self):
        import tempfile
        self.temp_dir = tempfile.TemporaryDirectory()
        self.json_path = os.path.join(self.temp_dir.name, 'cohort.json')
        self.csv_path = os.path.join(self.temp_dir.name, 'credentials.csv')
        self.valid_data = {
            'students': [
                {
                    'email': 'student.test@um.edu.my',
                    'full_name': 'Test Student',
                    'university': 'Universiti Malaya (UM)',
                    'major': 'CS',
                    'domain_focus': 'SOFTWARE_DEV',
                    'skills': ['Python', 'Django'],
                    'bio': 'Passionate builder',
                }
            ],
            'companies': [
                {
                    'email': 'client.test@startup.my',
                    'company_name': 'Test Startup Sdn Bhd',
                    'tier': 'PRO',
                    'industry': 'FinTech',
                    'campaign': {
                        'title': 'Test FinTech MVP',
                        'type': 'SOFTWARE_DEVELOPMENT',
                        'budget': 2000.00,
                        'description': 'Build test dashboard',
                        'requirements': ['Auth', 'Dashboard'],
                    }
                }
            ]
        }
        with open(self.json_path, 'w', encoding='utf-8') as f:
            json.dump(self.valid_data, f)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_missing_file_raises_error(self):
        with self.assertRaises(CommandError):
            call_command('onboard_cohort', '--file', 'non_existent_file.json')

    def test_dry_run_does_not_modify_database(self):
        out = StringIO()
        call_command('onboard_cohort', '--file', self.json_path, '--dry-run', stdout=out)
        self.assertIn('[DRY-RUN]', out.getvalue())
        self.assertFalse(User.objects.filter(email='student.test@um.edu.my').exists())
        self.assertFalse(User.objects.filter(email='client.test@startup.my').exists())

    def test_full_cohort_creation_and_credentials_export(self):
        out = StringIO()
        call_command(
            'onboard_cohort',
            '--file', self.json_path,
            '--credentials-output', self.csv_path,
            stdout=out
        )
        self.assertIn('[SUCCESS] Cohort Onboarding Completed!', out.getvalue())

        # Verify Student
        student_user = User.objects.get(email='student.test@um.edu.my')
        self.assertEqual(student_user.role, User.Role.STUDENT)
        self.assertTrue(student_user.is_verified)
        self.assertIsNotNone(student_user.terms_accepted_at)
        self.assertEqual(student_user.student_profile.full_name, 'Test Student')
        self.assertEqual(student_user.student_profile.verification_status, 'VERIFIED')

        # Verify Company & Campaign
        company_user = User.objects.get(email='client.test@startup.my')
        self.assertEqual(company_user.role, User.Role.COMPANY)
        self.assertTrue(company_user.is_verified)
        self.assertEqual(company_user.company_profile.company_name, 'Test Startup Sdn Bhd')
        self.assertEqual(company_user.company_profile.verification_status, 'VERIFIED')

        # Verify Campaign
        from campaigns.models import Campaign
        camp = Campaign.objects.get(title='Test FinTech MVP')
        self.assertEqual(camp.company, company_user.company_profile)
        self.assertEqual(camp.status, Campaign.Status.OPEN)
        self.assertEqual(float(camp.budget), 2000.00)

        # Verify Credentials CSV
        self.assertTrue(os.path.exists(self.csv_path))
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = list(csv.DictReader(f))
            self.assertEqual(len(reader), 2)
            self.assertEqual(reader[0]['Email'], 'student.test@um.edu.my')
            self.assertTrue(student_user.check_password(reader[0]['Temporary Password']))
            self.assertEqual(reader[1]['Email'], 'client.test@startup.my')
            self.assertTrue(company_user.check_password(reader[1]['Temporary Password']))

    def test_invalid_data_raises_error(self):
        bad_data = {'students': [{'email': 'not-an-email', 'full_name': 'Bad'}]}
        bad_json = os.path.join(self.temp_dir.name, 'bad.json')
        with open(bad_json, 'w', encoding='utf-8') as f:
            json.dump(bad_data, f)

        with self.assertRaises(CommandError):
            call_command('onboard_cohort', '--file', bad_json)

