from rest_framework import serializers
from .models import Subscription, Transaction

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['plan_name', 'status', 'start_date', 'end_date', 'auto_renew']

class TreasurySummarySerializer(serializers.Serializer):
    subscription = SubscriptionSerializer(read_only=True)
    transactions = serializers.ListField(child=serializers.DictField())
    tier = serializers.CharField()
    balance = serializers.DecimalField(max_digits=12, decimal_places=2) # Mocked available balance
