"""Club membership: joining, committee positions and terms."""
from django.db import transaction
from rest_framework import exceptions

from .models import CampusRole as R
from .models import AcademicSession, OrgUnit, RoleAssignment

MEMBERSHIP_ROLES = (R.MEMBER, R.COMMITTEE)
ADVISOR_ROLES = (R.ADVISOR, R.CO_ADVISOR)
COMMITTEE_POSITIONS = ['President', 'Program Director', 'Vice President', 'Secretary', 'Treasurer', 'Exco / AJK']


def term_for(unit):
    """Session label and end date for a new membership: the campus's current session, if it has one set up."""
    session = AcademicSession.current_for(unit.campus)
    return (session.label, session.ends_on) if session else ('', None)


def current_membership(club, user):
    return RoleAssignment.objects.current().filter(unit=club, user=user, role__in=MEMBERSHIP_ROLES).first()


@transaction.atomic
def add_to_club(club, user, role=R.MEMBER, position='', assigned_by=None):
    """Give a student a membership role in a club, replacing any current one (so promote/demote keep history)."""
    if club.kind not in (OrgUnit.Kind.CLUB, OrgUnit.Kind.BODY):
        raise exceptions.ValidationError({'detail': 'Members belong to a club or student body.'})
    existing = current_membership(club, user)
    if existing and existing.role == role and existing.position == position:
        return existing
    if existing:
        existing.end('Role changed')
    session, ends_on = term_for(club)
    assignment = RoleAssignment(user=user, role=role, unit=club, position=position if role == R.COMMITTEE else '',
                                session=session, ends_on=ends_on, assigned_by=assigned_by)
    try:
        assignment.full_clean()
    except Exception as exc:
        raise exceptions.ValidationError(getattr(exc, 'message_dict', {'detail': [str(exc)]}))
    assignment.save()
    return assignment


def appoint_staff(unit, user, role, assigned_by=None):
    if RoleAssignment.objects.current().filter(unit=unit, user=user, role=role).exists():
        return None
    session, _ = term_for(unit)
    assignment = RoleAssignment(user=user, role=role, unit=unit, session=session, assigned_by=assigned_by)
    assignment.full_clean()
    assignment.save()
    return assignment
