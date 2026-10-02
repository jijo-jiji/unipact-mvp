from decimal import Decimal

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign, Milestone
from payments.models import Invoice
from users.models import User, CompanyProfile, StudentProfile

BANK = dict(
    MOCK_PAYMENTS_ENABLED=False,
    TOYYIBPAY_SANDBOX_SECRET_KEY='', TOYYIBPAY_SANDBOX_CATEGORY_CODE='',
    TOYYIBPAY_LIVE_SECRET_KEY='', TOYYIBPAY_LIVE_CATEGORY_CODE='',
    UNIPACT_BANK_NAME='Maybank', UNIPACT_BANK_ACCOUNT_NAME='UNIPACT DIGITAL SOLUTIONS',
    UNIPACT_BANK_ACCOUNT_NUMBER='514012345678', SUPPORT_EMAIL='support@unipact.com.my',
)


def make_user(email, role, **extra):
    return User.objects.create_user(username=email, email=email, password='Blue-Kettle-Run-88', role=role,
                                    email_verified=True, **extra)


@override_settings(**BANK)
class BankTransferInvoiceTests(APITestCase):
    def setUp(self):
        self.client_user = make_user('finance@megacorp.my', User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.client_user, company_name='MegaCorp', verification_status='VERIFIED')
        self.admin = make_user('ops@unipact.my', User.Role.ADMIN, is_staff=True)
        self.student_user = make_user('dev@siswa.my', User.Role.STUDENT)
        self.student = StudentProfile.objects.create(user=self.student_user, full_name='Dev', university='UM', verification_status='VERIFIED')

        self.campaign = Campaign.objects.create(company=self.company, title='Data Pipeline', budget=Decimal('8000.00'),
                                                status=Campaign.Status.MATCHED)
        self.campaign.assigned_students.add(self.student)
        # Confirming needs a milestone plan (set by an admin before the client is asked to pay)
        Milestone.objects.create(campaign=self.campaign, title='Delivery', percentage=Decimal('100'), amount=Decimal('7200.00'))

    # --- helpers -------------------------------------------------------
    def confirm_match(self):
        self.client.force_authenticate(self.client_user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')

    def record_payment(self, amount, reference='DUITNOW-123'):
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('admin_record_client_payment', kwargs={'campaign_id': self.campaign.id}),
                                    {'amount': str(amount), 'reference': reference}, format='json')

    def emails_to(self, address):
        return [m for m in mail.outbox if address in m.to + m.bcc]

    # --- issuing -------------------------------------------------------
    def test_choosing_bank_transfer_emails_the_invoice_straight_away(self):
        res = self.confirm_match()

        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertEqual(res.data['payment_method'], 'bank_transfer')
        invoice = Invoice.objects.get(campaign=self.campaign)
        self.assertEqual(res.data['invoice']['number'], invoice.number)
        self.assertRegex(invoice.number, r'^INV-\d{4}-\d{5}$')
        self.assertEqual(invoice.amount, Decimal('8000.00'))

        [email] = self.emails_to('finance@megacorp.my')
        self.assertIn(invoice.number, email.subject)
        self.assertIn('514012345678', email.body)
        self.assertIn('Payment reference', email.body)
        filename, content, mimetype = email.attachments[0]
        self.assertEqual((filename, mimetype), (f'{invoice.number}.pdf', 'application/pdf'))
        self.assertTrue(content.startswith(b'%PDF'))

    def test_admins_are_told_which_transfer_to_watch_for(self):
        self.confirm_match()
        invoice = Invoice.objects.get(campaign=self.campaign)
        [heads_up] = self.emails_to('ops@unipact.my')
        self.assertIn(f'Invoice {invoice.number} sent', heads_up.subject)
        self.assertNotIn('Invoice needed', heads_up.subject)

    def test_asking_again_reuses_the_invoice_instead_of_sending_another(self):
        self.confirm_match()
        self.confirm_match()

        self.assertEqual(Invoice.objects.filter(campaign=self.campaign).count(), 1)
        self.assertEqual(len(self.emails_to('finance@megacorp.my')), 1)

    def test_pay_by_bank_transfer_instead_button_issues_the_same_invoice(self):
        self.client.force_authenticate(self.client_user)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('request_invoice', kwargs={'campaign_id': self.campaign.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['invoice']['number'], Invoice.objects.get(campaign=self.campaign).number)

    @override_settings(UNIPACT_BANK_NAME='', UNIPACT_BANK_ACCOUNT_NAME='', UNIPACT_BANK_ACCOUNT_NUMBER='')
    def test_without_bank_details_admins_still_invoice_by_hand(self):
        res = self.confirm_match()

        self.assertIsNone(res.data['invoice'])
        self.assertFalse(Invoice.objects.exists())
        self.assertEqual(self.emails_to('finance@megacorp.my'), [])
        self.assertTrue(any('Invoice needed' in m.subject for m in self.emails_to('ops@unipact.my')))

    # --- paying --------------------------------------------------------
    def test_full_payment_settles_the_invoice_and_starts_the_project(self):
        self.confirm_match()
        mail.outbox.clear()

        res = self.record_payment('8000.00')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['project_started'])
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.IN_PROGRESS)
        self.assertTrue(self.campaign.is_match_finalized)
        invoice = Invoice.objects.get(campaign=self.campaign)
        self.assertEqual(invoice.status, Invoice.Status.PAID)
        self.assertIsNotNone(invoice.paid_at)

        self.assertTrue(any('has started' in m.subject for m in self.emails_to('dev@siswa.my')))
        receipt = next(m for m in self.emails_to('finance@megacorp.my') if 'receipt' in m.subject.lower())
        self.assertIn('student team can start work', receipt.body)

    def test_part_payment_keeps_the_project_waiting_and_reinvoices_the_rest(self):
        self.confirm_match()
        res = self.record_payment('3000.00')

        self.assertFalse(res.data['project_started'])
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.MATCHED)

        self.confirm_match()
        first, second = Invoice.objects.filter(campaign=self.campaign).order_by('pk')
        self.assertEqual(first.status, Invoice.Status.VOID)
        self.assertEqual((second.status, second.amount), (Invoice.Status.ISSUED, Decimal('5000.00')))

    def test_a_payment_with_no_invoice_does_not_start_the_project(self):
        """Without an invoice the client never confirmed their team, so starting is still their call."""
        res = self.record_payment('8000.00')

        self.assertFalse(res.data['project_started'])
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.MATCHED)

    # --- reading -------------------------------------------------------
    def test_the_pdf_is_only_for_the_client_and_admins(self):
        self.confirm_match()
        invoice = Invoice.objects.get(campaign=self.campaign)
        url = reverse('invoice_pdf', kwargs={'invoice_id': invoice.id})

        self.client.force_authenticate(self.client_user)
        own = self.client.get(url)
        self.assertEqual(own.status_code, status.HTTP_200_OK)
        self.assertEqual(own['Content-Type'], 'application/pdf')
        self.assertTrue(own.content.startswith(b'%PDF'))

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

        other = make_user('other@corp.my', User.Role.COMPANY)
        CompanyProfile.objects.create(user=other, company_name='Other')
        for outsider in (other, self.student_user):
            self.client.force_authenticate(outsider)
            self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_the_client_lists_their_invoices_without_replaced_ones(self):
        self.confirm_match()
        self.record_payment('3000.00')
        self.confirm_match()

        self.client.force_authenticate(self.client_user)
        numbers = [i['amount'] for i in self.client.get(reverse('invoice_list')).data]
        self.assertEqual(numbers, ['5000.00'])

    def test_project_page_shows_the_open_invoice_to_the_client_only(self):
        self.confirm_match()
        url = reverse('campaign_detail', kwargs={'pk': self.campaign.id})

        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.get(url).data['invoice']['bank_account_number'], '514012345678')

        self.client.force_authenticate(self.student_user)
        self.assertIsNone(self.client.get(url).data.get('invoice'))
