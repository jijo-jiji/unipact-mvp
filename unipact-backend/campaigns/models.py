from decimal import Decimal
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from users.models import CompanyProfile, ClubProfile, StudentProfile

CENT = Decimal('0.01')

class Campaign(models.Model):
    class Type(models.TextChoices):
        TALENT_BOUNTY = 'TALENT_BOUNTY', 'Talent Bounty'
        BRAND_AMBASSADOR = 'BRAND_AMBASSADOR', 'Brand Ambassador'
        SOFTWARE_DEVELOPMENT = 'SOFTWARE_DEVELOPMENT', 'Software Development'
        DIGITAL_MARKETING = 'DIGITAL_MARKETING', 'Digital Marketing'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        OPEN = 'OPEN', 'Open for Applications / Matching'
        MATCHED = 'MATCHED', 'Matched (Pending Finalization)'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        ARCHIVED = 'ARCHIVED', 'Archived'

    class PaymentStructure(models.TextChoices):
        UPFRONT = 'UPFRONT', 'Upfront (full project fee before work starts)'
        MANUAL = 'MANUAL', 'Manual (admin logs client payments as they arrive)'

    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name='campaigns')
    title = models.CharField(max_length=255)
    description = models.TextField()
    type = models.CharField(max_length=30, choices=Type.choices)
    budget = models.DecimalField(max_digits=10, decimal_places=2)
    requirements = models.JSONField(default=list) # Stores list of deliverables/conditions
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    # Managed-escrow settings (V3.0 student flow only; the Club/SRS v2.2.1 flat-fee flow is untouched)
    payment_structure = models.CharField(max_length=20, choices=PaymentStructure.choices, default=PaymentStructure.UPFRONT)
    platform_fee_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))],
        help_text="Overrides the default platform cut for this campaign (e.g. 10.00 = 10%). Leave blank to use the site default."
    )
    
    # V3.0 Specialized Category Fields (REQ-3.3.1)
    software_sub_type = models.CharField(max_length=50, blank=True, null=True) # e.g. CRM, ERP, Landing Page
    required_skills = models.JSONField(default=list, blank=True)
    project_outcome = models.TextField(blank=True)
    campaign_objective = models.TextField(blank=True)
    target_platforms = models.JSONField(default=list, blank=True)
    
    # V3.0 Admin Curated Matching (REQ-3.4.1)
    assigned_students = models.ManyToManyField(StudentProfile, related_name='assigned_jobs', blank=True)
    match_notes = models.TextField(blank=True)
    is_match_finalized = models.BooleanField(default=False)

    # When work actually started (match finalized) and finished - the ledger's "execution time"
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def resolved_fee_percent(self):
        if self.platform_fee_percent is not None:
            return self.platform_fee_percent
        from django.conf import settings
        return Decimal(str(settings.DEFAULT_PLATFORM_FEE_PERCENT))

    def net_of_fee(self, amount):
        """What's left of a client payment for the students once UniPact's cut is taken."""
        return (amount * (Decimal('100') - self.resolved_fee_percent()) / Decimal('100')).quantize(CENT)

    def student_pool(self):
        """The student-facing pool for this project: the full fee minus UniPact's cut."""
        return self.net_of_fee(self.budget)

    def has_pending_offers(self):
        return self.match_offers.filter(status=MatchOffer.Status.PENDING).exists()

    def is_active_member(self, student_profile):
        """On the team and not still deciding on an admin's offer. Students without an offer row
        (teammates who joined by invitation, or matches made before offers existed) count as active."""
        if not student_profile or not self.assigned_students.filter(id=student_profile.id).exists():
            return False
        return not self.match_offers.filter(student=student_profile, status=MatchOffer.Status.PENDING).exists()


class MatchOffer(models.Model):
    """V3.0 (wireframe §9): an admin's match is an offer the student accepts or declines
    before the company is asked to confirm and pay."""
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn by admin'

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='match_offers')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='match_offers')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    decline_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['campaign', 'student'], name='unique_match_offer_per_student')]
        ordering = ['created_at']

    def __str__(self):
        return f"Offer: {self.student.full_name} for {self.campaign.title} ({self.status})"

class Application(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        AWARDED = 'AWARDED', 'Awarded'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        COMPLETED = 'COMPLETED', 'Completed'
        REJECTED = 'REJECTED', 'Rejected'
        NOT_SELECTED = 'NOT_SELECTED', 'Not Selected'

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='applications')
    club = models.ForeignKey(ClubProfile, on_delete=models.CASCADE, related_name='applications')
    message = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.club.club_name} - {self.campaign.title}"

class Deliverable(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='deliverables')
    file = models.FileField(upload_to='deliverables/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Deliverable for {self.application}"

class Report(models.Model):
    campaign = models.OneToOneField(Campaign, on_delete=models.CASCADE, related_name='report')
    generated_pdf = models.FileField(upload_to='reports/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report for {self.campaign.title}"

class ClientAsset(models.Model):
    class AssetType(models.TextChoices):
        DOCUMENT = 'DOCUMENT', 'Document / Brief'
        BRAND = 'BRAND', 'Brand Asset / Vector'
        RAW_VIDEO = 'RAW_VIDEO', 'Raw Video Footage (4K/HD)'
        RAW_PHOTO = 'RAW_PHOTO', 'Raw Lifestyle Photography'
        AUDIO_STEM = 'AUDIO_STEM', 'Audio Stem / Jingle'
        OTHER = 'OTHER', 'Other'

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='client_assets')
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='client_assets/')
    asset_type = models.CharField(max_length=20, choices=AssetType.choices, default=AssetType.DOCUMENT)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.campaign.title})"

class StudentDeliverable(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='student_deliverables')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='deliverables')
    title = models.CharField(max_length=255)
    external_url = models.URLField(blank=True, null=True)
    file = models.FileField(upload_to='student_deliverables/', blank=True, null=True)
    contribution_role = models.CharField(max_length=150, blank=True)
    contribution_summary = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.student.full_name}"

class Milestone(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        SUBMITTED = 'SUBMITTED', 'Submitted (Under Review)'
        REVISION_REQUESTED = 'REVISION_REQUESTED', 'Revision Requested'
        APPROVED = 'APPROVED', 'Approved (Escrow Released)'

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='milestones')
    step_number = models.PositiveSmallIntegerField(default=1) # 1, 2, 3
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('100'))  # share of the student pool
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    max_revisions = models.PositiveSmallIntegerField(default=2)
    revisions_used = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    
    # Deliverable submission data
    deliverable_url = models.URLField(blank=True, null=True)
    deliverable_file = models.FileField(upload_to='milestone_deliverables/', blank=True, null=True)
    deliverable_notes = models.TextField(blank=True)

    # When the team last submitted it: the client's review period (5 working days) counts from here
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    # Accepted by the review period running out, not by the client or an admin
    auto_approved = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['step_number']

    def __str__(self):
        return f"Milestone {self.step_number}: {self.title} ({self.campaign.title})"

class MilestoneMessage(models.Model):
    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey('users.User', on_delete=models.CASCADE)
    message = models.TextField()
    timestamp_tag = models.CharField(max_length=100, blank=True) # e.g. "00:08 of Reel #2"
    attached_file = models.FileField(upload_to='collaboration_files/', blank=True, null=True)
    is_revision_request = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message by {self.sender.email} on {self.milestone.title}"


class ProjectTeamInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'
        EXPIRED = 'EXPIRED', 'Expired'

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='team_invitations')
    invited_by = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='sent_team_invitations')
    invitee_email = models.EmailField()
    invitee_student = models.ForeignKey(StudentProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_team_invitations')
    role_in_project = models.CharField(max_length=150, default='Collaborator')
    payout_share_percentage = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invite: {self.invitee_email} to {self.campaign.title} as {self.role_in_project} ({self.status})"


class ProjectImpactReport(models.Model):
    """The client's side of the Verified Impact Ledger, shared by everyone on the project team.

    Only what the client account itself entered and signed goes here - that's what makes the
    ledger "verified". UniPact admins publish ledgers but never edit this.
    """
    campaign = models.OneToOneField(Campaign, on_delete=models.CASCADE, related_name='impact_report')
    client_rating = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    business_pain_point = models.TextField(blank=True)
    client_industry = models.CharField(max_length=120, blank=True)
    metrics = models.JSONField(default=list, blank=True)  # up to 2 of {"value": "14 Hrs", "label": "Saved per agent / week"}
    verified_skills = models.JSONField(default=list, blank=True)
    testimonial = models.TextField(blank=True)
    signer_name = models.CharField(max_length=150, blank=True)
    signer_title = models.CharField(max_length=150, blank=True)
    signed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='signed_impact_reports')
    signed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Impact report for {self.campaign.title}"


def _ledger_slug(campaign_id):
    import secrets
    alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'  # no lookalikes (0/o, 1/l/i), easy to read off a CV
    return f"UP-{campaign_id:03d}-{''.join(secrets.choice(alphabet) for _ in range(6))}"


class ImpactLedger(models.Model):
    """One student's Verified Impact Ledger for one completed project - the public proof of work."""
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PUBLISHED = 'PUBLISHED', 'Published'

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='impact_ledgers')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='impact_ledgers')
    # The random suffix keeps unpublished ledgers from being found by guessing sequential ids
    slug = models.CharField(max_length=32, unique=True, editable=False)

    role = models.CharField(max_length=150, blank=True)
    technical_solution = models.TextField(blank=True)
    proof_url = models.URLField(blank=True)
    before_image = models.ImageField(upload_to='ledger_proof/', blank=True, null=True)
    before_caption = models.CharField(max_length=150, blank=True)
    after_image = models.ImageField(upload_to='ledger_proof/', blank=True, null=True)
    after_caption = models.CharField(max_length=150, blank=True)
    student_submitted_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='published_ledgers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('campaign', 'student')
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.slug:
            slug = _ledger_slug(self.campaign_id)
            while ImpactLedger.objects.filter(slug=slug).exists():
                slug = _ledger_slug(self.campaign_id)
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Ledger {self.slug} - {self.student.full_name}"
