"""What one workshop led to: who came, what they felt they learned, and who went on to join and earn."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum

from payments.models import Payout

FOLLOW_UP_DAYS = 90


def _avg(values):
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 1) if values else None


def _pct(part, whole):
    return round(100 * part / whole) if whole else None


def workshop_results(workshop):
    attendees = list(workshop.checkins.select_related('student__user', 'student__b40_record'))
    total = len(attendees)
    held = workshop.held_on
    linked = [a for a in attendees if a.student_id]
    student_ids = {a.student_id for a in linked}

    paid = Payout.objects.filter(student_id__in=student_ids, status=Payout.Status.PAID,
                                 paid_at__isnull=False, paid_at__date__gte=held)
    earned_by = {row['student']: row['total'] for row in paid.values('student').annotate(total=Sum('amount'))}
    within = set(paid.filter(paid_at__date__lte=held + timedelta(days=FOLLOW_UP_DAYS)).values_list('student', flat=True))

    # Confidence change is measured only on people who answered both times, so it compares like with like
    both = [a for a in attendees if a.confidence_after is not None]
    scores = [a.recommend_score for a in attendees if a.recommend_score is not None]
    promoters = sum(1 for s in scores if s >= 9)
    detractors = sum(1 for s in scores if s <= 6)

    earners = len(earned_by)
    total_earned = sum(earned_by.values(), Decimal('0.00'))
    cost = workshop.cost

    def has_b40_record(a):
        return bool(a.student_id) and hasattr(a.student, 'b40_record')

    summary = {
        'attendees': total,
        'b40_self_declared': sum(1 for a in attendees if a.b40_self_declared == 'YES'),
        'b40_verified': sum(1 for a in attendees if has_b40_record(a)),
        'feedback_count': len(both),
        'confidence_before': _avg([a.confidence_before for a in both]),
        'confidence_after': _avg([a.confidence_after for a in both]),
        'recommend_average': _avg(scores),
        'nps': (_pct(promoters, len(scores)) - _pct(detractors, len(scores))) if scores else None,
        'have_account': len(linked),
        'joined_after': sum(1 for a in linked if a.student.user.date_joined.date() >= held),
        'earned': earners,
        'earned_within_90_days': len(within),
        'earned_pct': _pct(earners, total),
        'total_earned': total_earned,
        'cost': cost,
        'cost_per_attendee': round(cost / total, 2) if cost is not None and total else None,
        'cost_per_earner': round(cost / earners, 2) if cost is not None and earners else None,
        'follow_up_days': FOLLOW_UP_DAYS,
    }
    rows = [{
        'id': a.id,
        'full_name': a.full_name,
        'email': a.email,
        'university': a.university,
        'b40_self_declared': a.get_b40_self_declared_display(),
        'confidence_before': a.confidence_before,
        'confidence_after': a.confidence_after,
        'recommend_score': a.recommend_score,
        'feedback_comment': a.feedback_comment,
        'student_name': a.student.full_name if a.student_id else None,
        'earned_since': earned_by.get(a.student_id, Decimal('0.00')) if a.student_id else None,
        'checked_in_at': a.checked_in_at,
    } for a in attendees]
    return {'summary': summary, 'attendees': rows}
