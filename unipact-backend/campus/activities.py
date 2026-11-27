"""Activity proposals: MIIT's SAF 2026 approval chain, approval numbers, check-in codes and the SAF form PDF.

The chain follows the signature boxes on "Template Proposal SAF 2026" (docs/club-system/PLAN.md §3.4):

    Acknowledged by     SRC Exco for the club's sector          (if the campus uses the SRC steps)
    Supported by        the club advisor
    Reviewed by         the section executive (SD or CL)
    SRC endorsement     SRC President                           (SRC steps on, and the activity has a budget)
    Verified by         the Head of Section
    Recommendation      Head of Management & Finance            (Finance step on, and the activity has a budget)
    Deputy Dean         approves, or recommends when the budget is above the Dean threshold (RM 5,000)
    Dean                approves                                (budget above the threshold only)
"""
import secrets
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from campaigns.workdays import MALAYSIA

from . import ghocs
from .models import ActivityPolicy, CampusClub, OrgUnit
from .models import CampusRole as R

SECTOR_DIGIT = {OrgUnit.Sector.SD: '1', OrgUnit.Sector.CL: '2'}
SRC_PORTFOLIO = {OrgUnit.Sector.SD: 'Academic & Spiritual', OrgUnit.Sector.CL: 'Sports, Recreational & Cultural'}


def has_budget(activity):
    return activity.total_budget > 0 or activity.total_funding > 0


def needs_dean(activity, policy=None):
    policy = policy or ActivityPolicy.for_campus(activity.club.campus)
    return activity.total_budget > policy.dean_threshold


def chain_for(activity):
    """The signature steps this activity needs, in order."""
    club = activity.club
    section, campus = club.parent, club.campus
    office = section.parent if section.parent and section.parent.kind == OrgUnit.Kind.OFFICE else campus
    policy = ActivityPolicy.for_campus(campus)
    budget = has_budget(activity)
    dean = needs_dean(activity, policy)
    portfolio = SRC_PORTFOLIO.get(club.sector)

    steps = []
    if policy.src_steps:
        steps.append({'label': f'Acknowledged by the SRC Exco{f" ({portfolio})" if portfolio else ""}',
                      'roles': [R.SRC_EXCO], 'scope': campus})
    steps.append({'label': 'Supported by the club advisor', 'roles': [R.ADVISOR, R.CO_ADVISOR], 'scope': club})
    steps.append({'label': 'Reviewed by the section executive', 'roles': [R.SECTION_EXECUTIVE], 'scope': section})
    if policy.src_steps and budget:
        steps.append({'label': 'Budget endorsed by the SRC President', 'roles': [R.SRC_PRESIDENT], 'scope': campus})
    steps.append({'label': 'Verified by the Head of Section', 'roles': [R.HEAD_OF_SECTION], 'scope': section})
    if policy.finance_step and budget:
        steps.append({'label': 'Recommended by the Head of Management & Finance', 'roles': [R.HEAD_FINANCE],
                      'scope': campus})
    if dean:
        steps.append({'label': 'Recommended by the Deputy Dean', 'roles': [R.DEPUTY_DEAN], 'scope': office})
        steps.append({'label': 'Approved by the Dean / Head of Campus', 'roles': [R.DEAN], 'scope': campus})
    else:
        steps.append({'label': 'Approved by the Deputy Dean', 'roles': [R.DEPUTY_DEAN], 'scope': office})
    return steps


@transaction.atomic
def club_number(club):
    """The club's two-digit number within its sector at its campus, given on its first approved activity."""
    info = CampusClub.objects.select_for_update().get_or_create(unit=club)[0]
    if info.number:
        return info.number
    siblings = CampusClub.objects.filter(unit__sector=club.sector, unit__parent__parent=club.parent.parent)
    info.number = (siblings.aggregate(top=Max('number'))['top'] or 0) + 1
    info.save(update_fields=['number'])
    return info.number


def issue_approval_number(activity):
    """[1 = SD / 2 = CL][club no.][activity no. this year][year], e.g. 1020525, as on MIIT's ethics declaration."""
    year = timezone.localtime(timezone=MALAYSIA, value=activity.starts_at).year
    yy = f'{year % 100:02d}'
    prefix = f'{SECTOR_DIGIT.get(activity.club.sector, "9")}{club_number(activity.club):02d}'
    taken = activity.__class__.objects.filter(club=activity.club, approval_number__startswith=prefix,
                                              approval_number__endswith=yy).exclude(pk=activity.pk).count()
    activity.approval_number = f'{prefix}{taken + 1:02d}{yy}'
    return activity.approval_number


def new_checkin_code():
    return secrets.token_urlsafe(9)


def money(value):
    return f'RM {Decimal(value or 0):,.2f}'


def render_saf_pdf(activity):
    """The filled "Request for Deputy Dean's / Dean's approval" form, with the online sign-off trail in place of
    the signature boxes. Staff can print it for their files (and for i-STAR during the pilot)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    navy, muted, line = colors.HexColor('#0B1E63'), colors.HexColor('#5B6478'), colors.HexColor('#C9CEDB')
    body = ParagraphStyle('body', fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.HexColor('#0A1748'))
    small = ParagraphStyle('small', parent=body, fontSize=8.5, leading=11, textColor=muted)
    label = ParagraphStyle('label', parent=small, fontName='Helvetica-Bold')
    strong = ParagraphStyle('strong', parent=body, fontName='Helvetica-Bold')
    title = ParagraphStyle('title', parent=body, fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=navy)
    section = ParagraphStyle('section', parent=body, fontName='Helvetica-Bold', fontSize=10.5, leading=14,
                             textColor=navy, spaceBefore=8, spaceAfter=3)

    def p(text, style=body):
        return Paragraph(escape(str(text or '-')).replace('\n', '<br/>'), style)

    club, campus = activity.club, activity.club.campus
    dean = needs_dean(activity)
    width = A4[0] - 36 * mm
    start, end = timezone.localtime(timezone=MALAYSIA, value=activity.starts_at), timezone.localtime(timezone=MALAYSIA, value=activity.ends_at)
    when = start.strftime('%d %b %Y, %I:%M %p') + (f' to {end:%I:%M %p}' if start.date() == end.date()
                                                     else f' to {end:%d %b %Y, %I:%M %p}')

    def grid(rows, widths, header=False):
        table = Table(rows, colWidths=widths)
        style = [('GRID', (0, 0), (-1, -1), 0.5, line), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                 ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
        if header:
            style.append(('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEF1F8')))
        table.setStyle(TableStyle(style))
        return table

    category = [['SECTOR PROPOSER', club.sector or '-'],
                ['BUDGET', 'Above RM 5K' if activity.total_budget > 5000 else 'Below RM 5K'],
                ['SAF (Student Activity Fund)', 'With SAF' if activity.with_saf else 'Without SAF'],
                ['APPROVAL NO.', activity.approval_number or 'Given on approval']]
    story = [
        p(campus.name if campus else '', small),
        p("REQUEST FOR DEAN / HEAD OF CAMPUS APPROVAL" if dean else "REQUEST FOR DEPUTY DEAN'S APPROVAL", title),
        Spacer(1, 3 * mm),
        grid([[p(k, label), p(v)] for k, v in category], [55 * mm, width - 55 * mm]),
        Spacer(1, 3 * mm),
        grid([[p('TO', label), p('Dean / Head of Campus' if dean else 'Deputy Dean (Student Development & Campus Lifestyle)')],
              [p('FROM', label), p(club.name)],
              [p('DATE', label), p(timezone.localtime(timezone=MALAYSIA, value=activity.created_at).strftime('%d %b %Y'))],
              [p('SUBJECT', label), p(f'Proposal: {activity.title}')]], [30 * mm, width - 30 * mm]),
        p('Introduction', section),
        p(f'This paper seeks the approval of the {campus.name if campus else "campus"} management '
          f'{"to provide a budget " if has_budget(activity) else ""}for {activity.title}, to be held on '
          f'{start:%d %b %Y} at {activity.venue}.'),
        p('Background', section), p(activity.background),
        p('Objectives', section),
        p('\n'.join(f'{i}. {o}' for i, o in enumerate(activity.objectives or [], start=1))),
        p('Program overview', section),
        grid([[p('Name of program', label), p(activity.title)], [p('Date and time', label), p(when)],
              [p('Venue', label), p(f'{activity.venue}{"" if activity.on_campus else " (off campus)"}')],
              [p('Level', label), p(ghocs.ActivityLevel(activity.activity_level).label
                                     if activity.activity_level in ghocs.ActivityLevel.values else '-')],
              [p('UniKL DNA category', label), p(ghocs.DnaCategory(activity.dna_category).label
                                                  if activity.dna_category in ghocs.DnaCategory.values else '-')],
              [p('S.P.I.C.E.S', label), p(', '.join(ghocs.MeritElement(m).label for m in activity.merit_elements
                                                     if m in ghocs.MeritElement.values))],
              [p('Expected participants', label), p(activity.expected_participants)]],
             [45 * mm, width - 45 * mm]),
        p('Justification', section), p(activity.justification),
    ]
    if has_budget(activity):
        rows = [[p('No', label), p('Item', label), p('Price', label), p('Qty', label), p('Total (RM)', label)]]
        for i, row in enumerate(activity.budget_items or [], start=1):
            price, qty = Decimal(str(row.get('price') or 0)), Decimal(str(row.get('quantity') or 1))
            rows.append([p(i), p(row.get('item')), p(money(price)), p(f'{qty.normalize():f}'), p(money(price * qty))])
        rows.append(['', p('Total', strong), '', '', p(money(activity.total_budget), strong)])
        story += [p('Financial implication', section),
                  grid(rows, [10 * mm, width - 92 * mm, 28 * mm, 16 * mm, 38 * mm], header=True), Spacer(1, 2 * mm),
                  grid([[p('Budget from', label), p('Student Activity Fund', label), p('UniKL', label),
                         p('Others', label), p('Total', label)],
                        [p(''), p(money(activity.funding_saf)), p(money(activity.funding_campus)),
                         p(money(activity.funding_other)), p(money(activity.total_funding), strong)]],
                       [30 * mm, (width - 30 * mm) / 4] + [(width - 30 * mm) / 4] * 3, header=True)]

    trail = [[p('Step', label), p('Decision', label), p('By', label), p('Date', label)]]
    approval = getattr(activity, 'approval', None)
    if approval:
        for step in approval.steps.select_related('decided_by').order_by('order'):
            who = step.decided_by
            name = ''
            if who:
                profile = getattr(who, 'staff_profile', None) or getattr(who, 'student_profile', None)
                name = getattr(profile, 'full_name', '') or who.email
            trail.append([p(f'{step.order}. {step.label}'), p(step.get_decision_display()), p(name or '-'),
                          p(timezone.localtime(timezone=MALAYSIA, value=step.decided_at).strftime('%d %b %Y') if step.decided_at else '-')])
    creator = activity.created_by
    creator_name = getattr(getattr(creator, 'student_profile', None), 'full_name', '') if creator else ''
    story += [p('Prepared by', section), p(f'{creator_name or (creator.email if creator else "-")}, {club.name}'),
              p('Sign-off (recorded on UniPact Campus)', section),
              grid(trail, [width - 108 * mm, 28 * mm, 50 * mm, 30 * mm], header=True),
              Spacer(1, 3 * mm),
              p('Each decision above was made by the named person signed in to UniPact Campus, which keeps the '
                'record with the time and any comment.', small)]

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                            bottomMargin=16 * mm, title=f'Proposal - {activity.title}', author=club.name)
    doc.build(story)
    return buffer.getvalue()
