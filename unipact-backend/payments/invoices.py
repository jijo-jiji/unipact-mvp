"""Bank-transfer invoices for project fees: issue them, render them as PDF and mark them paid."""
from datetime import timedelta
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import Invoice

CENT = Decimal('0.01')


def invoicing_enabled():
    """Invoices go out automatically only once UniPact's bank details are configured."""
    return bool(settings.UNIPACT_BANK_NAME and settings.UNIPACT_BANK_ACCOUNT_NAME and settings.UNIPACT_BANK_ACCOUNT_NUMBER)


def open_invoice(campaign):
    return campaign.invoices.filter(status=Invoice.Status.ISSUED).first()


def issue_project_invoice(campaign, amount):
    """Return (invoice, created). The open invoice is reused while it is for the same amount, so asking
    again doesn't send a second one; a different amount (after a part payment) replaces it."""
    from campaigns.models import Campaign

    with db_transaction.atomic():
        # Locking the project serialises two clicks arriving together, so only one invoice is created
        campaign = Campaign.objects.select_for_update().get(pk=campaign.pk)
        current = list(Invoice.objects.filter(campaign=campaign, status=Invoice.Status.ISSUED))
        for invoice in current:
            if invoice.amount == amount:
                return invoice, False
        Invoice.objects.filter(pk__in=[i.pk for i in current]).update(status=Invoice.Status.VOID)

        company = campaign.company
        invoice = Invoice.objects.create(
            company=company,
            campaign=campaign,
            amount=amount,
            due_date=timezone.localdate() + timedelta(days=settings.INVOICE_DUE_DAYS),
            bill_to_name=company.company_name,
            bill_to_email=company.user.email,
            project_title=campaign.title,
            service_fee_percent=campaign.resolved_fee_percent(),
            bank_name=settings.UNIPACT_BANK_NAME,
            bank_account_name=settings.UNIPACT_BANK_ACCOUNT_NAME,
            bank_account_number=settings.UNIPACT_BANK_ACCOUNT_NUMBER,
        )
        invoice.number = f"INV-{invoice.issued_at:%Y}-{invoice.pk:05d}"
        invoice.save(update_fields=['number'])
    return invoice, True


def request_bank_transfer(campaign, outstanding):
    """The client chose to pay by bank transfer. Email them an invoice now if UniPact's bank details are
    set up; otherwise ask the admins to invoice by hand, as before. Returns the invoice or None."""
    from unipact_backend import notifications

    if not invoicing_enabled():
        notifications.project_fee_due(campaign, outstanding)
        return None

    invoice, created = issue_project_invoice(campaign, outstanding)
    if created:
        notifications.project_invoice(invoice, render_invoice_pdf(invoice))
        notifications.project_invoice_sent(invoice)
    return invoice


def settle_invoices(campaign):
    """Mark the project's open invoices paid once nothing is outstanding, however the money arrived."""
    from campaigns.utils import paid_project_fees

    if campaign.budget - paid_project_fees(campaign) > 0:
        return 0
    return Invoice.objects.filter(campaign=campaign, status=Invoice.Status.ISSUED).update(
        status=Invoice.Status.PAID, paid_at=timezone.now())


def fee_split(invoice):
    """(UniPact's service fee, the student team's share) of the invoiced amount."""
    team = (invoice.amount * (Decimal('100') - invoice.service_fee_percent) / Decimal('100')).quantize(CENT)
    return invoice.amount - team, team


def money(amount):
    return f"RM {amount:,.2f}"


def render_invoice_pdf(invoice):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    navy, cyan, muted = colors.HexColor('#0B1E63'), colors.HexColor('#00AEEF'), colors.HexColor('#5B6478')
    body = ParagraphStyle('body', fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.HexColor('#0A1748'))
    small = ParagraphStyle('small', parent=body, fontSize=8.5, leading=11.5, textColor=muted)
    label = ParagraphStyle('label', parent=small, fontName='Helvetica-Bold', textColor=muted)
    heading = ParagraphStyle('heading', parent=body, fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=navy, alignment=TA_RIGHT)
    right = ParagraphStyle('right', parent=body, alignment=TA_RIGHT)
    strong = ParagraphStyle('strong', parent=body, fontName='Helvetica-Bold')

    def p(text, style=body):
        return Paragraph(escape(str(text)).replace('\n', '<br/>'), style)

    width = A4[0] - 40 * mm - 12  # 20 mm margins, plus the frame's own 6 pt padding each side
    fee, team = fee_split(invoice)
    issued = timezone.localtime(invoice.issued_at).strftime('%d %b %Y')
    support = settings.SUPPORT_EMAIL

    issuer = [p(settings.INVOICE_ISSUER_NAME, strong),
              p(f"Registration No. {settings.INVOICE_ISSUER_REGISTRATION_NO}", small),
              p(settings.INVOICE_ISSUER_ADDRESS, small)]
    if support:
        issuer.append(p(support, small))
    meta = [Paragraph('INVOICE', heading), Spacer(1, 4),
            p(f"Invoice no.  {invoice.number}", right), p(f"Issued  {issued}", right),
            p(f"Due  {invoice.due_date:%d %b %Y}", right)]
    if invoice.status == Invoice.Status.PAID and invoice.paid_at:
        meta.append(Paragraph(f"PAID {timezone.localtime(invoice.paid_at):%d %b %Y}",
                              ParagraphStyle('paid', parent=right, fontName='Helvetica-Bold', textColor=colors.HexColor('#047857'))))

    header = Table([[issuer, meta]], colWidths=[width - 65 * mm, 65 * mm])
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))

    bill_to = [p('BILL TO', label), p(invoice.bill_to_name, strong), p(invoice.bill_to_email, small)]

    items = Table([
        [p('Description', label), Paragraph('Amount', ParagraphStyle('ar', parent=label, alignment=TA_RIGHT))],
        [[p(f'Project fee: {invoice.project_title}', strong),
          p(f"Held by UniPact in escrow. UniPact's {invoice.service_fee_percent.normalize():f}% service fee ({money(fee)}) is kept for "
            f"matching and managing the project; {money(team)} is paid to the student team as you approve each milestone.", small)],
         p(money(invoice.amount), right)],
        [p('Total due', strong), Paragraph(money(invoice.amount), ParagraphStyle('total', parent=right, fontName='Helvetica-Bold', fontSize=12))],
    ], colWidths=[width - 40 * mm, 40 * mm])
    items.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.6, muted),
        ('LINEBELOW', (0, 1), (-1, 1), 0.4, colors.HexColor('#D6DAE5')),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    payment = Table([
        [p('HOW TO PAY', label), ''],
        [p('Bank'), p(invoice.bank_name, strong)],
        [p('Account name'), p(invoice.bank_account_name, strong)],
        [p('Account number'), p(invoice.bank_account_number, strong)],
        [p('Payment reference'), p(invoice.number, strong)],
    ], colWidths=[45 * mm, width - 45 * mm])
    payment.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F5F7FC')),
        ('LINEBEFORE', (0, 0), (0, -1), 3, cyan),
        ('SPAN', (0, 0), (-1, 0)),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))

    story = [
        header, Spacer(1, 10 * mm), *bill_to, Spacer(1, 8 * mm), items, Spacer(1, 8 * mm), payment, Spacer(1, 4 * mm),
        p(f"Please pay by {invoice.due_date:%d %b %Y} and quote {invoice.number} as the reference so we can match your "
          f"transfer. Your project starts as soon as the payment is recorded, and we email you a receipt.", small),
    ]

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"Invoice {invoice.number}", author=settings.INVOICE_ISSUER_NAME)
    doc.build(story)
    return buffer.getvalue()
