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


# ---------------------------------------------------------------------------------------------------------------
# M1: sessions, clubs, membership, proposals, announcements, news, approvals
# ---------------------------------------------------------------------------------------------------------------

class AcademicSession(models.Model):
    """A semester at one campus, e.g. "2026/2027 Sem 1". Club membership is renewed per session, as in GHOCS."""
    campus = models.ForeignKey(OrgUnit, on_delete=models.CASCADE, related_name='sessions',
                               limit_choices_to={'kind': OrgUnit.Kind.CAMPUS})
    label = models.CharField(max_length=40)
    starts_on = models.DateField()
    ends_on = models.DateField()

    class Meta:
        ordering = ['-starts_on']
        constraints = [models.UniqueConstraint(fields=['campus', 'label'], name='unique_session_label_per_campus')]

    def __str__(self):
        return f'{self.campus} {self.label}'

    def clean(self):
        if self.ends_on and self.starts_on and self.ends_on <= self.starts_on:
            raise ValidationError({'ends_on': 'A session must end after it starts.'})
        if self.campus_id and self.campus.kind != OrgUnit.Kind.CAMPUS:
            raise ValidationError({'campus': 'Sessions belong to a campus.'})

    @classmethod
    def current_for(cls, campus, on=None):
        if campus is None:
            return None
        today = on or timezone.localdate()
        return cls.objects.filter(campus=campus, starts_on__lte=today, ends_on__gte=today).first()


class CampusClub(models.Model):
    """What a club shows about itself. The club's place in the tree (its section, campus) is its OrgUnit."""

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        DISSOLVED = 'DISSOLVED', 'Dissolved'

    unit = models.OneToOneField(OrgUnit, on_delete=models.CASCADE, related_name='club',
                                limit_choices_to={'kind': OrgUnit.Kind.CLUB})
    club_type = models.CharField(max_length=12, blank=True)  # ghocs.ClubType
    description = models.TextField(blank=True)
    objectives = models.JSONField(default=list, blank=True)  # list of strings
    dna_category = models.CharField(max_length=20, blank=True)  # ghocs.DnaCategory
    merit_elements = models.JSONField(default=list, blank=True)  # ghocs.MeritElement codes
    location = models.CharField(max_length=255, blank=True)
    joining_criteria = models.TextField(blank=True)
    joining_open = models.BooleanField(default=True)
    logo = models.ImageField(upload_to='campus/club_logos/', blank=True, null=True)
    socials = models.JSONField(default=dict, blank=True)  # {"instagram": url, ...}
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.unit.name

    @classmethod
    def for_unit(cls, unit):
        club, _ = cls.objects.get_or_create(unit=unit)
        return club


class JoinRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'

    club = models.ForeignKey(OrgUnit, on_delete=models.CASCADE, related_name='join_requests')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='club_join_requests')
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [models.UniqueConstraint(fields=['club', 'student'], condition=models.Q(status='PENDING'),
                                               name='one_pending_join_request_per_club')]


class ClubProposal(models.Model):
    """A student's request to start a new club (UniKL student club proposal template + GHOCS "Club Proposal")."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'In review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Not approved'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    section = models.ForeignKey(OrgUnit, on_delete=models.PROTECT, related_name='club_proposals',
                                limit_choices_to={'kind': OrgUnit.Kind.SECTION})
    name = models.CharField(max_length=255)
    club_type = models.CharField(max_length=12)
    dna_category = models.CharField(max_length=20, blank=True)
    merit_elements = models.JSONField(default=list, blank=True)
    description = models.TextField()
    objectives = models.JSONField(default=list)
    proposed_activities = models.JSONField(default=list, blank=True)  # [{name, description, date, cost}]
    target_members = models.CharField(max_length=255, blank=True)
    expected_members = models.PositiveIntegerField(null=True, blank=True)
    benefits = models.TextField(blank=True)
    budget_items = models.JSONField(default=list, blank=True)  # [{item, cost}]
    proposed_advisor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    founding_members = models.JSONField(default=list, blank=True)  # student emails
    document = models.FileField(upload_to='campus/club_proposals/', blank=True, null=True)
    proposer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='club_proposals')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_club = models.OneToOneField(OrgUnit, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Announcement(models.Model):
    club = models.ForeignKey(OrgUnit, on_delete=models.CASCADE, related_name='announcements')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    title = models.CharField(max_length=200)
    body = models.TextField()
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pinned', '-created_at']


class AnnouncementComment(models.Model):
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    body = models.TextField()
    is_hidden = models.BooleanField(default=False)  # hidden by the committee or advisor
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class NewsPost(models.Model):
    """Campus news, or a non-club activity anyone can advertise. SDCL approves before it is shown. A post can be
    GHOCS-claimable, so students who took part can claim points for it later (M4)."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'In review'
        PUBLISHED = 'PUBLISHED', 'Published'
        REJECTED = 'REJECTED', 'Not approved'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    campus = models.ForeignKey(OrgUnit, on_delete=models.CASCADE, related_name='news',
                               limit_choices_to={'kind': OrgUnit.Kind.CAMPUS})
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    title = models.CharField(max_length=200)
    body = models.TextField()
    cover = models.ImageField(upload_to='campus/news/', blank=True, null=True)
    ghocs_claimable = models.BooleanField(default=False)
    activity_level = models.CharField(max_length=14, blank=True)
    dna_category = models.CharField(max_length=20, blank=True)
    merit_elements = models.JSONField(default=list, blank=True)
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-published_at', '-created_at']


class ApprovalRequest(models.Model):
    """Something waiting for sign-off, with its steps in order. One engine serves club proposals and news now,
    and activity proposals (the SAF 2026 chain) and fund applications later."""

    class Kind(models.TextChoices):
        CLUB_PROPOSAL = 'CLUB_PROPOSAL', 'New club'
        NEWS = 'NEWS', 'News post'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'In review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Not approved'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    kind = models.CharField(max_length=20, choices=Kind.choices)
    campus = models.ForeignKey(OrgUnit, on_delete=models.PROTECT, related_name='approval_requests')
    title = models.CharField(max_length=255)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    club_proposal = models.OneToOneField(ClubProposal, on_delete=models.CASCADE, null=True, blank=True,
                                         related_name='approval')
    news_post = models.OneToOneField(NewsPost, on_delete=models.CASCADE, null=True, blank=True, related_name='approval')
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.get_kind_display()}: {self.title}'

    @property
    def current_step(self):
        if self.status != self.Status.PENDING:
            return None
        return self.steps.filter(decision=ApprovalStep.Decision.PENDING).order_by('order').first()


class ApprovalStep(models.Model):
    """One signature box. Whoever holds one of `roles` at (or within) `scope` may sign; if `assignee` is set,
    only that person (e.g. the advisor a club proposal names)."""

    class Decision(models.TextChoices):
        PENDING = 'PENDING', 'Waiting'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Not approved'
        SKIPPED = 'SKIPPED', 'Not needed'

    request = models.ForeignKey(ApprovalRequest, on_delete=models.CASCADE, related_name='steps')
    order = models.PositiveSmallIntegerField()
    label = models.CharField(max_length=100)  # what the form calls this box, e.g. "Endorsed by"
    roles = models.JSONField(default=list)  # CampusRole values
    scope = models.ForeignKey(OrgUnit, on_delete=models.PROTECT, related_name='+')
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='+')
    decision = models.CharField(max_length=10, choices=Decision.choices, default=Decision.PENDING)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ['order']
        constraints = [models.UniqueConstraint(fields=['request', 'order'], name='unique_step_order')]


class PilotAccess(models.Model):
    """A student allowed into UniPact Campus while it runs as a closed pilot (CAMPUS_PILOT_ONLY). Kept by email,
    so SDCL can add students before they sign up; the email matches their UniPact account."""
    campus = models.ForeignKey(OrgUnit, on_delete=models.CASCADE, related_name='pilot_access',
                               limit_choices_to={'kind': OrgUnit.Kind.CAMPUS})
    email = models.EmailField(unique=True)  # stored lower-case
    note = models.CharField(max_length=255, blank=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['email']
        verbose_name_plural = 'pilot access'

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)
