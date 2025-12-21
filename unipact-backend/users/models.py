from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    class Role(models.TextChoices):
        COMPANY = 'COMPANY', _('Company')
        CLUB = 'CLUB', _('Club')
        ADMIN = 'ADMIN', _('Admin')

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CLUB)
    email = models.EmailField(_('email address'), unique=True)
    is_verified = models.BooleanField(default=False)  # General verification flag

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'role']

    def __str__(self):
        return self.email

class CompanyProfile(models.Model):
    class Tier(models.TextChoices):
        FREE = 'FREE', _('Free Tier')
        PRO = 'PRO', _('Pro Tier')

    class VerificationStatus(models.TextChoices):
        PENDING_REVIEW = 'PENDING_REVIEW', _('Pending Review (Silent)')
        HIGH_RISK = 'HIGH_RISK', _('High Risk (Public Domain)')
        VERIFIED = 'VERIFIED', _('Verified')
        REJECTED = 'REJECTED', _('Rejected')

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='company_profile')
    company_name = models.CharField(max_length=255)
    company_details = models.TextField(blank=True)
    tier = models.CharField(max_length=10, choices=Tier.choices, default=Tier.FREE)
    verification_status = models.CharField(
        max_length=20, 
        choices=VerificationStatus.choices, 
        default=VerificationStatus.PENDING_REVIEW
    )
    ssm_document = models.FileField(upload_to='company_docs/', blank=True, null=True)

    def __str__(self):
        return self.company_name

class ClubProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING_VERIFICATION = 'PENDING_VERIFICATION', _('Pending Verification')
        VERIFIED = 'VERIFIED', _('Verified')
        REJECTED = 'REJECTED', _('Rejected')

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='club_profile')
    club_name = models.CharField(max_length=255)
    university = models.CharField(max_length=255)
    verification_status = models.CharField(
        max_length=25, 
        choices=VerificationStatus.choices, 
        default=VerificationStatus.PENDING_VERIFICATION
    )
    verification_document = models.FileField(upload_to='club_docs/', blank=True, null=True)

    def __str__(self):
        return self.club_name

class ShadowUser(models.Model):
    """
    Represents an invited user who hasn't registered yet.
    """
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=50) # e.g. "Committee Member"
    invited_by = models.ForeignKey(ClubProfile, on_delete=models.CASCADE, related_name='invited_shadows')
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Shadow: {self.email}"
