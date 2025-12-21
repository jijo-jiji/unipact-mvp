from django.db import models
from users.models import CompanyProfile
from campaigns.models import Campaign

class Subscription(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        PAST_DUE = 'PAST_DUE', 'Past Due'
        CANCELED = 'CANCELED', 'Canceled'

    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name='subscriptions')
    plan_name = models.CharField(max_length=50, default='Pro Tier')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    auto_renew = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.company.company_name} - {self.plan_name}"

class Transaction(models.Model):
    class Type(models.TextChoices):
        FINDERS_FEE = 'FINDERS_FEE', 'Finders Fee'
        SUBSCRIPTION = 'SUBSCRIPTION', 'Subscription'

    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        PENDING = 'PENDING', 'Pending'

    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    stripe_payment_id = models.CharField(max_length=100, blank=True, null=True)
    related_campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} - {self.status}"
