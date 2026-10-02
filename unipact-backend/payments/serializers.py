from rest_framework import serializers
from .models import Invoice, Subscription, Transaction, Payout

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['plan_name', 'status', 'start_date', 'end_date', 'auto_renew']

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'amount', 'transaction_type', 'status', 'reference', 'created_at']

class TreasurySummarySerializer(serializers.Serializer):
    subscription = SubscriptionSerializer(read_only=True)
    transactions = TransactionSerializer(many=True) # Nested Serialization
    tier = serializers.CharField()
    balance = serializers.DecimalField(max_digits=12, decimal_places=2) # Mocked available balance

class PayoutSerializer(serializers.ModelSerializer):
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_email = serializers.EmailField(source='student.user.email', read_only=True)
    milestone_title = serializers.CharField(source='milestone.title', read_only=True, default=None)

    class Meta:
        model = Payout
        fields = [
            'id', 'campaign', 'campaign_title', 'student', 'student_name', 'student_email',
            'milestone', 'milestone_title',
            'amount', 'status', 'bank_name', 'bank_account_number', 'bank_account_holder_name',
            'duitnow_id', 'bank_details_changed_at', 'transfer_reference', 'notes', 'paid_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'campaign', 'student', 'milestone', 'bank_details_changed_at', 'created_at', 'updated_at']



class InvoiceSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Invoice
        fields = ['id', 'number', 'campaign_id', 'project_title', 'amount', 'status', 'issued_at', 'due_date', 'paid_at',
                  'bank_name', 'bank_account_name', 'bank_account_number']
        read_only_fields = fields
