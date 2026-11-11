"""
The public "Our impact" figures: workshops held and B40 students paid.

Every number is counted from records on UniPact (workshops logged here, payouts marked PAID,
completed projects), so each figure on the front page can be traced back to the rows behind it.
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


class ImpactSettings(models.Model):
    """One row. The counter only uses records made on UniPact; numbers counted by hand before the
    platform are deliberately left out. `counting_starts_on` lets the team start from a clean date
    and ignore anything older (test projects, early payouts recorded inconsistently)."""
    counting_starts_on = models.DateField(null=True, blank=True)
    show_on_homepage = models.BooleanField(default=False)  # off until the team agrees the numbers
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
