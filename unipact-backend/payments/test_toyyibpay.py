from decimal import Decimal
from unittest import mock

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign
from payments.models import Transaction
from users.models import CompanyProfile, StudentProfile, User

TOYYIBPAY = dict(TOYYIBPAY_MODE='sandbox', TOYYIBPAY_SANDBOX_SECRET_KEY='sk-test', TOYYIBPAY_SANDBOX_CATEGORY_CODE='cat123',
                 TOYYIBPAY_LIVE_SECRET_KEY='sk-live', TOYYIBPAY_LIVE_CATEGORY_CODE='catlive', MOCK_PAYMENTS_ENABLED=False)


class FakeToyyibPay:
    """Stands in for ToyyibPay's API: records what UniPact sent and answers like the real one."""

    def __init__(self):
        self.calls = []
        self.urls = []
        self.bills = 0
        self.payment_status = '2'  # pending until a test says otherwise
        self.paid_amount = '1000.00'
        self.create_error = None

    def __call__(self, url, data=None, timeout=None):
        endpoint = url.rsplit('/', 1)[-1]
        self.calls.append((endpoint, dict(data)))
        self.urls.append(url)
        response = mock.Mock()
        if endpoint == 'createBill':
            if self.create_error:
                response.json.side_effect = ValueError
                response.text = self.create_error
                return response
            self.bills += 1
            response.json.return_value = [{'BillCode': f'BILL{self.bills}'}]
        elif endpoint == 'getBillTransactions':
            reference = self.last_bill_data['billExternalReferenceNo']
            response.json.return_value = [{
                'billpaymentStatus': self.payment_status, 'billpaymentAmount': self.paid_amount,
                'billpaymentInvoiceNo': 'TP2609300001', 'billExternalReferenceNo': reference,
            }]
        return response

    @property
    def last_bill_data(self):
        return [data for endpoint, data in self.calls if endpoint == 'createBill'][-1]


class PostgresLockingTests(APITestCase):
    """Tests run on SQLite, which ignores row locks, so compile the locking queries as PostgreSQL would see
    them. A plain FOR UPDATE across a nullable relation is an error there, and it once stopped every online
    payment from being recorded in production."""

    def postgres_sql(self, queryset):
        from django.db.backends.postgresql.base import DatabaseWrapper

        postgres = DatabaseWrapper({
            'NAME': 'x', 'USER': '', 'PASSWORD': '', 'HOST': '', 'PORT': '', 'OPTIONS': {}, 'TIME_ZONE': None,
            'CONN_MAX_AGE': 0, 'CONN_HEALTH_CHECKS': False, 'AUTOCOMMIT': True, 'ATOMIC_REQUESTS': False, 'TEST': {},
        }, alias='postgres-sql-only')
        postgres.get_autocommit = lambda: False  # compile as if inside a transaction; nothing connects
        return queryset.query.get_compiler(connection=postgres).as_sql()[0]

    def test_settling_a_payment_locks_only_the_transaction_row(self):
        from payments import toyyibpay

        sql = self.postgres_sql(toyyibpay.locked_transactions().filter(pk=1))
        self.assertIn('LEFT OUTER JOIN', sql)  # the nullable project relation that a bare FOR UPDATE can't cover
        self.assertTrue(sql.endswith('FOR UPDATE OF "payments_transaction"'), sql[-80:])


@override_settings(**TOYYIBPAY)
class ToyyibPayProjectFeeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password='AdminPass123!', role=User.Role.ADMIN)
        self.company_user = User.objects.create_user(username='co@x.com', email='co@x.com', password='CoPass123!', role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='Kopi & Co. Sdn Bhd', verification_status='VERIFIED')
        student_user = User.objects.create_user(username='s@x.my', email='s@x.my', password='StudentPass123!', role=User.Role.STUDENT, is_verified=True)
        self.student = StudentProfile.objects.create(user=student_user, full_name='Adam', university='UM', verification_status='VERIFIED')
        self.campaign = Campaign.objects.create(company=self.company, title='Website (v2)!', description='d', type='SOFTWARE_DEVELOPMENT',
                                                budget=1000, status=Campaign.Status.MATCHED)
        self.campaign.assigned_students.add(self.student)
        self.client.force_authenticate(user=self.admin)
        self.client.post(reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id}), {'milestones': [{'title': 'Delivery', 'percentage': 100}]}, format='json')
        self.client.force_authenticate(user=self.company_user)

        self.gateway = FakeToyyibPay()
        patcher = mock.patch('payments.toyyibpay.requests.post', side_effect=self.gateway)
        patcher.start()
        self.addCleanup(patcher.stop)

    def open_bill(self, **extra):
        return self.client.post(reverse('toyyibpay_create_bill'), {'campaign_id': self.campaign.id, 'phone': '012-345 6789', **extra}, format='json')

    def callback(self, **data):
        self.client.force_authenticate(user=None)
        try:
            with self.captureOnCommitCallbacks(execute=True):
                return self.client.post(reverse('toyyibpay_callback'), {'billcode': 'BILL1', 'status': '1', 'order_id': 'x', 'refno': 'r', **data})
        finally:
            self.client.force_authenticate(user=self.company_user)

    def test_client_pays_by_fpx_then_confirms_the_match(self):
        finalize_url = reverse('finalize_match', kwargs={'campaign_id': self.campaign.id})
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(finalize_url, {}, format='json')
        self.assertEqual((res.status_code, res.data['payment_method']), (status.HTTP_402_PAYMENT_REQUIRED, 'toyyibpay'))
        self.assertEqual(len(mail.outbox), 0)  # no invoice email unless the client asks for one

        res = self.open_bill(amount='1.00')  # a browser-supplied amount is ignored
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['payment_url'], 'https://dev.toyyibpay.com/BILL1')
        sent = self.gateway.last_bill_data
        tx = Transaction.objects.get(provider_bill_code='BILL1')
        self.assertEqual((sent['billAmount'], sent['userSecretKey'], sent['categoryCode']), (100000, 'sk-test', 'cat123'))
        self.assertEqual(sent['billExternalReferenceNo'], f'UNIPACT-TX-{tx.id}')
        self.assertRegex(sent['billDescription'], r'^[A-Za-z0-9 _]{1,100}$')
        self.assertEqual(sent['billPhone'], '0123456789')
        self.assertTrue(sent['billCallbackUrl'].endswith('/api/payments/toyyibpay/callback/'))

        # A callback claiming success means nothing until ToyyibPay itself confirms it
        self.assertEqual(self.callback().status_code, 200)
        tx.refresh_from_db()
        self.assertEqual(tx.status, Transaction.Status.PENDING)
        self.assertEqual(self.client.post(finalize_url, {}, format='json').status_code, status.HTTP_402_PAYMENT_REQUIRED)

        self.gateway.payment_status = '1'
        self.callback()
        self.callback()  # ToyyibPay may call more than once
        tx.refresh_from_db()
        self.assertEqual((tx.status, tx.reference, tx.is_test), (Transaction.Status.SUCCESS, 'TEST FPX TP2609300001', True))
        self.assertIn('TEST payment', mail.outbox[0].body)
        self.assertIsNotNone(tx.paid_at)
        self.assertEqual(Transaction.objects.filter(related_campaign=self.campaign, status='SUCCESS').count(), 1)
        self.assertEqual([m.subject for m in mail.outbox], ['Payment receipt | UniPact'])

        res = self.client.post(reverse('toyyibpay_verify'), {'billcode': 'BILL1'}, format='json')
        self.assertEqual((res.data['status'], res.data['campaign_id']), ('SUCCESS', self.campaign.id))
        self.assertEqual(self.client.post(finalize_url, {}, format='json').status_code, status.HTTP_200_OK)

    def start_on_manual_billing(self):
        """A client who pays monthly: the project starts without any payment."""
        self.campaign.payment_structure = Campaign.PaymentStructure.MANUAL
        self.campaign.save()
        res = self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_monthly_client_pays_part_of_the_balance_online_after_the_project_started(self):
        self.start_on_manual_billing()
        detail_url = reverse('campaign_detail', kwargs={'pk': self.campaign.id})
        escrow = self.client.get(detail_url).data['escrow']
        self.assertEqual((escrow['outstanding'], escrow['pay_online'], escrow['pay_online_test']), (Decimal('1000.00'), True, True))

        # The amount is the client's choice here, but never more than is owed and never nonsense
        for bad in ('1000.01', '0.50', '-5', 'abc', '12.345'):
            self.assertEqual(self.open_bill(amount=bad).status_code, status.HTTP_400_BAD_REQUEST, bad)
        self.assertEqual(self.gateway.bills, 0)

        res = self.open_bill(amount='400.00')
        self.assertEqual((res.status_code, res.data['amount']), (status.HTTP_201_CREATED, Decimal('400.00')))
        self.assertEqual(self.gateway.last_bill_data['billAmount'], 40000)

        self.gateway.payment_status, self.gateway.paid_amount = '1', '400.00'
        self.callback()
        verify = self.client.post(reverse('toyyibpay_verify'), {'billcode': 'BILL1'}, format='json')
        self.assertEqual((verify.data['status'], verify.data['needs_confirmation']), ('SUCCESS', False))
        escrow = self.client.get(detail_url).data['escrow']
        self.assertEqual((escrow['client_paid'], escrow['outstanding'], escrow['collected']), (Decimal('400.00'), Decimal('600.00'), Decimal('360.00')))
        self.assertIn('RM 600.00 of the project fee is still outstanding', mail.outbox[-1].body)

        # No amount given: the rest of what's owed
        self.gateway.payment_status = '2'
        self.assertEqual(self.open_bill().data['amount'], Decimal('600.00'))

    def test_upfront_project_cannot_be_part_paid_to_start_it(self):
        res = self.open_bill(amount='10.00')
        self.assertEqual(self.gateway.last_bill_data['billAmount'], 100000)
        self.assertEqual(res.data['amount'], Decimal('1000.00'))

    def test_started_project_can_be_invoiced_for_its_balance(self):
        self.start_on_manual_billing()
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('request_invoice', kwargs={'campaign_id': self.campaign.id}))
        self.assertEqual((res.status_code, res.data['outstanding']), (status.HTTP_200_OK, Decimal('1000.00')))

    def test_payment_for_the_wrong_amount_is_not_counted(self):
        self.open_bill()
        self.gateway.payment_status, self.gateway.paid_amount = '1', '1.00'
        self.callback()
        self.assertEqual(Transaction.objects.get(provider_bill_code='BILL1').status, Transaction.Status.PENDING)
        self.assertEqual([m.subject for m in mail.outbox], ['Payment needs attention | UniPact'])
        self.assertIn('admin@x.my', mail.outbox[0].to + mail.outbox[0].bcc)

    def test_failed_payment_is_marked_failed_and_a_new_bill_can_be_opened(self):
        self.open_bill()
        self.gateway.payment_status = '3'
        res = self.client.post(reverse('toyyibpay_verify'), {'billcode': 'BILL1'}, format='json')
        self.assertEqual(res.data['status'], 'FAILED')
        self.assertEqual(self.open_bill().data['payment_url'], 'https://dev.toyyibpay.com/BILL2')

    def test_international_phone_format_is_sent_as_local_digits(self):
        self.open_bill(phone='+60 13-347 4009')
        self.assertEqual(self.gateway.last_bill_data['billPhone'], '0133474009')

    def test_second_click_reuses_the_open_bill(self):
        first, second = self.open_bill(), self.open_bill()
        self.assertEqual(first.data['payment_url'], second.data['payment_url'])
        self.assertEqual(self.gateway.bills, 1)

    def test_already_paid_bill_is_not_charged_again(self):
        self.open_bill()
        self.gateway.payment_status = '1'  # paid, but the callback never arrived
        res = self.open_bill()
        self.assertEqual(res.data['status'], 'paid')
        self.assertEqual(self.gateway.bills, 1)

    def test_only_the_owner_can_pay_and_a_phone_is_required(self):
        other = User.objects.create_user(username='x@y.com', email='x@y.com', password='OtherPass123!', role=User.Role.COMPANY)
        CompanyProfile.objects.create(user=other, company_name='Other')
        self.client.force_authenticate(user=other)
        self.assertEqual(self.open_bill().status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(user=self.company_user)
        self.assertEqual(self.open_bill(phone='abc').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.gateway.bills, 0)

    def test_gateway_refusal_returns_502(self):
        self.gateway.create_error = '[KEY-DID-NOT-EXIST]'
        res = self.open_bill()
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(Transaction.objects.get(related_campaign=self.campaign).status, Transaction.Status.FAILED)

    def test_client_can_ask_for_an_invoice_instead(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('request_invoice', kwargs={'campaign_id': self.campaign.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('admin@x.my', mail.outbox[0].to + mail.outbox[0].bcc)

    @override_settings(TOYYIBPAY_MODE='live')
    def test_live_mode_uses_the_live_account(self):
        res = self.open_bill()
        self.assertEqual(res.data['payment_url'], 'https://toyyibpay.com/BILL1')
        self.assertEqual(self.gateway.urls[-1], 'https://toyyibpay.com/index.php/api/createBill')
        self.assertEqual((self.gateway.last_bill_data['userSecretKey'], self.gateway.last_bill_data['categoryCode']), ('sk-live', 'catlive'))
        self.gateway.payment_status = '1'
        self.callback()
        tx = Transaction.objects.get(provider_bill_code='BILL1')
        self.assertEqual((tx.status, tx.reference, tx.is_test), (Transaction.Status.SUCCESS, 'FPX TP2609300001', False))

    def test_sandbox_bill_is_still_checked_on_the_sandbox_after_going_live(self):
        self.open_bill()
        self.gateway.payment_status = '1'
        with override_settings(TOYYIBPAY_MODE='live'):
            self.callback()
        self.assertEqual(self.gateway.urls[-1], 'https://dev.toyyibpay.com/index.php/api/getBillTransactions')
        self.assertTrue(Transaction.objects.get(provider_bill_code='BILL1').is_test)

    @override_settings(IS_PRODUCTION=True, TOYYIBPAY_SANDBOX_TESTERS=['tester@x.com'])
    def test_on_the_live_site_only_named_testers_can_make_sandbox_payments(self):
        finalize_url = reverse('finalize_match', kwargs={'campaign_id': self.campaign.id})
        self.assertEqual(self.client.post(finalize_url, {}, format='json').data['payment_method'], 'bank_transfer')
        self.assertEqual(self.open_bill().status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(self.gateway.bills, 0)

        with override_settings(TOYYIBPAY_SANDBOX_TESTERS=['co@x.com']):
            res = self.client.post(finalize_url, {}, format='json')
            self.assertEqual((res.data['payment_method'], res.data['test_mode']), ('toyyibpay', True))
            self.assertEqual(self.open_bill().status_code, status.HTTP_201_CREATED)
        with override_settings(TOYYIBPAY_MODE='live'):  # real money: open to every client
            self.assertEqual(self.client.post(finalize_url, {}, format='json').data['payment_method'], 'toyyibpay')

    @override_settings(TOYYIBPAY_SANDBOX_SECRET_KEY='')
    def test_without_toyyibpay_keys_online_payment_is_off(self):
        self.assertEqual(self.open_bill().status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        res = self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')
        self.assertEqual(res.data['payment_method'], 'bank_transfer')
