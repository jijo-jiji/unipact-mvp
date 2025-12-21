from rest_framework import generics, permissions, status
from rest_framework.response import Response
from users.models import User
from .models import Transaction
from .serializers import TransactionSerializer
from campaigns.models import Campaign

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
