from decimal import Decimal
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
from django.db.models import Sum
from .models import CENT, Report
from django.core.files.base import ContentFile


def split_by_percent(total, percentages):
    """Split `total` by `percentages` (which should sum to 100), rounded to the cent.

    The rounding remainder goes on the last part, so the parts always add up to exactly `total` -
    otherwise a 33.33/33.33/33.34 split could leave a stray cent in escrow forever, or release one
    more cent than the client actually paid.
    """
    parts = [(total * Decimal(p) / Decimal('100')).quantize(CENT) for p in percentages[:-1]]
    parts.append(total - sum(parts, Decimal('0')))
    return parts


def paid_project_fees(campaign):
    """Gross total the client has actually paid towards this project (successful PROJECT_FEE rows)."""
    from payments.models import Transaction

    return Transaction.objects.filter(
        related_campaign=campaign,
        transaction_type=Transaction.Type.PROJECT_FEE,
        status=Transaction.Status.SUCCESS,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')


def campaign_escrow(campaign):
    """Money actually collected from the client for this project, vs. already released to students.

    'collected' is net of UniPact's cut: it's the student-facing pool that has been funded so far,
    derived from successful PROJECT_FEE transactions rather than a balance field, so it can never
    drift out of sync with what was actually paid.
    """
    from payments.models import Payout

    collected = campaign.net_of_fee(paid_project_fees(campaign))
    released = Payout.objects.filter(campaign=campaign).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    return {'collected': collected, 'released': released, 'available': collected - released}


def recompute_milestone_amounts(campaign):
    """Re-derive every milestone's amount from its percentage and the campaign's current student
    pool - used when the budget or fee changes after the plan was set (only allowed pre-finalize)."""
    milestones = list(campaign.milestones.order_by('step_number', 'id'))
    if not milestones:
        return
    for milestone, amount in zip(milestones, split_by_percent(campaign.student_pool(), [m.percentage for m in milestones])):
        milestone.amount = amount
        milestone.save(update_fields=['amount', 'updated_at'])


def campaign_student_shares(campaign):
    """Each assigned student's share (0-100) of the project's payout pool.

    Students who joined via an accepted ProjectTeamInvitation (self-serve "invite a collaborator,
    declare their cut" flow) keep the share they were invited at. Whoever admin originally matched
    onto the project (the lead(s) — never invited in) splits whatever percentage is left over. This
    reuses the existing team-invite system instead of a separate per-milestone split model, since at
    pilot scale a campaign's team composition/split doesn't change milestone to milestone.
    """
    from .models import ProjectTeamInvitation

    assigned = list(campaign.assigned_students.all())
    if not assigned:
        return {}

    accepted = ProjectTeamInvitation.objects.filter(
        campaign=campaign,
        status=ProjectTeamInvitation.Status.ACCEPTED,
        invitee_student__in=assigned,
    )
    shares = {}
    invited_total = Decimal('0')
    for inv in accepted:
        pct = Decimal(str(inv.payout_share_percentage))
        shares[inv.invitee_student_id] = shares.get(inv.invitee_student_id, Decimal('0')) + pct
        invited_total += pct

    leads = [s for s in assigned if s.id not in shares]
    remaining = Decimal('100') - min(invited_total, Decimal('100'))
    if leads and remaining > 0:
        each = (remaining / len(leads)).quantize(Decimal('0.01'))
        for s in leads:
            shares[s.id] = shares.get(s.id, Decimal('0')) + each
    elif not leads and remaining > 0:
        # Every assigned student came in through an invite (unusual) - split what's left evenly.
        each = (remaining / len(assigned)).quantize(Decimal('0.01'))
        for s in assigned:
            shares[s.id] = shares.get(s.id, Decimal('0')) + each

    # Invited teammates' declared shares are never cross-validated against each other at invite
    # time (each is only checked to be 0-100 in isolation), so two accepted invites can still add
    # up to more than 100% between them. Normalize here - the last line of defense before this
    # feeds real payout amounts - so the total paid out for a milestone can never exceed its amount.
    total = sum(shares.values())
    if total <= 0:
        each = (Decimal('100') / len(assigned)).quantize(Decimal('0.01'))
        return {s.id: each for s in assigned}
    if total != Decimal('100'):
        shares = {sid: (pct * Decimal('100') / total).quantize(Decimal('0.01')) for sid, pct in shares.items()}

    return shares

def generate_campaign_report(campaign):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    
    # Title
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, 750, f"Campaign Report: {campaign.title}")
    
    # Details
    p.setFont("Helvetica", 12)
    p.drawString(100, 730, f"Company: {campaign.company.company_name}")
    p.drawString(100, 710, f"Budget: {campaign.budget}")
    
    # Awarded application (the report is generated after completion, so include COMPLETED)
    awarded_app = campaign.applications.filter(status__in=['AWARDED', 'SUBMITTED', 'COMPLETED']).first()
    y = 690
    if awarded_app:
        p.drawString(100, y, f"Awarded Club: {awarded_app.club.club_name}")
        p.drawString(100, y - 20, f"University: {awarded_app.club.university}")

        # Deliverables
        p.drawString(100, y - 50, "Deliverables:")
        y -= 70
        for deliverable in awarded_app.deliverables.all():
            p.drawString(120, y, f"- {deliverable.file.name}")
            y -= 20

    # V3.0 assigned student talent and their submissions
    students = list(campaign.assigned_students.all())
    if students:
        p.drawString(100, y, "Assigned Student Talent:")
        y -= 20
        for student in students:
            p.drawString(120, y, f"- {student.full_name} ({student.university})")
            y -= 20
        for deliverable in campaign.student_deliverables.all():
            p.drawString(120, y, f"- {deliverable.title} by {deliverable.student.full_name}")
            y -= 20
    
    p.showPage()
    p.save()
    
    pdf_content = buffer.getvalue()
    buffer.close()
    
    # Save Report
    report, created = Report.objects.get_or_create(campaign=campaign)
    report.generated_pdf.save(f"report_{campaign.id}.pdf", ContentFile(pdf_content))
    return report
