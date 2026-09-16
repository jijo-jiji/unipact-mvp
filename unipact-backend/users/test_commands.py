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
