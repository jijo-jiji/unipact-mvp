from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from campaigns.models import Campaign
from payments.models import Payout

from .models import ImpactBaseline, Workshop


def compute():
    """Each figure as {recorded, off_platform, total}, plus whether the homepage may show them."""
    baseline = ImpactBaseline.load()
    today = timezone.localdate()

    held = Workshop.objects.filter(held_on__lte=today)
    paid = Payout.objects.filter(status=Payout.Status.PAID)
    b40_paid = paid.filter(student__b40_record__isnull=False)

    def figure(recorded, off_platform=0):
        return {'recorded': recorded, 'off_platform': off_platform, 'total': recorded + off_platform}

    zero = Decimal('0.00')
    return {
        'show_on_homepage': baseline.show_on_homepage,
        'workshops_held': figure(held.count()),
        'workshop_attendees': figure(held.aggregate(n=Sum('attendees'))['n'] or 0),
        'b40_students_paid': figure(b40_paid.values('student').distinct().count(), baseline.b40_students_paid),
        'b40_amount_paid': figure(b40_paid.aggregate(n=Sum('amount'))['n'] or zero, baseline.b40_amount_paid),
        'students_paid': figure(paid.values('student').distinct().count()),
        'amount_paid': figure(paid.aggregate(n=Sum('amount'))['n'] or zero),
        'projects_delivered': figure(Campaign.objects.filter(status=Campaign.Status.COMPLETED).count(), baseline.projects_delivered),
        'updated_at': baseline.updated_at,
    }


def public():
    """Totals only, never who is B40. Nothing is returned until an admin switches the counter on."""
    stats = compute()
    if not stats['show_on_homepage']:
        return {'published': False}
    keys = ['workshops_held', 'workshop_attendees', 'b40_students_paid', 'b40_amount_paid', 'projects_delivered']
    return {'published': True, **{k: stats[k]['total'] for k in keys}}
