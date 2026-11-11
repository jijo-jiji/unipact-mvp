from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from campaigns.models import Campaign
from payments.models import Payout

from .models import ImpactSettings, Workshop

PUBLIC_KEYS = ['workshops_held', 'workshop_attendees', 'b40_students_paid', 'b40_amount_paid', 'projects_delivered']


def compute():
    """Every figure, counted only from UniPact's own records since the counting start date (if set)."""
    config = ImpactSettings.load()
    start = config.counting_starts_on

    held = Workshop.objects.filter(held_on__lte=timezone.localdate())
    paid = Payout.objects.filter(status=Payout.Status.PAID, paid_at__isnull=False)
    delivered = Campaign.objects.filter(status=Campaign.Status.COMPLETED)
    if start:
        held = held.filter(held_on__gte=start)
        paid = paid.filter(paid_at__date__gte=start)
        delivered = delivered.filter(completed_at__date__gte=start)
    b40_paid = paid.filter(student__b40_record__isnull=False)

    zero = Decimal('0.00')
    return {
        'workshops_held': held.count(),
        'workshop_attendees': sum(
            w['n'] or w['attendees'] for w in held.annotate(n=Count('checkins')).values('n', 'attendees')
        ),
        'b40_students_paid': b40_paid.values('student').distinct().count(),
        'b40_amount_paid': b40_paid.aggregate(n=Sum('amount'))['n'] or zero,
        'projects_delivered': delivered.count(),
        'students_paid': paid.values('student').distinct().count(),
        'amount_paid': paid.aggregate(n=Sum('amount'))['n'] or zero,
    }


def public():
    """Totals only, never who is B40. Nothing is returned until an admin switches the counter on."""
    if not ImpactSettings.load().show_on_homepage:
        return {'published': False}
    stats = compute()
    return {'published': True, **{k: stats[k] for k in PUBLIC_KEYS}}
