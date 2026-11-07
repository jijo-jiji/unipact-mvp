"""Quotations: UniPact's price for a project, agreed after meeting the client and before students are matched.

Accepting one fixes the project fee, the milestone plan and how the project is invoiced (one payment, or
milestone by milestone). The client may record their purchase order (PO) number, which then appears on
every invoice for the project.
"""
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from io import BytesIO
from xml.sax.saxutils import escape

from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Quotation

CENT = Decimal('0.01')
DEFAULT_VALID_DAYS = 14


def _decimal(value, field, minimum=Decimal('0')):
    try:
        number = Decimal(str(value).replace(',', '').strip())
    except (InvalidOperation, AttributeError):
        raise ValidationError({field: ['Enter a number, e.g. 1500.00.']})
    if not number.is_finite() or number < minimum or number != number.quantize(CENT):
        raise ValidationError({field: ['Enter a number with at most 2 decimal places.']})
    return number


def clean_line_items(items):
    """Returns (line items as stored, total)."""
    if not isinstance(items, list) or not items:
        raise ValidationError({'line_items': ['Add at least one line to the quotation.']})
    cleaned, total = [], Decimal('0')
    for item in items:
        description = str((item or {}).get('description', '')).strip()
        if not description:
            raise ValidationError({'line_items': ['Every line needs a description.']})
        quantity = _decimal(item.get('quantity', 1), 'line_items', Decimal('0.01'))
        unit_price = _decimal(item.get('unit_price'), 'line_items')
        cleaned.append({'description': description[:200], 'quantity': str(quantity), 'unit_price': str(unit_price)})
        total += (quantity * unit_price).quantize(CENT)
    if total <= 0:
        raise ValidationError({'line_items': ['The quotation total must be more than RM 0.']})
    return cleaned, total


def clean_milestones(terms, milestones):
    if terms != Quotation.Terms.MILESTONES:
        return []
    if not isinstance(milestones, list) or len(milestones) < 2:
        raise ValidationError({'milestones': ['Paying by milestone needs at least two milestones.']})
    cleaned = []
    for i, m in enumerate(milestones, start=1):
        title = str((m or {}).get('title', '')).strip() or f'Milestone {i}'
        percentage = _decimal(m.get('percentage'), 'milestones', Decimal('0.01'))
        cleaned.append({'title': title[:200], 'percentage': str(percentage)})
    if sum(Decimal(m['percentage']) for m in cleaned) != 100:
        raise ValidationError({'milestones': ['Milestone percentages must add up to 100.']})
    return cleaned


def send(quotation):
    """Number the quotation, replace any earlier one still open, and email it to the client."""
    from unipact_backend import notifications

    with db_transaction.atomic():
        quotation.campaign.quotations.exclude(pk=quotation.pk).filter(
            status__in=[Quotation.Status.SENT, Quotation.Status.CHANGES_REQUESTED, Quotation.Status.DRAFT],
        ).update(status=Quotation.Status.SUPERSEDED)
        quotation.status = Quotation.Status.SENT
        quotation.sent_at = timezone.now()
        if not quotation.number:
            quotation.save()
            quotation.number = f"QUO-{quotation.sent_at:%Y}-{quotation.pk:05d}"
        quotation.save()
    notifications.quotation_sent(quotation, render_quotation_pdf(quotation))
    return quotation


def accept(quotation, user, accepted_name, po_number='', po_document=None):
    """The client agrees the price. The project fee, milestone plan and billing follow from it."""
    from campaigns.models import Campaign, Milestone
    from campaigns.utils import split_by_percent
    from unipact_backend import notifications

    with db_transaction.atomic():
        campaign = Campaign.objects.select_for_update().get(pk=quotation.campaign_id)
        quotation = Quotation.objects.select_for_update().get(pk=quotation.pk)
        if quotation.status != Quotation.Status.SENT:
            raise ValidationError({'error': 'This quotation is no longer open. Please use the latest one on your project page.'})
        if quotation.valid_until < timezone.localdate():
            raise ValidationError({'error': 'This quotation has expired. Ask UniPact to send you an updated one.'})
        if campaign.is_match_finalized:
            raise ValidationError({'error': 'This project has already started.'})

        quotation.status = Quotation.Status.ACCEPTED
        quotation.responded_at = timezone.now()
        quotation.accepted_by = user
        quotation.accepted_name = accepted_name[:150]
        quotation.po_number = (po_number or '').strip()[:60]
        if po_document:
            quotation.po_document = po_document
        quotation.save()

        campaign.budget = quotation.total
        campaign.payment_structure = (Campaign.PaymentStructure.MILESTONE if quotation.payment_terms == Quotation.Terms.MILESTONES
                                      else Campaign.PaymentStructure.UPFRONT)
        campaign.save(update_fields=['budget', 'payment_structure'])

        # The quotation's milestones become the plan; a one-payment quotation keeps a plan an admin set
        # up, or gets a single "Delivery" milestone
        plan = quotation.milestones or (
            [] if campaign.milestones.exists() else [{'title': 'Delivery', 'percentage': '100'}])
        if plan:
            percentages = [Decimal(m['percentage']) for m in plan]
            campaign.milestones.all().delete()
            for i, (m, pct, amount) in enumerate(zip(plan, percentages, split_by_percent(campaign.student_pool(), percentages)), start=1):
                Milestone.objects.create(campaign=campaign, step_number=i, title=m['title'], percentage=pct, amount=amount)
        else:
            from campaigns.utils import recompute_milestone_amounts
            recompute_milestone_amounts(campaign)

    notifications.quotation_answered(quotation)
    return quotation


def request_changes(quotation, user, message):
    from unipact_backend import notifications

    if quotation.status != Quotation.Status.SENT:
        raise ValidationError({'error': 'This quotation is no longer open.'})
    message = (message or '').strip()
    if not message:
        raise ValidationError({'change_request': ['Tell UniPact what you would like changed.']})
    quotation.status = Quotation.Status.CHANGES_REQUESTED
    quotation.responded_at = timezone.now()
    quotation.change_request = message[:2000]
    quotation.save(update_fields=['status', 'responded_at', 'change_request'])
    notifications.quotation_answered(quotation)
    return quotation


def default_valid_until():
    return timezone.localdate() + timedelta(days=DEFAULT_VALID_DAYS)


def render_quotation_pdf(quotation):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from .invoices import money

    navy, muted = colors.HexColor('#0B1E63'), colors.HexColor('#5B6478')
    body = ParagraphStyle('body', fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.HexColor('#0A1748'))
    small = ParagraphStyle('small', parent=body, fontSize=8.5, leading=11.5, textColor=muted)
    label = ParagraphStyle('label', parent=small, fontName='Helvetica-Bold', textColor=muted)
    heading = ParagraphStyle('heading', parent=body, fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=navy, alignment=TA_RIGHT)
    right = ParagraphStyle('right', parent=body, alignment=TA_RIGHT)
    strong = ParagraphStyle('strong', parent=body, fontName='Helvetica-Bold')

    def p(text, style=body):
        return Paragraph(escape(str(text)).replace('\n', '<br/>'), style)

    width = A4[0] - 40 * mm - 12
    company = quotation.campaign.company
    issued = timezone.localtime(quotation.sent_at or quotation.created_at).strftime('%d %b %Y')

    issuer = [p(settings.INVOICE_ISSUER_NAME, strong), p(f"Registration No. {settings.INVOICE_ISSUER_REGISTRATION_NO}", small),
              p(settings.INVOICE_ISSUER_ADDRESS, small)]
    if settings.SUPPORT_EMAIL:
        issuer.append(p(settings.SUPPORT_EMAIL, small))
    meta = [Paragraph('QUOTATION', heading), Spacer(1, 4), p(f"Quotation no.  {quotation.number or 'Draft'}", right),
            p(f"Date  {issued}", right), p(f"Valid until  {quotation.valid_until:%d %b %Y}", right)]
    header = Table([[issuer, meta]], colWidths=[width - 65 * mm, 65 * mm])
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))

    rows = [[p('Description', label), Paragraph('Qty', ParagraphStyle('q', parent=label, alignment=TA_RIGHT)),
             Paragraph('Unit price', ParagraphStyle('u', parent=label, alignment=TA_RIGHT)),
             Paragraph('Amount', ParagraphStyle('a', parent=label, alignment=TA_RIGHT))]]
    for item in quotation.line_items:
        quantity, unit_price = Decimal(item['quantity']), Decimal(item['unit_price'])
        rows.append([p(item['description']), p(f"{quantity.normalize():f}", right), p(money(unit_price), right),
                     p(money((quantity * unit_price).quantize(CENT)), right)])
    rows.append([p('Total (no SST charged)', strong), '', '',
                 Paragraph(money(quotation.total), ParagraphStyle('total', parent=right, fontName='Helvetica-Bold', fontSize=12))])
    items = Table(rows, colWidths=[width - 85 * mm, 20 * mm, 32 * mm, 33 * mm])
    items.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, 0), 0.6, muted),
        ('LINEABOVE', (0, -1), (-1, -1), 0.6, muted),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    if quotation.payment_terms == Quotation.Terms.MILESTONES:
        from campaigns.utils import split_by_percent
        amounts = split_by_percent(quotation.total, [Decimal(m['percentage']) for m in quotation.milestones])
        terms = [p('PAYMENT TERMS', label), p('Paid milestone by milestone. Each milestone is invoiced, and paid, before work on it starts:')]
        terms += [p(f"{i}. {m['title']}: {Decimal(m['percentage']).normalize():f}% ({money(a)})") for i, (m, a) in enumerate(zip(quotation.milestones, amounts), start=1)]
    else:
        terms = [p('PAYMENT TERMS', label), p('One payment of the full amount before work starts.')]

    story = [header, Spacer(1, 10 * mm), p('PREPARED FOR', label), p(company.company_name, strong), p(company.user.email, small),
             Spacer(1, 4 * mm), p('PROJECT', label), p(quotation.campaign.title, strong)]
    if quotation.scope_notes:
        story += [Spacer(1, 2 * mm), p(quotation.scope_notes, small)]
    story += [Spacer(1, 8 * mm), items, Spacer(1, 8 * mm), *terms, Spacer(1, 6 * mm),
              p('Accept this quotation on your project page at app.unipact.my. You can add your purchase order (PO) number there, '
                'and it will appear on every invoice. Work is carried out under the UniPact Client Service Agreement.', small)]

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"Quotation {quotation.number}", author=settings.INVOICE_ISSUER_NAME)
    doc.build(story)
    return buffer.getvalue()
