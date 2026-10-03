"""The time limits the agreements set, checked without a scheduler.

Render's free plan has no cron, so the checks run opportunistically: whenever someone loads a project,
their jobs or the payout lists, at most once every few minutes per server process. `manage.py run_deadlines`
runs the same checks for hosts that do have a scheduler.
"""
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

THROTTLE_KEY = 'unipact:deadlines:last-run'
THROTTLE_SECONDS = 300


def run_deadlines():
    """Accept overdue milestone reviews and remind admins of payouts coming due. Returns a small summary."""
    from payments.payouts import send_payout_reminders
    from .milestones import auto_accept_due

    return {'milestones_accepted': auto_accept_due(), 'payouts_reminded': send_payout_reminders()}


def run_deadlines_if_due():
    """Called from ordinary page loads. Never raises: a problem here must not break the page."""
    try:
        if not cache.add(THROTTLE_KEY, True, THROTTLE_SECONDS):
            return
        run_deadlines()
    except Exception:  # noqa: BLE001
        logger.exception('Deadline checks failed')
