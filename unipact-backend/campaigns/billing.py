"""What a client owes right now, under each way a project can be billed.

UPFRONT     the whole project fee, before work starts
MILESTONE   each milestone's share of the fee, before work on that milestone starts (Client Service
            Agreement 3.2): the milestone being worked on now, plus anything earlier still unpaid
MANUAL      nothing is enforced: UniPact invoices and records payments as agreed with the client
"""
from decimal import Decimal

from .models import Campaign, Milestone
from .utils import paid_project_fees, split_by_percent

ZERO = Decimal('0.00')


def milestone_fees(campaign):
    """[(milestone, the client's price for it)], the project fee split by the plan's percentages."""
    milestones = list(campaign.milestones.order_by('step_number', 'id'))
    if not milestones:
        return []
    return list(zip(milestones, split_by_percent(campaign.budget, [m.percentage for m in milestones])))


def current_milestone(campaign):
    """The first milestone not yet approved (the one being worked on, or next to start)."""
    return campaign.milestones.exclude(status=Milestone.Status.APPROVED).order_by('step_number', 'id').first()


def amount_due_now(campaign):
    if campaign.is_volunteer or campaign.payment_structure == Campaign.PaymentStructure.MANUAL:
        return ZERO
    paid = paid_project_fees(campaign)
    fees = milestone_fees(campaign)
    if campaign.payment_structure != Campaign.PaymentStructure.MILESTONE or not fees:
        return max(campaign.budget - paid, ZERO)
    current = current_milestone(campaign)
    funded_through = [m.id for m, _ in fees].index(current.id) if current else len(fees) - 1
    target = sum((amount for _, amount in fees[:funded_through + 1]), ZERO)
    return max(target - paid, ZERO)


def milestone_waiting_for_payment(campaign, milestone):
    """True when, on a pay-per-milestone project, this milestone can't start because its share isn't paid."""
    return (campaign.payment_structure == Campaign.PaymentStructure.MILESTONE and not campaign.is_volunteer
            and amount_due_now(campaign) > 0 and current_milestone(campaign) == milestone)
