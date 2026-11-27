"""The approval engine: requests with ordered signature steps.

Who may sign a step: the step's `assignee` if it has one; otherwise anyone currently holding one of the step's
roles whose assignment is
  - at the step's scope or inside it (a Head of SD signs a step scoped to the campus), or
  - above it, through an ordinary (not campus-wide) role (a Head of SD signs a step scoped to an SD club).
Campus-wide roles only count at or inside the scope, so a step scoped to the Deputy Dean (SDCL) office can't be
signed by the Deputy Dean (A&T). UniPact admins can sign any step (support and the pilot's first weeks).
"""
from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from .models import ApprovalRequest, ApprovalStep, RoleAssignment
from .permissions import CAMPUS_WIDE_ROLES, covers, is_platform_admin

Decision = ApprovalStep.Decision


def assignment_fits(assignment, step):
    if assignment.role not in step.roles:
        return False
    if step.scope_id in assignment.unit.lineage_ids():
        return True
    return assignment.role not in CAMPUS_WIDE_ROLES and covers(assignment, step.scope)


def can_sign(user, step):
    if step is None or step.decision != Decision.PENDING:
        return False
    if is_platform_admin(user):
        return True
    if step.assignee_id:
        return step.assignee_id == user.pk
    assignments = RoleAssignment.objects.current().filter(user=user, role__in=step.roles, unit__is_active=True)
    return any(assignment_fits(a, step) for a in assignments.select_related('unit'))


def signers(step):
    """Everyone who may sign this step now (to tell them it's waiting)."""
    if step.assignee_id:
        return [step.assignee]
    assignments = RoleAssignment.objects.current().filter(role__in=step.roles, unit__is_active=True) \
        .select_related('unit', 'user')
    seen, people = set(), []
    for a in assignments:
        if a.user_id not in seen and assignment_fits(a, step):
            seen.add(a.user_id)
            people.append(a.user)
    return people


def start(kind, campus, title, submitted_by, steps, **target):
    """Open a request. `steps` is a list of dicts: label, roles, scope, and optionally assignee."""
    request = ApprovalRequest.objects.create(kind=kind, campus=campus, title=title[:255], submitted_by=submitted_by,
                                             **target)
    for order, spec in enumerate(steps, start=1):
        ApprovalStep.objects.create(request=request, order=order, label=spec['label'], roles=list(spec['roles']),
                                    scope=spec['scope'], assignee=spec.get('assignee'))
    _announce(request)
    return request


def decide(request, user, approve, comment=''):
    """Sign the current step. Rejecting ends the request; approving the last step completes it."""
    from . import outcomes

    with transaction.atomic():
        request = ApprovalRequest.objects.select_for_update().get(pk=request.pk)
        step = request.current_step
        if step is None:
            raise exceptions.ValidationError({'detail': 'This request has already been decided.'})
        if not can_sign(user, step):
            raise exceptions.PermissionDenied('This step is waiting for someone else.')
        if not approve and not comment.strip():
            raise exceptions.ValidationError({'comment': 'Say why, so the applicant can fix it.'})
        step.decision = Decision.APPROVED if approve else Decision.REJECTED
        step.decided_by = user
        step.decided_at = timezone.now()
        step.comment = comment.strip()
        step.save()

        finished = not approve or request.current_step is None
        if finished:
            request.status = ApprovalRequest.Status.APPROVED if approve else ApprovalRequest.Status.REJECTED
            request.decided_at = timezone.now()
            request.save(update_fields=['status', 'decided_at'])
            # Steps after a rejection are never reached
            request.steps.filter(decision=Decision.PENDING).update(decision=Decision.SKIPPED)
            outcomes.finished(request, decided_by=user)
    if not finished:
        _announce(request)
    return request


def withdraw(request, user):
    from . import outcomes

    if request.submitted_by_id != user.pk:
        raise exceptions.PermissionDenied('Only the person who sent this can withdraw it.')
    if request.status != ApprovalRequest.Status.PENDING:
        raise exceptions.ValidationError({'detail': 'This request has already been decided.'})
    with transaction.atomic():
        request.status = ApprovalRequest.Status.WITHDRAWN
        request.decided_at = timezone.now()
        request.save(update_fields=['status', 'decided_at'])
        request.steps.filter(decision=Decision.PENDING).update(decision=Decision.SKIPPED)
        outcomes.finished(request, decided_by=user)
    return request


def inbox(user):
    """Pending requests whose current step this person may sign."""
    pending = ApprovalRequest.objects.filter(status=ApprovalRequest.Status.PENDING) \
        .select_related('campus', 'submitted_by').prefetch_related('steps__scope')
    return [r for r in pending if can_sign(user, r.current_step)]


def _announce(request):
    from . import emails

    step = request.current_step
    if step is not None:
        emails.approval_waiting(request, step, signers(step))
