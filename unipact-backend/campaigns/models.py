from django.db import models
from users.models import CompanyProfile, ClubProfile

class Campaign(models.Model):
    class Type(models.TextChoices):
        TALENT_BOUNTY = 'TALENT_BOUNTY', 'Talent Bounty'
        BRAND_AMBASSADOR = 'BRAND_AMBASSADOR', 'Brand Ambassador'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        OPEN = 'OPEN', 'Open for Applications'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        ARCHIVED = 'ARCHIVED', 'Archived'

    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name='campaigns')
    title = models.CharField(max_length=255)
    description = models.TextField()
    type = models.CharField(max_length=20, choices=Type.choices)
    budget = models.DecimalField(max_digits=10, decimal_places=2)
    requirements = models.JSONField(default=list) # Stores list of deliverables/conditions
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Application(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        AWARDED = 'AWARDED', 'Awarded'
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
