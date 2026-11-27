"""UniPact Campus: a university's own structure and who holds which role in it.

Who someone is (User.role: STUDENT, STAFF...) is kept apart from what they can do and where (RoleAssignment).
A lecturer can advise one club, co-advise another and verify GHOCS claims for a section at the same time; a
student can be SRC Exco, president of one club and a member of two more. See docs/club-system/PLAN.md §3.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class OrgUnit(models.Model):
    """One node of a university's tree: UniKL → UniKL MIIT → Deputy Dean (SDCL) office → Student Development
    Section → a club. Units are data, so another campus with other offices needs no code change."""

    class Kind(models.TextChoices):
        UNIVERSITY = 'UNIVERSITY', 'University'
        CAMPUS = 'CAMPUS', 'Campus / institute'
        OFFICE = 'OFFICE', 'Office (Dean, Deputy Dean, Finance)'
        SECTION = 'SECTION', 'Section (e.g. Student Development)'
        BODY = 'BODY', 'Student body (SRC, RCC, faculty association)'
        CLUB = 'CLUB', 'Club or society'

    class Sector(models.TextChoices):
        # MIIT routes every club and proposal through one of the two SDCL sections
        SD = 'SD', 'Student Development'
        CL = 'CL', 'Campus Lifestyle'

    # What may sit directly under what. A club always hangs off a section (its sector), never off a campus.
    ALLOWED_PARENTS = {
        Kind.UNIVERSITY: (),
        Kind.CAMPUS: (Kind.UNIVERSITY,),
        Kind.OFFICE: (Kind.CAMPUS, Kind.UNIVERSITY),
        Kind.SECTION: (Kind.OFFICE, Kind.CAMPUS),
        Kind.BODY: (Kind.CAMPUS, Kind.UNIVERSITY),
        Kind.CLUB: (Kind.SECTION,),
    }

    parent = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='children')
    kind = models.CharField(max_length=12, choices=Kind.choices)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=40, blank=True)  # e.g. "MIIT", "SD", "SRC"
    sector = models.CharField(max_length=2, choices=Sector.choices, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['kind', 'name']
        constraints = [
            models.UniqueConstraint(fields=['parent', 'name'], name='unique_unit_name_per_parent'),
        ]

    def __str__(self):
        return self.short_name or self.name

    def clean(self):
        allowed = self.ALLOWED_PARENTS.get(self.kind, ())
        if self.parent is None:
            if self.kind != self.Kind.UNIVERSITY:
                raise ValidationError({'parent': f'A {self.get_kind_display().lower()} needs a parent unit.'})
        else:
            if self.parent.kind not in allowed:
                raise ValidationError({'parent': f'A {self.get_kind_display().lower()} cannot sit under a '
                                                 f'{self.parent.get_kind_display().lower()}.'})
            if self.pk and self.pk in self.parent.lineage_ids():
                raise ValidationError({'parent': 'A unit cannot sit under itself.'})
        if self.kind in (self.Kind.SECTION, self.Kind.CLUB) and not self.sector:
            # A club inherits its section's sector unless one is given
            if self.kind == self.Kind.CLUB and self.parent and self.parent.sector:
                self.sector = self.parent.sector

    def save(self, *args, **kwargs):
        if self.kind == self.Kind.CLUB and not self.sector and self.parent_id and self.parent.sector:
            self.sector = self.parent.sector
        super().save(*args, **kwargs)

    def lineage(self):
        """This unit and every unit above it, nearest first. Trees here are a handful of levels deep."""
        node, seen = self, []
        while node is not None and len(seen) < 20:
            seen.append(node)
            node = node.parent
        return seen

    def lineage_ids(self):
        return [unit.pk for unit in self.lineage()]

    def nearest(self, kind):
        """The closest unit of this kind at or above this one (e.g. a club's campus)."""
        return next((unit for unit in self.lineage() if unit.kind == kind), None)

    @property
    def campus(self):
        return self.nearest(self.Kind.CAMPUS)


class StaffProfile(models.Model):
    """A university staff member (User.role STAFF). Their powers come from RoleAssignments, not from here."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_profile')
    full_name = models.CharField(max_length=255)
    staff_id = models.CharField(max_length=40, blank=True)
    title = models.CharField(max_length=255, blank=True)  # job title, e.g. "Senior Executive" or "Lecturer"
    home_unit = models.ForeignKey(OrgUnit, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff')
    phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class CampusRole(models.TextChoices):
    # Staff roles
    CAMPUS_ADMIN = 'CAMPUS_ADMIN', 'Campus administrator (SDCL)'
    DEAN = 'DEAN', 'Dean / Head of Campus'
    DEPUTY_DEAN = 'DEPUTY_DEAN', 'Deputy Dean'
    HEAD_FINANCE = 'HEAD_FINANCE', 'Head of Management & Finance'
    HEAD_OF_SECTION = 'HEAD_OF_SECTION', 'Head of Section'
    SECTION_EXECUTIVE = 'SECTION_EXECUTIVE', 'Section executive'
    GHOCS_SECRETARY = 'GHOCS_SECRETARY', 'GHOCS secretary'
    ADVISOR = 'ADVISOR', 'Club advisor'
    CO_ADVISOR = 'CO_ADVISOR', 'Club co-advisor'
    # Student roles
    SRC_PRESIDENT = 'SRC_PRESIDENT', 'SRC president'
    SRC_TREASURER = 'SRC_TREASURER', 'SRC treasurer'
    SRC_EXCO = 'SRC_EXCO', 'SRC exco'
    COMMITTEE = 'COMMITTEE', 'Committee (high committee)'
    MEMBER = 'MEMBER', 'Member'


STAFF_ROLES = {
    CampusRole.CAMPUS_ADMIN, CampusRole.DEAN, CampusRole.DEPUTY_DEAN, CampusRole.HEAD_FINANCE,
    CampusRole.HEAD_OF_SECTION, CampusRole.SECTION_EXECUTIVE, CampusRole.GHOCS_SECRETARY,
    CampusRole.ADVISOR, CampusRole.CO_ADVISOR,
}
STUDENT_ROLES = {
    CampusRole.SRC_PRESIDENT, CampusRole.SRC_TREASURER, CampusRole.SRC_EXCO, CampusRole.COMMITTEE, CampusRole.MEMBER,
}

# Which kind of unit each role is held at
ROLE_UNIT_KINDS = {
    CampusRole.CAMPUS_ADMIN: (OrgUnit.Kind.CAMPUS, OrgUnit.Kind.UNIVERSITY),
    CampusRole.DEAN: (OrgUnit.Kind.CAMPUS,),
    CampusRole.DEPUTY_DEAN: (OrgUnit.Kind.OFFICE,),
    CampusRole.HEAD_FINANCE: (OrgUnit.Kind.OFFICE,),
    CampusRole.HEAD_OF_SECTION: (OrgUnit.Kind.SECTION,),
    CampusRole.SECTION_EXECUTIVE: (OrgUnit.Kind.SECTION,),
    CampusRole.GHOCS_SECRETARY: (OrgUnit.Kind.SECTION, OrgUnit.Kind.CAMPUS),
    CampusRole.ADVISOR: (OrgUnit.Kind.CLUB,),
    CampusRole.CO_ADVISOR: (OrgUnit.Kind.CLUB,),
    CampusRole.SRC_PRESIDENT: (OrgUnit.Kind.BODY,),
    CampusRole.SRC_TREASURER: (OrgUnit.Kind.BODY,),
    CampusRole.SRC_EXCO: (OrgUnit.Kind.BODY,),
    CampusRole.COMMITTEE: (OrgUnit.Kind.CLUB, OrgUnit.Kind.BODY),
    CampusRole.MEMBER: (OrgUnit.Kind.CLUB, OrgUnit.Kind.BODY),
}


class RoleAssignmentQuerySet(models.QuerySet):
    def current(self, on=None):
        today = on or timezone.localdate()
        return self.filter(ended_at__isnull=True, starts_on__lte=today).filter(
            models.Q(ends_on__isnull=True) | models.Q(ends_on__gte=today))


class RoleAssignment(models.Model):
    """One person holding one role at one unit for one term, e.g. "President of Robotics Club, 2026/2027 Sem 1".
    Ended terms are kept (ended_at set), so transcripts and GHOCS Management Skills can count past roles."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='campus_roles')
    role = models.CharField(max_length=20, choices=CampusRole.choices)
    unit = models.ForeignKey(OrgUnit, on_delete=models.PROTECT, related_name='assignments')
    # Committee position (President, Treasurer...) or SRC Exco portfolio (Academic & Spiritual...)
    position = models.CharField(max_length=100, blank=True)
    session = models.CharField(max_length=40, blank=True)  # e.g. "2026/2027 Sem 1"
    starts_on = models.DateField(default=timezone.localdate)
    ends_on = models.DateField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_reason = models.CharField(max_length=255, blank=True)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    objects = RoleAssignmentQuerySet.as_manager()

    class Meta:
        ordering = ['-starts_on', 'role']
        indexes = [models.Index(fields=['user', 'ended_at']), models.Index(fields=['unit', 'role'])]

    def __str__(self):
        return f'{self.user} — {self.get_role_display()} @ {self.unit}'

    @property
    def is_current(self):
        today = timezone.localdate()
        return (self.ended_at is None and self.starts_on <= today
                and (self.ends_on is None or self.ends_on >= today))

    def clean(self):
        from users.models import User

        kinds = ROLE_UNIT_KINDS.get(self.role, ())
        if self.unit_id and self.unit.kind not in kinds:
            raise ValidationError({'unit': f'{self.get_role_display()} is held at a '
                                           f'{" or ".join(str(OrgUnit.Kind(k).label).lower() for k in kinds)}, '
                                           f'not a {self.unit.get_kind_display().lower()}.'})
        if self.user_id:
            if self.role in STAFF_ROLES and self.user.role not in (User.Role.STAFF, User.Role.ADMIN):
                raise ValidationError({'role': f'{self.get_role_display()} is a staff role; '
                                               f'{self.user.email} is not a staff account.'})
            if self.role in STUDENT_ROLES and self.user.role != User.Role.STUDENT:
                raise ValidationError({'role': f'{self.get_role_display()} is a student role; '
                                               f'{self.user.email} is not a student account.'})
        if self.ends_on and self.ends_on < self.starts_on:
            raise ValidationError({'ends_on': 'The end date is before the start date.'})

    def end(self, reason='', when=None):
        self.ended_at = when or timezone.now()
        self.ended_reason = reason
        self.save(update_fields=['ended_at', 'ended_reason'])
