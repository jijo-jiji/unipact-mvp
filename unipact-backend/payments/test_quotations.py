from datetime import timedelta
from decimal import Decimal

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign, MatchOffer, Milestone
from payments.models import Invoice, Quotation
from users import agreements
from users.models import CompanyProfile, StudentProfile, User

STRONG = 'Blue-Kettle-Run-88'
BANK = dict(UNIPACT_BANK_NAME='Maybank', UNIPACT_BANK_ACCOUNT_NAME='UNIPACT DIGITAL SOLUTIONS',
            UNIPACT_BANK_ACCOUNT_NUMBER='514012345678', SUPPORT_EMAIL='support@unipact.com.my')


@override_settings(QUOTATION_BEFORE_MATCHING=True, MOCK_PAYMENTS_ENABLED=False, **BANK)
class QuotationFlowTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='ops@unipact.my', email='ops@unipact.my', password=STRONG, role=User.Role.ADMIN)
        self.client_user = User.objects.create_user(username='fin@acme.my', email='fin@acme.my', password=STRONG, role=User.Role.COMPANY, email_verified=True)
        self.company = CompanyProfile.objects.create(user=self.client_user, company_name='Acme', verification_status='VERIFIED', registration_number='202603205508')
        agreements.record_acceptance(self.client_user, agreements.CLIENT)
        student_user = User.objects.create_user(username='dev@siswa.my', email='dev@siswa.my', password=STRONG, role=User.Role.STUDENT, email_verified=True)
        self.student_user = student_user
        self.student = StudentProfile.objects.create(user=student_user, full_name='Dev', university='UM', verification_status='VERIFIED')
        agreements.record_acceptance(student_user, agreements.TALENT)
        self.campaign = Campaign.objects.create(company=self.company, title='Booking site', description='d', type='SOFTWARE_DEVELOPMENT',
                                                budget=Decimal('500.00'), status=Campaign.Status.OPEN)

    # --- helpers -------------------------------------------------------
    def as_admin(self):
        self.client.force_authenticate(self.admin)

    def as_client(self):
        self.client.force_authenticate(self.client_user)

    def draft(self, **fields):
        self.as_admin()
        body = {'campaign_id': self.campaign.id, 'line_items': [
            {'description': 'Booking website', 'quantity': '1', 'unit_price': '800.00'},
            {'description': 'Content pages', 'quantity': '4', 'unit_price': '50.00'}], **fields}
        res = self.client.post(reverse('quotation_create'), body, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    def send(self, quotation_id):
        self.as_admin()
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('quotation_send', kwargs={'quotation_id': quotation_id}))

    def accept(self, quotation_id, **fields):
        self.as_client()
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('quotation_accept', kwargs={'quotation_id': quotation_id}),
                                    {'accepted_name': 'Farah Aziz', **fields}, format='multipart')

    def match(self, **extra):
        self.as_admin()
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('admin_matchmaking_assign', kwargs={'campaign_id': self.campaign.id}),
                                    {'student_ids': [self.student.id], **extra}, format='json')

    def detail(self):
        return self.client.get(reverse('campaign_detail', kwargs={'pk': self.campaign.id})).data

    # --- tests ---------------------------------------------------------
    def test_a_draft_is_priced_by_its_lines_and_hidden_from_the_client(self):
        quotation = self.draft()
        self.assertEqual((Decimal(quotation['total']), quotation['status'], quotation['number']), (Decimal('1000.00'), 'DRAFT', ''))
        self.as_client()
        self.assertEqual(self.detail()['quotations'], [])
        self.assertEqual(self.client.get(reverse('quotation_pdf', kwargs={'quotation_id': quotation['id']})).status_code, status.HTTP_404_NOT_FOUND)

    def test_sending_numbers_it_and_emails_the_client_the_pdf(self):
        quotation = self.draft()
        res = self.send(quotation['id'])
        self.assertRegex(res.data['number'], rf"^QUO-{timezone.now():%Y}-\d{{5}}$")
        sent = next(m for m in mail.outbox if m.to == ['fin@acme.my'])
        self.assertEqual(sent.attachments[0][0], f"{res.data['number']}.pdf")
        self.assertTrue(sent.attachments[0][1].startswith(b'%PDF'))
        self.as_client()
        self.assertEqual(self.detail()['quotations'][0]['status'], 'SENT')

    def test_students_are_matched_only_after_the_client_accepts(self):
        refused = self.match()
        self.assertEqual((refused.status_code, refused.data['code']), (status.HTTP_400_BAD_REQUEST, 'quotation_required'))
        self.assertFalse(MatchOffer.objects.exists())

        quotation = self.draft()
        self.send(quotation['id'])
        self.assertEqual(self.match().status_code, status.HTTP_400_BAD_REQUEST)  # sent isn't enough
        self.assertEqual(self.accept(quotation['id']).status_code, status.HTTP_200_OK)
        self.assertEqual(self.match().status_code, status.HTTP_200_OK)

    def test_an_admin_can_match_without_a_quotation_for_a_special_case(self):
        self.assertEqual(self.match(without_quotation=True).status_code, status.HTTP_200_OK)

    def test_accepting_fixes_the_price_records_the_po_and_puts_it_on_invoices(self):
        quotation = self.draft()
        self.send(quotation['id'])
        mail.outbox.clear()
        res = self.accept(quotation['id'], po_number='PO-2026-0042',
                          po_document=SimpleUploadedFile('po.pdf', b'%PDF-1.4 po', content_type='application/pdf'))
        self.assertEqual((res.status_code, res.data['status'], res.data['po_number']), (status.HTTP_200_OK, 'ACCEPTED', 'PO-2026-0042'))
        self.assertTrue(res.data['po_document'])
        self.assertIn('ops@unipact.my', mail.outbox[0].to + mail.outbox[0].bcc)  # the admins hear about it

        self.campaign.refresh_from_db()
        self.assertEqual((self.campaign.budget, self.campaign.payment_structure), (Decimal('1000.00'), 'UPFRONT'))
        self.assertEqual(list(self.campaign.milestones.values_list('title', 'percentage')), [('Delivery', Decimal('100.00'))])

        # The team is confirmed and the client pays by bank transfer: the invoice carries their PO
        self.match()
        MatchOffer.objects.update(status=MatchOffer.Status.ACCEPTED)
        self.as_client()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('request_invoice', kwargs={'campaign_id': self.campaign.id}))
        invoice = Invoice.objects.get()
        self.assertEqual((invoice.amount, invoice.po_number), (Decimal('1000.00'), 'PO-2026-0042'))

    def test_accepting_needs_a_name_and_the_client_agreement_and_a_live_quotation(self):
        quotation = self.draft()
        self.send(quotation['id'])
        self.assertIn('accepted_name', self.accept(quotation['id'], accepted_name='').data)

        from users.models import AgreementAcceptance
        AgreementAcceptance.objects.filter(user=self.client_user).delete()
        with self.settings(AGREEMENTS_ENFORCED=True):
            self.assertEqual(self.accept(quotation['id']).data['code'], 'agreement_required')
        agreements.record_acceptance(self.client_user, agreements.CLIENT)

        Quotation.objects.filter(pk=quotation['id']).update(valid_until=timezone.localdate() - timedelta(days=1))
        self.assertIn('expired', str(self.accept(quotation['id']).data))

    def test_asking_for_changes_then_a_revision_replaces_the_old_quotation(self):
        first = self.draft()
        self.send(first['id'])
        self.as_client()
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('quotation_request_changes', kwargs={'quotation_id': first['id']}), {'message': 'Can we drop the content pages?'}, format='json')
        self.assertEqual(res.data['status'], 'CHANGES_REQUESTED')
        self.assertIn('drop the content pages', mail.outbox[-1].body)

        second = self.draft(line_items=[{'description': 'Booking website', 'quantity': '1', 'unit_price': '800.00'}])
        self.send(second['id'])
        self.assertEqual(Quotation.objects.get(pk=first['id']).status, 'SUPERSEDED')
        self.assertEqual(self.accept(first['id']).status_code, status.HTTP_400_BAD_REQUEST)  # the old one is closed
        self.assertEqual(self.accept(second['id']).status_code, status.HTTP_200_OK)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.budget, Decimal('800.00'))

    def test_bad_lines_and_milestone_splits_are_refused(self):
        self.as_admin()
        url = reverse('quotation_create')
        for body in (
            {'line_items': []},
            {'line_items': [{'description': '', 'quantity': '1', 'unit_price': '10'}]},
            {'line_items': [{'description': 'X', 'quantity': '1', 'unit_price': '10.555'}]},
            {'line_items': [{'description': 'X', 'quantity': '1', 'unit_price': '10'}], 'payment_terms': 'MILESTONES',
             'milestones': [{'title': 'A', 'percentage': '50'}, {'title': 'B', 'percentage': '40'}]},
        ):
            self.assertEqual(self.client.post(url, {'campaign_id': self.campaign.id, **body}, format='json').status_code,
                             status.HTTP_400_BAD_REQUEST, body)

    def test_pay_per_milestone_invoices_one_milestone_at_a_time_and_work_waits_for_payment(self):
        quotation = self.draft(payment_terms='MILESTONES', milestones=[{'title': 'Design', 'percentage': '40'}, {'title': 'Build', 'percentage': '60'}])
        self.send(quotation['id'])
        self.accept(quotation['id'], po_number='PO-77')
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.payment_structure, 'MILESTONE')
        design, build = self.campaign.milestones.order_by('step_number')

        self.match()
        MatchOffer.objects.update(status=MatchOffer.Status.ACCEPTED)
        self.as_client()
        finalize_url = reverse('finalize_match', kwargs={'campaign_id': self.campaign.id})
        due = self.client.post(finalize_url, {}, format='json')
        self.assertEqual((due.status_code, Decimal(str(due.data['project_fee']))), (status.HTTP_402_PAYMENT_REQUIRED, Decimal('400.00')))

        def record(amount, ref):
            self.as_admin()
            with self.captureOnCommitCallbacks(execute=True):
                return self.client.post(reverse('admin_record_client_payment', kwargs={'campaign_id': self.campaign.id}), {'amount': amount, 'reference': ref}, format='json')

        record('400.00', 'IBG-1')
        self.as_client()
        self.assertEqual(self.client.post(finalize_url, {}, format='json').status_code, status.HTTP_200_OK)

        def submit(milestone):
            self.client.force_authenticate(self.student_user)
            return self.client.post(reverse('milestone_submit', kwargs={'campaign_id': self.campaign.id, 'milestone_id': milestone.id}),
                                    {'deliverable_url': 'https://example.com/work'}, format='json')

        self.assertEqual(submit(design).status_code, status.HTTP_200_OK)
        self.as_client()
        with self.captureOnCommitCallbacks(execute=True):
            approved = self.client.post(reverse('milestone_review', kwargs={'campaign_id': self.campaign.id, 'milestone_id': design.id}), {'action': 'approve'}, format='json')
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

        # The next milestone is invoiced straight away, with the PO, and its work waits for that payment
        invoice = Invoice.objects.get(milestone=build)
        self.assertEqual((invoice.amount, invoice.po_number, invoice.description), (Decimal('600.00'), 'PO-77', 'Milestone 2: Build'))
        blocked = submit(build)
        self.assertEqual((blocked.status_code, blocked.data['code']), (status.HTTP_400_BAD_REQUEST, 'milestone_unpaid'))
        self.as_client()
        self.assertEqual(Decimal(str(self.detail()['escrow']['due_now'])), Decimal('600.00'))

        record('600.00', 'IBG-2')
        self.assertEqual(submit(build).status_code, status.HTTP_200_OK)
