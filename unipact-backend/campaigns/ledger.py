"""Verified Impact Ledger: a student's public, client-confirmed proof of work for one project."""
from decimal import Decimal

from django.db.models import Avg, Sum

from .models import Campaign, ImpactLedger, ProjectImpactReport, ProjectTeamInvitation


def ensure_ledgers(campaign):
    """Make sure a completed project has its client report and one ledger per assigned student.

    Safe to call repeatedly; also backfills projects completed before ledgers existed.
    """
    report, _ = ProjectImpactReport.objects.get_or_create(campaign=campaign)
    for student in campaign.assigned_students.all():
        ImpactLedger.objects.get_or_create(campaign=campaign, student=student)
    return report


def recompute_student_rating(student):
    """A student's rating is the average client rating across their completed projects."""
    avg = ProjectImpactReport.objects.filter(
        campaign__assigned_students=student,
        campaign__status=Campaign.Status.COMPLETED,
        client_rating__isnull=False,
    ).aggregate(avg=Avg('client_rating'))['avg']
    if avg is not None:
        student.rating = Decimal(str(avg)).quantize(Decimal('0.01'))
        student.save(update_fields=['rating'])


def is_report_locked(campaign):
    return campaign.impact_ledgers.filter(status=ImpactLedger.Status.PUBLISHED).exists()


def student_bounty(ledger):
    """What this student was actually paid for the project, and whether all of it has been released."""
    payouts = ledger.campaign.payouts.filter(student=ledger.student)
    paid = payouts.filter(status='PAID').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    released = payouts.exists() and not payouts.exclude(status='PAID').exists()
    return paid, released


def readiness(ledger):
    report = getattr(ledger.campaign, 'impact_report', None)
    _, released = student_bounty(ledger)
    checks = {
        'project_completed': ledger.campaign.status == Campaign.Status.COMPLETED,
        'client_signed': bool(report and report.signed_at),
        'student_submitted': bool(ledger.student_submitted_at),
        'escrow_released': released,
    }
    checks['ready'] = all(checks.values())
    return checks


def execution_days(campaign):
    if not (campaign.started_at and campaign.completed_at):
        return None
    return max(1, (campaign.completed_at.date() - campaign.started_at.date()).days)


def student_prefill(ledger):
    """Starting values for the student's part, from what they already told us on the project."""
    campaign, student = ledger.campaign, ledger.student
    invite = ProjectTeamInvitation.objects.filter(
        campaign=campaign, invitee_student=student, status=ProjectTeamInvitation.Status.ACCEPTED
    ).first()
    deliverable = campaign.student_deliverables.filter(student=student).order_by('-submitted_at').first()
    milestone_url = campaign.milestones.exclude(deliverable_url__isnull=True).exclude(deliverable_url='').order_by('-step_number').values_list('deliverable_url', flat=True).first()
    solo = campaign.assigned_students.count() == 1
    return {
        'role': (invite.role_in_project if invite else None) or (deliverable.contribution_role if deliverable else '') or ('Solo Contributor' if solo else 'Project Lead'),
        'technical_solution': deliverable.contribution_summary if deliverable else '',
        'proof_url': (deliverable.external_url if deliverable and deliverable.external_url else None) or milestone_url or '',
    }


def _media_url(request, file_field):
    if not file_field:
        return None
    return request.build_absolute_uri(file_field.url) if request else file_field.url


def ledger_payload(ledger, request=None):
    campaign, student = ledger.campaign, ledger.student
    report = getattr(campaign, 'impact_report', None)
    bounty, released = student_bounty(ledger)
    return {
        'slug': ledger.slug,
        'status': ledger.status,
        'published_at': ledger.published_at,
        'readiness': readiness(ledger),
        'bounty_id': f"UP-{campaign.id:03d}",
        'student': {
            'user_id': student.user_id,
            'full_name': student.full_name,
            'university': student.university,
            'major': student.major,
            'role': ledger.role,
        },
        'project': {
            'id': campaign.id,
            'title': campaign.title,
            'type': campaign.type,
            'client_name': campaign.company.company_name,
            'client_industry': report.client_industry if report else '',
            'execution_days': execution_days(campaign),
            'completed_at': campaign.completed_at,
        },
        'business_pain_point': report.business_pain_point if report else '',
        'technical_solution': ledger.technical_solution,
        'metrics': report.metrics if report else [],
        'bounty_value': bounty,
        'escrow_released': released,
        'verified_skills': report.verified_skills if report else [],
        'proof': {
            'url': ledger.proof_url,
            'before_image': _media_url(request, ledger.before_image),
            'before_caption': ledger.before_caption,
            'after_image': _media_url(request, ledger.after_image),
            'after_caption': ledger.after_caption,
        },
        'testimonial': {
            'quote': report.testimonial if report else '',
            'signer_name': report.signer_name if report else '',
            'signer_title': report.signer_title if report else '',
            'signed_at': report.signed_at if report else None,
        },
    }
