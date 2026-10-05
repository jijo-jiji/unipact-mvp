import tempfile
from decimal import Decimal
from io import StringIO

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from campaigns.models import Campaign, ClientAsset, Milestone
from payments.models import Invoice, Payout, Transaction
from users import agreements
from users.models import AgreementAcceptance, CompanyProfile, StudentProfile, User

STRONG = 'Blue-Kettle-Run-88'


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class PurgeTestDataTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password=STRONG, role=User.Role.ADMIN)
        self.test_client_user, self.test_company = self.make_company('test@co.com', 'Test Co')
        self.real_client_user, self.real_company = self.make_company('real@co.com', 'Real Co')
        self.test_student_user, self.test_student = self.make_student('test@siswa.my', 'Test Student')
        self.real_student_user, self.real_student = self.make_student('real@siswa.my', 'Real Student')

        # A test project with everything a finished one carries: files, a payment, an invoice, a payout
        self.test_project = self.make_project(self.test_company, 'Test project', self.test_student)
        self.asset = ClientAsset.objects.create(campaign=self.test_project, title='brief.txt')
        self.asset.file.save('brief.txt', ContentFile(b'brief'))
        milestone = Milestone.objects.create(campaign=self.test_project, title='Delivery', amount=Decimal('900'))
        Transaction.objects.create(company=self.test_company, related_campaign=self.test_project, amount=1000,
                                   transaction_type=Transaction.Type.PROJECT_FEE, status=Transaction.Status.SUCCESS)
        Payout.objects.create(campaign=self.test_project, student=self.test_student, milestone=milestone, amount=900)
        Invoice.objects.create(company=self.test_company, campaign=self.test_project, amount=1000, number='INV-2026-00001',
                               due_date='2026-10-09', bill_to_name='Test Co', bill_to_email='test@co.com', project_title='Test project',
                               service_fee_percent=10, bank_name='Maybank', bank_account_name='UNIPACT', bank_account_number='1')
        agreements.record_acceptance(self.test_student_user, agreements.TALENT)

        self.real_project = self.make_project(self.real_company, 'Real project', self.real_student)

    def make_company(self, email, name):
        user = User.objects.create_user(username=email, email=email, password=STRONG, role=User.Role.COMPANY)
        return user, CompanyProfile.objects.create(user=user, company_name=name)

    def make_student(self, email, name):
        user = User.objects.create_user(username=email, email=email, password=STRONG, role=User.Role.STUDENT)
        return user, StudentProfile.objects.create(user=user, full_name=name, university='UM')

    def make_project(self, company, title, student):
        project = Campaign.objects.create(company=company, title=title, description='d', type='SOFTWARE_DEVELOPMENT', budget=1000,
                                          status=Campaign.Status.IN_PROGRESS, is_match_finalized=True)
        project.assigned_students.add(student)
        return project

    def run_command(self, *args):
        out = StringIO()
        call_command('purge_test_data', *args, stdout=out, stderr=out)
        return out.getvalue()

    def counts(self):
        return (User.objects.count(), Campaign.objects.count(), Transaction.objects.count(), Payout.objects.count(),
                Invoice.objects.count(), AgreementAcceptance.objects.count())

    def test_with_no_options_it_only_lists(self):
        before = self.counts()
        output = self.run_command()
        self.assertIn('test@co.com', output)
        self.assertIn('Real project', output)
        self.assertNotIn('admin@x.my', output)
        self.assertEqual(self.counts(), before)

    def test_preview_names_everything_and_deletes_nothing(self):
        before = self.counts()
        output = self.run_command('--emails', 'test@co.com,test@siswa.my')
        self.assertIn('PREVIEW ONLY', output)
        self.assertIn('Would remove 2 account(s)', output)
        self.assertIn('"Test project"', output)
        self.assertNotIn('Real project', output)
        self.assertEqual(self.counts(), before)
        self.assertTrue(default_storage.exists(self.asset.file.name))

    def test_yes_removes_the_test_accounts_their_project_money_records_and_files_only(self):
        file_name = self.asset.file.name
        output = self.run_command('--emails', 'Test@Co.com, test@siswa.my', '--yes')
        self.assertIn('Deleted.', output)

        self.assertFalse(User.objects.filter(email__in=['test@co.com', 'test@siswa.my']).exists())
        self.assertFalse(Campaign.objects.filter(pk=self.test_project.pk).exists())
        self.assertEqual((Transaction.objects.count(), Payout.objects.count(), Invoice.objects.count(), AgreementAcceptance.objects.count()), (0, 0, 0, 0))
        self.assertFalse(default_storage.exists(file_name))

        # The real client, student, project and the admin are untouched
        self.assertEqual(set(User.objects.values_list('email', flat=True)), {'admin@x.my', 'real@co.com', 'real@siswa.my'})
        self.assertEqual(list(self.real_project.assigned_students.all()), [self.real_student])

    def test_a_single_test_project_can_go_while_its_client_stays(self):
        self.run_command('--projects', str(self.test_project.id), '--yes')
        self.assertFalse(Campaign.objects.filter(pk=self.test_project.pk).exists())
        self.assertFalse(Invoice.objects.exists())
        self.assertTrue(User.objects.filter(email='test@co.com').exists())
        self.assertTrue(User.objects.filter(email='test@siswa.my').exists())

    def test_admins_are_never_removed(self):
        with self.assertRaises(CommandError):
            self.run_command('--emails', 'admin@x.my', '--yes')
        self.run_command('--all-except-admins', '--yes')
        self.assertEqual(list(User.objects.values_list('email', flat=True)), ['admin@x.my'])
        self.assertFalse(Campaign.objects.exists())

    def test_a_student_on_a_kept_clients_project_is_not_removed_by_accident(self):
        self.real_project.assigned_students.add(self.test_student)
        with self.assertRaises(CommandError) as raised:
            self.run_command('--emails', 'test@siswa.my', '--yes')
        self.assertIn('Real project', str(raised.exception))
        self.assertTrue(User.objects.filter(email='test@siswa.my').exists())

        self.run_command('--emails', 'test@siswa.my', '--yes', '--force')
        self.assertFalse(User.objects.filter(email='test@siswa.my').exists())
        self.assertTrue(Campaign.objects.filter(pk=self.real_project.pk).exists())

    def test_a_misspelt_email_or_project_number_stops_everything(self):
        before = self.counts()
        for args in (('--emails', 'test@co.com,typo@co.com', '--yes'), ('--projects', '999', '--yes'), ('--projects', 'abc')):
            with self.assertRaises(CommandError):
                self.run_command(*args)
        self.assertEqual(self.counts(), before)
