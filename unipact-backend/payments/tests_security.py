from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User, CompanyProfile
from payments.models import Transaction, Subscription
from payments.services import MockStripeService

class PaymentSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='corp@test.com', email='corp@test.com', password='pw', role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.user, company_name="Corp", verification_status='VERIFIED')
        self.client.force_authenticate(user=self.user)

    def test_confirm_payment_security_block(self):
        """ Test that simply calling confirm without paying fails """
        
        # 1. Initiate Payment
        create_url = reverse('create_intent')
        data = {'amount': 100.00, 'type': 'FINDERS_FEE'}
        response = self.client.post(create_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        transaction_id = response.data['transactionId']
        transaction = Transaction.objects.get(id=transaction_id)
        
        # 2. Attack: Try to confirm immediately (Stripe is still 'pending')
        confirm_url = reverse('confirm_payment', args=[transaction_id])
        response = self.client.post(confirm_url)
        
        # Expect Error
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Payment not successful", str(response.data))
        
        transaction.refresh_from_db()
        self.assertEqual(transaction.status, Transaction.Status.PENDING)

    def test_confirm_payment_success_path(self):
        """ Test that confirming AFTER Stripe success works """
        # 1. Initiate
        create_url = reverse('create_intent')
        data = {'amount': 100.00, 'type': 'FINDERS_FEE'}
        response = self.client.post(create_url, data, format='json')
        transaction_id = response.data['transactionId']
        transaction = Transaction.objects.get(id=transaction_id)
        
        # 2. Simulate User paying on Stripe (Simulate Webhook/Mock State)
        intent_id = transaction.stripe_payment_id
        MockStripeService.debug_set_status(intent_id, 'succeeded')
        
        # 3. Confirm
        confirm_url = reverse('confirm_payment', args=[transaction_id])
        response = self.client.post(confirm_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        transaction.refresh_from_db()
        self.assertEqual(transaction.status, Transaction.Status.SUCCESS)
