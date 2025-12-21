from rest_framework import serializers
from .models import Transaction, Subscription

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'company', 'amount', 'transaction_type', 'status', 'related_campaign', 'created_at']
        read_only_fields = ['company', 'status', 'created_at']

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['id', 'company', 'plan_name', 'status', 'start_date', 'end_date', 'auto_renew']
