"""
The public "Our impact" figures: workshops held and B40 students paid.

Every number is counted from records on UniPact (workshops logged here, payouts marked PAID,
completed projects), so each figure on the front page can be traced back to the rows behind it.
"""
from django.conf import settings
from django.db import models


class Topic(models.TextChoices):
    B40 = 'B40', 'B40 upskilling'
    DIGITAL_MARKETING = 'DIGITAL_MARKETING', 'Digital marketing'
    SOFTWARE = 'SOFTWARE', 'Software development'
    OTHER = 'OTHER', 'Other'


class LearningModule(models.Model):
    """A workshop module kept on the platform so students can come back to it: slides, notes and exercises."""
    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    topic = models.CharField(max_length=30, choices=Topic.choices, default=Topic.OTHER)
    order = models.PositiveIntegerField(default=0)  # lower comes first in the library
    is_published = models.BooleanField(default=False)  # drafts are visible to admins only
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'title']

    def __str__(self):
        return self.title


class ModuleItem(models.Model):
    """One thing inside a module: reading material (slides, notes, a video link) or an exercise to try."""
    class ItemType(models.TextChoices):
        MATERIAL = 'MATERIAL', 'Material'
        EXERCISE = 'EXERCISE', 'Exercise'

    module = models.ForeignKey(LearningModule, on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.MATERIAL)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)  # an exercise's instructions
    file = models.FileField(upload_to='learning/', blank=True, null=True)
    link_url = models.URLField(blank=True)  # Canva, Google Slides, YouTube...
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.module.title}: {self.title}'


class Workshop(models.Model):
    Kind = Topic  # kept so Workshop.Kind.B40 still reads naturally

    title = models.CharField(max_length=255)
    kind = models.CharField(max_length=30, choices=Topic.choices, default=Topic.OTHER)
    held_on = models.DateField()
    location = models.CharField(max_length=255, blank=True)
    attendees = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    modules = models.ManyToManyField(LearningModule, blank=True, related_name='workshops')  # what was taught
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
