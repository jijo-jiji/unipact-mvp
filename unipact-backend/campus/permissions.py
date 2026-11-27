"""The one permission rule for UniPact Campus.

    can(user, action, unit) is true when the user is a platform admin, or holds a current role assignment
    whose scope covers `unit` and whose role allows `action`.

A role's scope is the unit it is held at and everything below it. Campus-wide roles (Dean, Deputy Deans, Head
of Finance, campus admin, SRC officers) act across their whole campus, because their office sits beside the
sections in the tree rather than above them.
"""
from django.conf import settings
from django.http import Http404
from rest_framework import permissions

from users.models import User

from .models import CampusRole as R
from .models import OrgUnit, RoleAssignment


class Action:
    VIEW_STRUCTURE = 'view_structure'      # see the org tree and who holds which role
    MANAGE_UNITS = 'manage_units'          # add or rename sections, offices, bodies and clubs
    MANAGE_STAFF = 'manage_staff'          # invite staff accounts
    ASSIGN_STAFF_ROLES = 'assign_staff_roles'  # appoint deans, heads, executives, secretaries, advisors, SRC officers
    ASSIGN_STUDENT_ROLES = 'assign_student_roles'  # add members, appoint and change committee positions
    MANAGE_CLUB = 'manage_club'            # edit the club page, decide join requests, post and moderate announcements
    VIEW_CLUB = 'view_club'                # read members-only content: announcements, the full member list


A = Action
_OVERSIGHT = {A.VIEW_STRUCTURE, A.VIEW_CLUB}
ROLE_ACTIONS = {
    R.CAMPUS_ADMIN: {A.VIEW_STRUCTURE, A.MANAGE_UNITS, A.MANAGE_STAFF, A.ASSIGN_STAFF_ROLES, A.ASSIGN_STUDENT_ROLES,
                     A.MANAGE_CLUB, A.VIEW_CLUB},
    R.DEAN: _OVERSIGHT,
    R.DEPUTY_DEAN: _OVERSIGHT,
    R.HEAD_FINANCE: _OVERSIGHT,
    R.HEAD_OF_SECTION: {A.VIEW_STRUCTURE, A.MANAGE_UNITS, A.ASSIGN_STAFF_ROLES, A.ASSIGN_STUDENT_ROLES,
                        A.MANAGE_CLUB, A.VIEW_CLUB},
    R.SECTION_EXECUTIVE: {A.VIEW_STRUCTURE, A.ASSIGN_STUDENT_ROLES, A.MANAGE_CLUB, A.VIEW_CLUB},
    R.GHOCS_SECRETARY: _OVERSIGHT,
    R.ADVISOR: {A.VIEW_STRUCTURE, A.ASSIGN_STUDENT_ROLES, A.MANAGE_CLUB, A.VIEW_CLUB},
    R.CO_ADVISOR: {A.VIEW_STRUCTURE, A.ASSIGN_STUDENT_ROLES, A.MANAGE_CLUB, A.VIEW_CLUB},
    R.SRC_PRESIDENT: _OVERSIGHT,
    R.SRC_TREASURER: _OVERSIGHT,
    R.SRC_EXCO: _OVERSIGHT,
    # UniKLSKILL: high committee members add and remove members, promote, and manage the club page
    R.COMMITTEE: {A.ASSIGN_STUDENT_ROLES, A.MANAGE_CLUB, A.VIEW_CLUB},
    R.MEMBER: {A.VIEW_CLUB},
}

CAMPUS_WIDE_ROLES = {
    R.CAMPUS_ADMIN, R.DEAN, R.DEPUTY_DEAN, R.HEAD_FINANCE, R.SRC_PRESIDENT, R.SRC_TREASURER, R.SRC_EXCO,
}


def campus_enabled():
    return bool(getattr(settings, 'CAMPUS_ENABLED', False))


def is_platform_admin(user):
    return bool(user and user.is_authenticated and user.role == User.Role.ADMIN)


def current_assignments(user):
    if not (user and user.is_authenticated):
        return RoleAssignment.objects.none()
    return RoleAssignment.objects.current().filter(user=user, unit__is_active=True).select_related('unit')


def scope_of(assignment):
    """The unit an assignment's powers reach down from."""
    if assignment.role in CAMPUS_WIDE_ROLES:
        return assignment.unit.campus or assignment.unit
    return assignment.unit


def covers(assignment, unit):
    return scope_of(assignment).pk in unit.lineage_ids()


def can(user, action, unit):
    if is_platform_admin(user):
        return True
    if unit is None:
        return False
    return any(action in ROLE_ACTIONS.get(a.role, ()) and covers(a, unit) for a in current_assignments(user))


def holds(user, roles, unit):
    """Whether the user currently holds one of `roles` with a scope covering `unit` (no admin shortcut)."""
    return any(a.role in roles and covers(a, unit) for a in current_assignments(user))


def visible_units(user):
    """Every unit the user may see the structure of: everything under each scope they can view from."""
    if is_platform_admin(user):
        return OrgUnit.objects.all()
    roots = {scope_of(a).pk for a in current_assignments(user) if A.VIEW_STRUCTURE in ROLE_ACTIONS.get(a.role, ())}
    ids, frontier = set(roots), set(roots)
    while frontier:
        frontier = set(OrgUnit.objects.filter(parent_id__in=frontier).values_list('pk', flat=True)) - ids
        ids |= frontier
    return OrgUnit.objects.filter(pk__in=ids)


def role_action(role):
    """The action needed to appoint someone to `role`. SRC officers are appointed by SDCL, like staff roles."""
    from .models import STAFF_ROLES
    if role in STAFF_ROLES or role in (R.SRC_PRESIDENT, R.SRC_TREASURER, R.SRC_EXCO):
        return A.ASSIGN_STAFF_ROLES
    return A.ASSIGN_STUDENT_ROLES


class CampusEnabled(permissions.BasePermission):
    """Every campus endpoint answers 404 while the feature is switched off."""

    def has_permission(self, request, view):
        if not campus_enabled():
            raise Http404
        return True
