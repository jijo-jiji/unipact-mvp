"""The pilot dashboard: the figures that show the Dean whether UniPact Campus fixed UniKLSKILL's problems.

  P1 scattered club information  → clubs, members, activities and attendance in one place
  P2 GHOCS claims rejected       → points that needed no claim (club activities), claim rejection rate
  P3 slow GHOCS approval         → median days to a decision, oldest waiting
  P4 an opaque skills web        → students whose web covers all five skills
plus how long each approval takes (and which step is slowest), on-time activity reports, and the survey.
"""
from collections import Counter, defaultdict
from datetime import timedelta
from statistics import median

from django.utils import timezone

from campaigns.workdays import MALAYSIA

from . import ghocs
from . import survey as survey_module
from .clubs import MEMBERSHIP_ROLES
from .models import (
    Activity, ActivityPolicy, ApprovalRequest, ApprovalStep, Attendance, GhocsClaim, GhocsEntry, JoinRequest, OrgUnit,
    RoleAssignment, SurveyResponse,
)

DAY = 86400


def _days(delta):
    return round(delta.total_seconds() / DAY, 1)


def _label(choices, value):
    return choices(value).label if value in choices.values else value


def _median(values):
    return round(median(values), 1) if values else None


def campus_clubs(campus):
    return [u for u in OrgUnit.objects.filter(kind=OrgUnit.Kind.CLUB, is_active=True).select_related('parent')
            if u.campus == campus]


def approvals(campus, start, end):
    requests = ApprovalRequest.objects.filter(campus=campus, created_at__date__gte=start, created_at__date__lte=end)
    now = timezone.now()
    rows = []
    for kind, label in ApprovalRequest.Kind.choices:
        items = [r for r in requests if r.kind == kind]
        if not items:
            continue
        decided = [r for r in items if r.status in (ApprovalRequest.Status.APPROVED, ApprovalRequest.Status.REJECTED)]
        pending = [r for r in items if r.status == ApprovalRequest.Status.PENDING]
        rows.append({
            'kind': kind, 'label': label, 'submitted': len(items),
            'approved': sum(r.status == ApprovalRequest.Status.APPROVED for r in items),
            'rejected': sum(r.status == ApprovalRequest.Status.REJECTED for r in items),
            'pending': len(pending),
            'median_days': _median([_days(r.decided_at - r.created_at) for r in decided if r.decided_at]),
            'oldest_pending_days': max((_days(now - r.created_at) for r in pending), default=None),
        })
    return rows


def step_times(campus, start, end):
    """How long each step of the activity chain takes: from the previous signature (or submission) to this one."""
    waits = defaultdict(list)
    activity_requests = ApprovalRequest.objects.filter(campus=campus, kind=ApprovalRequest.Kind.ACTIVITY,
                                                       created_at__date__gte=start, created_at__date__lte=end)
    for request in activity_requests.prefetch_related('steps'):
        previous = request.created_at
        for step in sorted(request.steps.all(), key=lambda s: s.order):
            if step.decision not in (ApprovalStep.Decision.APPROVED, ApprovalStep.Decision.REJECTED) or not step.decided_at:
                break
            waits[step.label].append(_days(step.decided_at - previous))
            previous = step.decided_at
    rows = [{'step': label, 'median_days': _median(values), 'signed': len(values)} for label, values in waits.items()]
    return sorted(rows, key=lambda r: -(r['median_days'] or 0))


def activities(campus, start, end):
    clubs = campus_clubs(campus)
    items = list(Activity.objects.filter(club__in=clubs, starts_at__date__gte=start, starts_at__date__lte=end)
                 .select_related('club'))
    held = [a for a in items if a.status in (Activity.Status.PUBLISHED, Activity.Status.COMPLETED)
            and a.starts_at <= timezone.now()]
    attendance = Counter(Attendance.objects.filter(activity__in=held).values_list('activity_id', flat=True))
    by_category = []
    for code, label in ghocs.DnaCategory.choices:
        in_category = [a for a in held if a.dna_category == code]
        by_category.append({'category': label, 'activities': len(in_category),
                            'attendance': sum(attendance[a.pk] for a in in_category)})
    status = Counter(a.status for a in items)
    return {
        'proposed': len(items),
        'by_status': {label: status.get(code, 0) for code, label in Activity.Status.choices},
        'held': len(held),
        'attendance': sum(attendance.values()),
        'attendance_per_activity': round(sum(attendance.values()) / len(held), 1) if held else None,
        'unique_students': Attendance.objects.filter(activity__in=held).values('student').distinct().count(),
        'by_category': by_category,
        'reports': reports([a for a in held if a.ends_at <= timezone.now()], campus),
    }


def reports(ended, campus):
    due_days = ActivityPolicy.for_campus(campus).report_due_days
    now = timezone.now()
    counts = Counter()
    for a in ended:
        due = a.ends_at + timedelta(days=due_days)
        report = getattr(a, 'report', None)
        first = (report.first_submitted_at or report.submitted_at) if report else None
        if first:
            counts['on_time' if first <= due else 'late'] += 1
        else:
            counts['missing' if now > due else 'not_yet_due'] += 1
    submitted = counts['on_time'] + counts['late']
    return {**{k: counts.get(k, 0) for k in ('on_time', 'late', 'missing', 'not_yet_due')},
            'on_time_rate': round(counts['on_time'] / (submitted + counts['missing']) * 100, 1)
            if (submitted + counts['missing']) else None, 'due_days': due_days}


def ghocs_figures(campus, start, end):
    entries = GhocsEntry.objects.filter(campus=campus, date__gte=start, date__lte=end)
    claims = GhocsClaim.objects.filter(campus=campus, created_at__date__gte=start, created_at__date__lte=end) \
        .select_related('approval')
    decided = [c for c in claims if c.status in (GhocsClaim.Status.APPROVED, GhocsClaim.Status.REJECTED)
               and c.approval.decided_at]
    automatic = entries.filter(source=GhocsEntry.Source.ACTIVITY).count()
    from_claims = entries.filter(source=GhocsEntry.Source.CLAIM).count()
    # Students whose web touches all five skills (P4): from the categories of their DNA points
    skills = defaultdict(set)
    for student, category in GhocsEntry.objects.filter(campus=campus, component=GhocsEntry.Component.DNA) \
            .values_list('student_id', 'dna_category'):
        skills[student].update(ghocs.DNA_TO_SKILLS.get(category, ()))
    return {
        'entries': automatic + from_claims,
        'automatic': automatic,
        'from_claims': from_claims,
        'automatic_share': round(automatic / (automatic + from_claims) * 100, 1) if automatic + from_claims else None,
        'students_with_points': entries.values('student').distinct().count(),
        'balanced_webs': sum(1 for covered in skills.values() if len(covered) == 5),
        'claims': {
            'submitted': len(claims),
            'approved': sum(c.status == GhocsClaim.Status.APPROVED for c in claims),
            'rejected': sum(c.status == GhocsClaim.Status.REJECTED for c in claims),
            'pending': sum(c.status == GhocsClaim.Status.PENDING for c in claims),
            'rejection_rate': round(sum(c.status == GhocsClaim.Status.REJECTED for c in decided) / len(decided) * 100, 1)
            if decided else None,
            'median_days': _median([_days(c.approval.decided_at - c.created_at) for c in decided]),
        },
    }


def clubs_figures(campus, start, end):
    clubs = campus_clubs(campus)
    members = RoleAssignment.objects.current().filter(unit__in=clubs, role__in=MEMBERSHIP_ROLES)
    decided = JoinRequest.objects.filter(club__in=clubs, decided_at__isnull=False, created_at__date__gte=start,
                                         created_at__date__lte=end, status__in=('APPROVED', 'REJECTED'))
    return {
        'clubs': len(clubs),
        'memberships': members.count(),
        'students_in_clubs': members.values('user').distinct().count(),
        'join_requests': decided.count(),
        'join_median_hours': _median([round((r.decided_at - r.created_at).total_seconds() / 3600, 1) for r in decided]),
    }


def survey_figures(campus):
    responses = list(SurveyResponse.objects.filter(campus=campus))
    data = survey_module.results(responses)
    data['by_type'] = dict(Counter(r.respondent_type for r in responses))
    data['comments'] = [r.comment for r in sorted(responses, key=lambda r: r.updated_at, reverse=True) if r.comment][:30]
    return data


def compute(campus, start, end):
    return {
        'campus': {'id': campus.pk, 'name': campus.name},
        'period': {'start': start, 'end': end},
        'clubs': clubs_figures(campus, start, end),
        'activities': activities(campus, start, end),
        'approvals': approvals(campus, start, end),
        'step_times': step_times(campus, start, end),
        'ghocs': ghocs_figures(campus, start, end),
        'survey': survey_figures(campus),
    }


def csv_rows(campus, start, end, table):
    """Rows for the CSV export: one table at a time, with a header row."""
    if table == 'activities':
        rows = [['Approval number', 'Club', 'Activity', 'Status', 'Starts', 'UniKL DNA', 'Level', 'Budget (RM)',
                 'Attendance', 'Days to approval', 'Report']]
        for a in Activity.objects.filter(club__in=campus_clubs(campus), starts_at__date__gte=start,
                                         starts_at__date__lte=end).select_related('club'):
            approval = getattr(a, 'approval', None)
            report = getattr(a, 'report', None)
            rows.append([a.approval_number, a.club.name, a.title, a.get_status_display(),
                         timezone.localtime(a.starts_at, MALAYSIA).strftime('%Y-%m-%d'), _label(ghocs.DnaCategory, a.dna_category),
                         _label(ghocs.ActivityLevel, a.activity_level),
                         f'{a.total_budget}', a.attendance.count(),
                         _days(approval.decided_at - approval.created_at) if approval and approval.decided_at else '',
                         report.get_status_display() if report else ''])
        return rows
    if table == 'claims':
        rows = [['Sent', 'Type', 'Title', 'Status', 'Days to decision']]
        for c in GhocsClaim.objects.filter(campus=campus, created_at__date__gte=start, created_at__date__lte=end) \
                .select_related('approval'):
            rows.append([timezone.localtime(c.created_at, MALAYSIA).strftime('%Y-%m-%d'), c.get_kind_display(), c.title,
                         c.get_status_display(),
                         _days(c.approval.decided_at - c.created_at) if c.approval.decided_at else ''])
        return rows
    rows = [['Sent', 'Type', 'Title', 'Status', 'Days to decision', 'Steps signed']]
    for r in ApprovalRequest.objects.filter(campus=campus, created_at__date__gte=start, created_at__date__lte=end) \
            .prefetch_related('steps'):
        rows.append([timezone.localtime(r.created_at, MALAYSIA).strftime('%Y-%m-%d'), r.get_kind_display(), r.title,
                     r.get_status_display(), _days(r.decided_at - r.created_at) if r.decided_at else '',
                     sum(s.decision == ApprovalStep.Decision.APPROVED for s in r.steps.all())])
    return rows
