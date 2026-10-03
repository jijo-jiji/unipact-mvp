"""Payout deadlines. Talent Agreement 4.2: UniPact pays the talent within 7 working days after the client
accepts the deliverable. A payout is created at that acceptance, so its due date counts from created_at."""
from django.conf import settings
from django.utils import timezone

from campaigns.workdays import add_working_days

from .models import Payout

UNPAID = (Payout.Status.PROCESSING, Payout.Status.PENDING)
REMIND_WORKING_DAYS_BEFORE = 2


def due_at(payout):
    return add_working_days(payout.created_at, settings.PAYOUT_WORKING_DAYS)


def is_overdue(payout, now=None):
    return payout.status in UNPAID and (now or timezone.now()) > due_at(payout)


def send_payout_reminders(now=None):
    """Email the admins once about each unpaid payout that is within 2 working days of its deadline (or
    past it). Returns how many payouts were included."""
    from unipact_backend import notifications

    now = now or timezone.now()
    remind_after = max(settings.PAYOUT_WORKING_DAYS - REMIND_WORKING_DAYS_BEFORE, 0)
    due_soon = [
        payout for payout in Payout.objects.filter(status__in=UNPAID, reminder_sent_at__isnull=True)
        .select_related('student', 'campaign')
        if now >= add_working_days(payout.created_at, remind_after)
    ]
    if not due_soon:
        return 0
    notifications.payouts_due(due_soon, {p.id: due_at(p) for p in due_soon})
    Payout.objects.filter(pk__in=[p.pk for p in due_soon]).update(reminder_sent_at=now)
    return len(due_soon)
