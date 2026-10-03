"""Approving milestones: by the client, by an admin, or automatically once the client's review period ends.

Client Service Agreement 4.2-4.3: the client accepts or asks for a revision within 5 working days of
delivery; if they do neither, the deliverable is treated as accepted and payment is released.
"""
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import Campaign, Milestone
from .utils import campaign_escrow, campaign_student_shares, split_by_percent
from .workdays import add_working_days

logger = logging.getLogger(__name__)


class NotAwaitingReview(Exception):
    def __init__(self, milestone):
        self.milestone = milestone


class EscrowShort(Exception):
    """The client hasn't paid in enough to release this milestone."""
    def __init__(self, available, required):
        self.available = available
        self.required = required


def review_due_at(milestone):
    """When a submitted milestone is treated as accepted if the client has done nothing."""
    if milestone.status != Milestone.Status.SUBMITTED or not milestone.submitted_at:
        return None
    return add_working_days(milestone.submitted_at, settings.ACCEPTANCE_WORKING_DAYS)


def approve_milestone(campaign, milestone_id, *, auto=False):
    """Release a submitted milestone's slice of escrow as payouts to the team. Returns (milestone, payouts)."""
    from payments.models import Payout

    with db_transaction.atomic():
        # Lock the campaign (serialises every approval that draws on this project's escrow) and
        # the milestone, then re-check under the lock - so a double-click, two reviewers, or the
        # automatic acceptance running at the same moment can't each release the same money.
        Campaign.objects.select_for_update().get(pk=campaign.pk)
        milestone = Milestone.objects.select_for_update().get(pk=milestone_id, campaign=campaign)
        if milestone.status != Milestone.Status.SUBMITTED:
            raise NotAwaitingReview(milestone)

        escrow = campaign_escrow(campaign)
        if escrow['available'] < milestone.amount:
            raise EscrowShort(escrow['available'], milestone.amount)

        shares = campaign_student_shares(campaign)
        recipients = [s for s in campaign.assigned_students.order_by('id') if shares.get(s.id, Decimal('0')) > 0]
        amounts = split_by_percent(milestone.amount, [shares[s.id] for s in recipients]) if recipients else []
        payouts = []
        for student, amount in zip(recipients, amounts):
            has_bank = student.has_bank_details
            payout, _created = Payout.objects.get_or_create(
                campaign=campaign, student=student, milestone=milestone,
                defaults={
                    'amount': amount,
                    'status': Payout.Status.PROCESSING if has_bank else Payout.Status.PENDING,
                    'bank_name': student.bank_name or '',
                    'bank_account_number': student.bank_account_number or '',
                    'bank_account_holder_name': student.bank_account_holder_name or student.full_name,
                    'duitnow_id': student.duitnow_id or '',
                    'notes': 'Ready for disbursement.' if has_bank else 'Awaiting student bank details.',
                }
            )
            payouts.append(payout)

        milestone.status = Milestone.Status.APPROVED
        milestone.approved_at = timezone.now()
        milestone.auto_approved = auto
        milestone.save()

    from users.models import SystemLog
    from users.utils import log_event
    from unipact_backend import notifications

    how = 'accepted automatically after the review period' if auto else 'approved'
    log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS,
              f"Milestone '{milestone.title}' {how} for '{campaign.title}' - RM {milestone.amount} released to escrow-pending payouts")
    notifications.milestone_approved(campaign, milestone, payouts, auto=auto)
    return milestone, payouts


def auto_accept_due(now=None):
    """Accept every submitted milestone whose review period has ended. Returns how many were accepted.

    A milestone the client hasn't paid enough to cover is left as it is: there is nothing to release."""
    now = now or timezone.now()
    accepted = 0
    waiting = Milestone.objects.filter(
        status=Milestone.Status.SUBMITTED, submitted_at__isnull=False, campaign__status=Campaign.Status.IN_PROGRESS,
    ).select_related('campaign')
    for milestone in waiting:
        if now < review_due_at(milestone):
            continue
        try:
            approve_milestone(milestone.campaign, milestone.id, auto=True)
            accepted += 1
        except (NotAwaitingReview, EscrowShort):
            continue
        except Exception:  # noqa: BLE001 - one bad project must not stop the others
            logger.exception('Could not auto-accept milestone %s', milestone.id)
    return accepted
