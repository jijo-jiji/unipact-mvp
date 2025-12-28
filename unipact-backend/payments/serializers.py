from rest_framework import serializers
from .models import Subscription, Transaction

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['plan_name', 'status', 'start_date', 'end_date', 'auto_renew']

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'amount', 'transaction_type', 'status', 'created_at']

class TreasurySummarySerializer(serializers.Serializer):
    subscription = SubscriptionSerializer(read_only=True)
    transactions = TransactionSerializer(many=True) # Nested Serialization
    tier = serializers.CharField()
    balance = serializers.DecimalField(max_digits=12, decimal_places=2) # Mocked available balance
