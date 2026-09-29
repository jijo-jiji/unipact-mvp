from django.db import models
from users.models import CompanyProfile, StudentProfile
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
        PROJECT_FEE = 'PROJECT_FEE', 'Project Fee'

    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        PENDING = 'PENDING', 'Pending'

    class Provider(models.TextChoices):
        MOCK = 'MOCK', 'Demo checkout'
        TOYYIBPAY = 'TOYYIBPAY', 'ToyyibPay (FPX)'
        MANUAL = 'MANUAL', 'Recorded by admin'

    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    stripe_payment_id = models.CharField(max_length=100, blank=True, null=True)
    # Bank/DuitNow reference for client payments an admin records by hand (offline or MANUAL billing)
    reference = models.CharField(max_length=100, blank=True)
    related_campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    provider = models.CharField(max_length=20, choices=Provider.choices, blank=True)
    # The payment gateway's id for this payment (a ToyyibPay BillCode)
    provider_bill_code = models.CharField(max_length=40, blank=True, db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} - {self.status}"


class Payout(models.Model):
    """
    Tracks milestone stipends disbursed to students upon campaign completion.
    In the managed escrow model, admins transfer funds directly to the student's Malaysian bank account
    and record the transaction reference.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Bank Details'
        PROCESSING = 'PROCESSING', 'Ready for Disbursement'
        PAID = 'PAID', 'Disbursed'
        FAILED = 'FAILED', 'Disbursement Failed'

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='payouts')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='payouts')
    milestone = models.ForeignKey('campaigns.Milestone', on_delete=models.SET_NULL, null=True, blank=True, related_name='payouts')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROCESSING)

    # Snapshot of bank details at time of payout processing
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_account_holder_name = models.CharField(max_length=255, blank=True)
    duitnow_id = models.CharField(max_length=50, blank=True)

    # Set when the student changes bank details after this payout was already approved for transfer;
    # the admin must confirm the new account with the student before recording the transfer.
    bank_details_changed_at = models.DateTimeField(null=True, blank=True)

    transfer_reference = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'student', 'milestone'],
                condition=models.Q(milestone__isnull=False),
                name='unique_payout_per_student_milestone',
            ),
        ]

    def __str__(self):
        return f"Payout RM {self.amount} to {self.student.full_name} ({self.status})"

