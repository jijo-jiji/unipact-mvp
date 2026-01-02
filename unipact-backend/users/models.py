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
    
    # Payment Method Details (Mock Storage)
    card_last_4 = models.CharField(max_length=4, blank=True, null=True)
    card_brand = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.company_name

class ClubProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING_VERIFICATION = 'PENDING_VERIFICATION', _('Pending Verification')
        VERIFIED = 'VERIFIED', _('Verified')
        REJECTED = 'REJECTED', _('Rejected')

    class Rank(models.TextChoices):
        S = 'S', _('S-Class')
        A = 'A', _('A-Class')
        B = 'B', _('B-Class')
        C = 'C', _('C-Class')

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='club_profile')
    club_name = models.CharField(max_length=255)
    university = models.CharField(max_length=255)
    verification_status = models.CharField(
        max_length=25, 
        choices=VerificationStatus.choices, 
        default=VerificationStatus.PENDING_VERIFICATION
    )
    rank = models.CharField(
        max_length=2,
        choices=Rank.choices,
        default=Rank.C
    )
    verification_document = models.FileField(upload_to='club_docs/', blank=True, null=True)

    # Rank Calculation
    def calculate_rank(self):
        # Avoid circular import
        from reviews.models import Review
        from django.db.models import Avg
        from django.utils import timezone
        from datetime import timedelta

        # Rolling Window: Last 365 Days
        one_year_ago = timezone.now() - timedelta(days=365)
        
        recent_reviews = Review.objects.filter(reviewee=self, created_at__gte=one_year_ago)
        avg_rating = recent_reviews.aggregate(Avg('rating'))['rating__avg']
        
        if avg_rating is None:
            self.rank = 'C' # Default start or Reset if inactive
        elif avg_rating >= 4.5:
            self.rank = 'S'
        elif avg_rating >= 4.0:
            self.rank = 'A'
        elif avg_rating >= 3.0:
            self.rank = 'B'
        else:
            self.rank = 'C'
        
        self.save()

    def __str__(self):
        return self.club_name

class ShadowUser(models.Model):
    """
    Represents an invited user who hasn't registered yet.
    """
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=50) # e.g. "Committee Member"
    invited_by = models.ForeignKey(ClubProfile, on_delete=models.CASCADE, related_name='invited_shadows')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='shadow_membership')
    token = models.CharField(max_length=64, unique=True)
    is_claimed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Shadow: {self.email}"

class SystemLog(models.Model):
    class Category(models.TextChoices):
        FINANCIAL = 'FINANCIAL', _('Financial')
        SECURITY = 'SECURITY', _('Security')
        MARKETPLACE = 'MARKETPLACE', _('Marketplace')
        GROWTH = 'GROWTH', _('Growth')
    
    class Level(models.TextChoices):
        INFO = 'INFO', _('Info')
        SUCCESS = 'SUCCESS', _('Success')
        WARNING = 'WARNING', _('Warning')
        CRITICAL = 'CRITICAL', _('Critical')

    created_at = models.DateTimeField(auto_now_add=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.GROWTH)
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.INFO)
    message = models.TextField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.category}] {self.message}"
