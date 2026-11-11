"""
The public "Our impact" figures: workshops held and B40 students paid.

Each number is counted from real records (workshops logged here, payouts marked PAID) plus an
admin-entered figure for work done before or outside the platform. Both parts are shown to admins
separately, so a figure on the front page can always be traced back to where it came from.
"""
from django.conf import settings
from django.db import models


class Workshop(models.Model):
    class Kind(models.TextChoices):
        B40 = 'B40', 'B40 upskilling'
        DIGITAL_MARKETING = 'DIGITAL_MARKETING', 'Digital marketing'
        SOFTWARE = 'SOFTWARE', 'Software development'
        OTHER = 'OTHER', 'Other'

    title = models.CharField(max_length=255)
    kind = models.CharField(max_length=30, choices=Kind.choices, default=Kind.OTHER)
    held_on = models.DateField()
    location = models.CharField(max_length=255, blank=True)
    attendees = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-held_on', '-id']

    def __str__(self):
        return f'{self.title} ({self.held_on})'


class B40Record(models.Model):
    """Marks a student as B40 after an admin has checked their documents. Kept off the student profile
    on purpose: nothing outside the admin impact endpoints reads it, and only totals are ever public."""
    student = models.OneToOneField('users.StudentProfile', on_delete=models.CASCADE, related_name='b40_record')
    evidence_note = models.CharField(max_length=255, blank=True)  # e.g. "STR letter seen 12 Oct"
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    verified_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'B40: {self.student.full_name}'


class ImpactBaseline(models.Model):
    """One row: figures from before the platform kept records (projects run over WhatsApp, cash paid
    directly). Added on top of the counted figures; keep it to what you can back with receipts."""
    b40_students_paid = models.PositiveIntegerField(default=0)
    b40_amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    projects_delivered = models.PositiveIntegerField(default=0)
    note = models.TextField(blank=True)
    show_on_homepage = models.BooleanField(default=False)  # off until the numbers are agreed
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def load(cls):
        baseline, _ = cls.objects.get_or_create(pk=1)
        return baseline

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
