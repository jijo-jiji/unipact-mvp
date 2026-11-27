"""GHOCS points: what a student has earned, and their UniKL DNA transferable-skills web (SC1–SC5).

Four components, as on the official GHOCS transcript:
  UniKL DNA          club activities they attended (awarded when the advisor accepts the activity report) and
                     approved claims for GHOCS-claimable events; points = base × level weight × role weight
  Excellence         approved My Excellence claims; points from the achievement table × level weight
  Skill Development  approved subject claims; points from the subject table
  Management Skills  committee and SRC roles, counted once per club or body per semester

The web: each DNA point counts towards every transferable skill its category maps to (GHOC mapping document),
and each skill is shown against a target, so doing more makes the web bigger. Values come from the campus's
GhocsSettings ("pilot points" until SDCL confirms the official table).
"""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction

from campaigns.workdays import MALAYSIA

from . import ghocs
from .models import Activity, CampusRole, GhocsEntry, GhocsSettings, OrgUnit, RoleAssignment

R = CampusRole
TWO = Decimal('0.01')
SKILLS = {
    'SC1': 'Self Awareness & Integrity',
    'SC2': 'Communication Skills & Professional Sociability',
    'SC3': 'Open Mindedness & Lifelong Learning',
    'SC4': 'Practical, Scientific & Problem Solving Skills',
    'SC5': 'Entrepreneurial Ability',
}
SRC_OFFICER_ROLES = (R.SRC_PRESIDENT, R.SRC_TREASURER, R.SRC_EXCO)


def _d(value):
    return Decimal(str(value or 0))


def entry_points(entry, tables):
    """Points for one entry from its stored inputs, so they can be recalculated with new values."""
    level_weight = _d(tables['level_weights'].get(entry.activity_level, 1))
    if entry.component == GhocsEntry.Component.DNA:
        role_weight = _d(tables['role_weights'].get(entry.role or 'PARTICIPANT', 1))
        return (_d(tables['dna_points']) * level_weight * role_weight).quantize(TWO)
    if entry.component == GhocsEntry.Component.EXCELLENCE:
        return (_d(tables['excellence'].get(entry.achievement, 0)) * level_weight).quantize(TWO)
    return _d(tables['skill_subjects'].get(entry.subject, 0)).quantize(TWO)


@transaction.atomic
def award_activity(activity):
    """Give DNA points to everyone who attended a completed activity. Safe to call again after attendance
    changes: it brings each person's entry up to date."""
    if activity.status != Activity.Status.COMPLETED:
        return 0
    campus = activity.club.campus
    tables = GhocsSettings.for_campus(campus).tables
    count = 0
    for attendance in activity.attendance.select_related('student'):
        entry = GhocsEntry.objects.filter(attendance=attendance).first() or GhocsEntry(
            attendance=attendance, student=attendance.student, campus=campus,
            component=GhocsEntry.Component.DNA, source=GhocsEntry.Source.ACTIVITY)
        entry.title = activity.title
        entry.activity_level = activity.activity_level
        entry.dna_category = activity.dna_category
        entry.merit_elements = activity.report.merit_elements if getattr(activity, 'report', None) and \
            activity.report.merit_elements else activity.merit_elements
        entry.role = attendance.role
        entry.date = activity.starts_at.astimezone(MALAYSIA).date()
        entry.points = entry_points(entry, tables)
        entry.save()
        count += 1
    return count


def award_claim(claim):
    tables = GhocsSettings.for_campus(claim.campus).tables
    component = {claim.Kind.EVENT: GhocsEntry.Component.DNA, claim.Kind.EXCELLENCE: GhocsEntry.Component.EXCELLENCE,
                 claim.Kind.SKILL: GhocsEntry.Component.SKILL}[claim.kind]
    entry = GhocsEntry(student=claim.student, campus=claim.campus, component=component,
                       source=GhocsEntry.Source.CLAIM, claim=claim, title=claim.title,
                       activity_level=claim.activity_level, dna_category=claim.dna_category,
                       merit_elements=claim.merit_elements, role=claim.role, achievement=claim.achievement,
                       subject=claim.subject, date=claim.date, points=0)
    entry.points = entry_points(entry, tables)
    entry.save()
    return entry


@transaction.atomic
def recalculate(campus):
    """Apply the campus's current point values to every entry already given (e.g. when the official table
    replaces the pilot values)."""
    tables = GhocsSettings.for_campus(campus).tables
    changed = 0
    for entry in GhocsEntry.objects.filter(campus=campus):
        points = entry_points(entry, tables)
        if points != entry.points:
            entry.points = points
            entry.save(update_fields=['points'])
            changed += 1
    return changed


def management_terms(user):
    """Committee and SRC roles, one line per club or body per semester (the highest role in it counts)."""
    assignments = RoleAssignment.objects.filter(
        user=user, unit__kind__in=(OrgUnit.Kind.CLUB, OrgUnit.Kind.BODY),
        role__in=(R.COMMITTEE, R.MEMBER) + SRC_OFFICER_ROLES).select_related('unit')
    best = {}
    for a in assignments:
        term = a.session or f'{a.starts_on:%Y}'
        kind = 'SRC_OFFICER' if a.role in SRC_OFFICER_ROLES else a.role
        campus = a.unit.campus
        tables = GhocsSettings.for_campus(campus).tables if campus else {'management': {}}
        points = _d(tables['management'].get(kind, 0))
        key = (a.unit_id, term)
        if key not in best or points > best[key]['points']:
            best[key] = {'unit': a.unit.name, 'unit_id': a.unit_id, 'term': term,
                         'role': a.position or a.get_role_display(), 'points': points}
    return sorted(best.values(), key=lambda t: (t['term'], t['unit']), reverse=True)


def record(user):
    """Everything the GHOCS page and transcript show for one student."""
    entries = list(GhocsEntry.objects.filter(student=user).select_related('campus'))
    totals = defaultdict(Decimal)
    for e in entries:
        totals[e.component] += e.points
    terms = management_terms(user)
    management = sum((t['points'] for t in terms), Decimal('0'))

    skills = {code: Decimal('0') for code in SKILLS}
    by_category = defaultdict(Decimal)
    elements = {code: 0 for code in ghocs.MeritElement.values}
    for e in entries:
        if e.component == GhocsEntry.Component.DNA:
            by_category[e.dna_category] += e.points
            for code in ghocs.DNA_TO_SKILLS.get(e.dna_category, ()):
                skills[code] += e.points
        for m in e.merit_elements or []:
            if m in elements:
                elements[m] += 1

    campus = entries[0].campus if entries else campus_of(user)
    settings_ = GhocsSettings.for_campus(campus) if campus else None
    target = _d(settings_.tables['sc_target']) if settings_ else _d(20)
    web = [{'code': code, 'name': name, 'points': skills[code],
            'percent': float(min(Decimal(100), (skills[code] / target * 100) if target else Decimal(0)).quantize(TWO)),
            'feeds': [ghocs.DnaCategory(c).label for c, scs in ghocs.DNA_TO_SKILLS.items() if code in scs]}
           for code, name in SKILLS.items()]
    total_web = sum(skills.values())
    for row in web:
        row['share'] = float((row['points'] / total_web * 100).quantize(TWO)) if total_web else 0.0
    weakest = min(web, key=lambda r: r['points']) if entries else None

    return {
        'points_label': settings_.label if settings_ else 'Pilot points',
        'official': bool(settings_ and settings_.official),
        'components': {
            'dna': totals[GhocsEntry.Component.DNA],
            'excellence': totals[GhocsEntry.Component.EXCELLENCE],
            'skill_development': totals[GhocsEntry.Component.SKILL],
            'management': management,
        },
        'total': totals[GhocsEntry.Component.DNA] + totals[GhocsEntry.Component.EXCELLENCE]
        + totals[GhocsEntry.Component.SKILL] + management,
        'activity_count': sum(1 for e in entries if e.component == GhocsEntry.Component.DNA),
        'sc_target': target,
        'web': web,
        'by_category': {ghocs.DnaCategory(k).label: v for k, v in by_category.items() if k in ghocs.DnaCategory.values},
        'elements': {ghocs.MeritElement(k).label: v for k, v in elements.items()},
        'hint': {'code': weakest['code'], 'name': weakest['name'], 'categories': weakest['feeds']} if weakest else None,
        'entries': entries,
        'management_terms': terms,
    }


def campus_of(user):
    from .models import PilotAccess
    assignment = RoleAssignment.objects.filter(user=user).select_related('unit').first()
    if assignment and assignment.unit.campus:
        return assignment.unit.campus
    access = PilotAccess.objects.filter(email__iexact=user.email).select_related('campus').first()
    if access:
        return access.campus
    return OrgUnit.objects.filter(kind=OrgUnit.Kind.CAMPUS, is_active=True).order_by('pk').first()
