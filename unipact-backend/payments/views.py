from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from users.models import User, SystemLog, CompanyProfile
from users.utils import log_event
from .models import Transaction
from .serializers import TransactionSerializer
from campaigns.models import Campaign

class CreatePaymentIntentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.COMPANY:
            return Response({"error": "Only companies can make payments"}, status=status.HTTP_403_FORBIDDEN)
        
        amount = request.data.get('amount')
        campaign_id = request.data.get('campaign_id')
        transaction_type = request.data.get('type', Transaction.Type.FINDERS_FEE)
        
        if not amount:
            return Response({"error": "Amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        campaign = None
        if campaign_id:
            campaign = get_object_or_404(Campaign, pk=campaign_id)

        # Create Pending Transaction
        transaction = Transaction.objects.create(
            company=request.user.company_profile,
            amount=amount,
            transaction_type=transaction_type,
            status=Transaction.Status.PENDING,
            related_campaign=campaign
        )
        
        return Response({
            "clientSecret": "mock_secret_" + str(transaction.id), # Mocking Stripe Secret
            "transactionId": transaction.id,
            "amount": transaction.amount
        })

class ConfirmPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        transaction = get_object_or_404(Transaction, pk=transaction_id)
        
        # Verify ownership
        if transaction.company != request.user.company_profile:
             return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        
        # Update Status
        transaction.status = Transaction.Status.SUCCESS
        transaction.save()
        
        # Save Mock Card Details (For MVP "Update Card" flow)
        # In real Stripe, this comes from the PaymentMethod object
        transaction.company.card_last_4 = "4242"
        transaction.company.card_brand = "VISA"
        transaction.company.save()
        
        # Handle Pro Tier Upgrade
        if transaction.transaction_type == Transaction.Type.SUBSCRIPTION and transaction.amount >= 499:
             transaction.company.tier = CompanyProfile.Tier.PRO
             transaction.company.save()
             log_event(SystemLog.Category.GROWTH, SystemLog.Level.SUCCESS, f"Company Upgraded to PRO: {transaction.company.company_name}")

        # Log Logic
        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS, f"Payment Received: RM {transaction.amount} from {transaction.company.company_name}")

        return Response({"status": "SUCCESS", "message": "Payment confirmed"})

class TransactionHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.COMPANY:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        
        transactions = Transaction.objects.filter(company=request.user.company_profile).order_by('-created_at')
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)

class CreateTransactionView(generics.CreateAPIView):
    """
    Simulates payment for Finder's Fee.
    """
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # In a real app, this would handle Stripe Intent Creation
        # Here we simulate a successful payment instantly
        company_profile = self.request.user.company_profile
        serializer.save(
            company=company_profile, 
            status=Transaction.Status.SUCCESS
        )
