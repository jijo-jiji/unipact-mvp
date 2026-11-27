"""M4 endpoints: a student's GHOCS record and spider web, claims, the transcript PDF, and the points settings."""
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from campaigns.workdays import MALAYSIA
from unipact_backend.validators import validate_document_upload
from users.models import SystemLog, User
from users.utils import log_event

from . import approvals, ghocs
from .models import (
    ApprovalRequest, Attendance, GhocsClaim, GhocsEntry, GhocsSettings, NewsPost, OrgUnit, RoleAssignment,
)
from .models import CampusRole as R
from .permissions import Action, can
from .points import campus_of, recalculate, record
from .serializers import MeritElementsField, PersonSerializer, UnitBriefSerializer
from .views import CAMPUS, require

UPLOADS = [JSONParser, MultiPartParser, FormParser]


# --- Serializers ---------------------------------------------------------------------------------------------

class EntrySerializer(serializers.ModelSerializer):
    component_label = serializers.CharField(source='get_component_display', read_only=True)
    source_label = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = GhocsEntry
        fields = ['id', 'component', 'component_label', 'source', 'source_label', 'title', 'activity_level',
                  'dna_category', 'merit_elements', 'role', 'achievement', 'subject', 'points', 'date']


class ClaimSerializer(serializers.ModelSerializer):
    merit_elements = MeritElementsField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    student = PersonSerializer(read_only=True)
    approval_id = serializers.SerializerMethodField()
    points = serializers.SerializerMethodField()
    campus = serializers.PrimaryKeyRelatedField(queryset=OrgUnit.objects.filter(kind=OrgUnit.Kind.CAMPUS),
                                                required=False)

    class Meta:
        model = GhocsClaim
        fields = ['id', 'kind', 'kind_label', 'campus', 'title', 'news_post', 'activity_level', 'dna_category',
                  'merit_elements', 'role', 'achievement', 'rank', 'group_award', 'subject', 'date', 'description',
                  'evidence', 'status', 'status_label', 'student', 'approval_id', 'points', 'created_at']
        read_only_fields = ['status', 'created_at']
        extra_kwargs = {'title': {'required': False}, 'date': {'required': False}}

    def get_approval_id(self, claim):
        approval = getattr(claim, 'approval', None)
        return approval.pk if approval else None

    def get_points(self, claim):
        entry = getattr(claim, 'entry', None)
        return entry.points if entry else None

    def validate_evidence(self, value):
        return validate_document_upload(value, 'Evidence')

    def validate(self, attrs):
        kind = attrs.get('kind')
        student = self.context['request'].user
        if kind == GhocsClaim.Kind.EVENT:
            post = attrs.get('news_post')
            if not post or post.status != NewsPost.Status.PUBLISHED or not post.ghocs_claimable:
                raise serializers.ValidationError({'news_post': ['Choose a GHOCS-claimable event from the news.']})
            if GhocsClaim.objects.filter(student=student, news_post=post).exclude(
                    status__in=(GhocsClaim.Status.REJECTED, GhocsClaim.Status.WITHDRAWN)).exists():
                raise serializers.ValidationError({'news_post': ['You already claimed this event.']})
            # The event decides the category, level and elements: the student can't pick the wrong ones
            attrs.update(campus=post.campus, title=post.title, activity_level=post.activity_level,
                         dna_category=post.dna_category, merit_elements=post.merit_elements,
                         date=post.starts_on or timezone.localdate(timezone=MALAYSIA))
            if attrs.get('role') not in Attendance.Role.values:
                attrs['role'] = Attendance.Role.PARTICIPANT
        elif kind == GhocsClaim.Kind.EXCELLENCE:
            missing = [f for f in ('title', 'achievement', 'activity_level', 'date') if not attrs.get(f)]
            if missing:
                raise serializers.ValidationError({f: ['This field is required.'] for f in missing})
            if attrs['achievement'] not in GhocsClaim.Achievement.values:
                raise serializers.ValidationError({'achievement': ['Choose an achievement from the list.']})
            if attrs['activity_level'] not in ghocs.ActivityLevel.values:
                raise serializers.ValidationError({'activity_level': ['Choose a level from the list.']})
            attrs['news_post'] = None
        elif kind == GhocsClaim.Kind.SKILL:
            if not attrs.get('subject') or not attrs.get('date'):
                raise serializers.ValidationError({'subject': ['Choose the subject and the date you passed it.']})
            attrs['title'] = attrs['subject']
            attrs['news_post'] = None
        else:
            raise serializers.ValidationError({'kind': ['Choose event, excellence or skill development.']})
        attrs['campus'] = attrs.get('campus') or campus_of(student)
        if attrs['campus'] is None:
            raise serializers.ValidationError({'campus': ['Choose your campus.']})
        if kind == GhocsClaim.Kind.SKILL:
            subjects = GhocsSettings.for_campus(attrs['campus']).tables['skill_subjects']
            if attrs['subject'] not in subjects:
                raise serializers.ValidationError({'subject': ['Choose a subject from the list.']})
        return attrs


class SettingsSerializer(serializers.ModelSerializer):
    campus = UnitBriefSerializer(read_only=True)

    class Meta:
        model = GhocsSettings
        fields = ['campus', 'label', 'official', 'tables', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_tables(self, value):
        from .models import default_ghocs_tables
        if not isinstance(value, dict):
            raise serializers.ValidationError('Send the point tables as an object.')
        # Fill what wasn't sent from the campus's current values (not the defaults), so changing one number
        # keeps the rest
        current = self.instance.tables if self.instance else default_ghocs_tables()
        cleaned = {}
        for key, default in default_ghocs_tables().items():
            base = current.get(key, default)
            given = value.get(key, base)
            if isinstance(default, dict) and isinstance(given, dict) and isinstance(base, dict):
                given = {**base, **given}
            try:
                if isinstance(default, dict):
                    if not isinstance(given, dict) or len(given) > 50:
                        raise ValueError
                    cleaned[key] = {str(k)[:60]: float(Decimal(str(v))) for k, v in given.items()}
                    if any(v < 0 for v in cleaned[key].values()):
                        raise ValueError
                else:
                    cleaned[key] = float(Decimal(str(given)))
                    if cleaned[key] < 0 or (key == 'sc_target' and cleaned[key] <= 0):
                        raise ValueError
            except (ValueError, ArithmeticError):
                raise serializers.ValidationError({key: ['Use numbers of 0 or more.']})
        return cleaned


# --- Views ---------------------------------------------------------------------------------------------------

def record_payload(user):
    data = record(user)
    data['entries'] = EntrySerializer(data['entries'], many=True).data
    return data


class MyGhocsView(APIView):
    """My GHOCS record: points by component, the spider web, history, management terms, claims."""
    permission_classes = CAMPUS

    def get(self, request):
        data = record_payload(request.user)
        claims = GhocsClaim.objects.filter(student=request.user).select_related('campus')
        data['claims'] = ClaimSerializer(claims, many=True, context={'request': request}).data
        campus = campus_of(request.user)
        data['skill_subjects'] = sorted(GhocsSettings.for_campus(campus).tables['skill_subjects']) if campus else []
        data['achievements'] = [{'value': v, 'label': label} for v, label in GhocsClaim.Achievement.choices]
        return Response(data)


class ClaimListView(APIView):
    """POST: claim points for an event from the news, an Excellence achievement or a Skill Development subject,
    with evidence. It goes to the GHOCS secretary (oldest claims first)."""
    permission_classes = CAMPUS
    parser_classes = UPLOADS

    def post(self, request):
        if request.user.role != User.Role.STUDENT:
            raise exceptions.PermissionDenied('GHOCS claims are for students.')
        serializer = ClaimSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            claim = serializer.save(student=request.user)
            approvals.start(ApprovalRequest.Kind.GHOCS_CLAIM, claim.campus, f'{claim.get_kind_display()}: {claim.title}',
                            request.user, [{'label': 'Verified by the GHOCS secretary', 'roles': [R.GHOCS_SECRETARY],
                                            'scope': claim.campus}], ghocs_claim=claim)
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO, f'GHOCS claim sent by {request.user.email}')
        return Response(ClaimSerializer(claim, context={'request': request}).data, status=status.HTTP_201_CREATED)


class ClaimableEventsView(APIView):
    """GHOCS-claimable events from the news that I haven't claimed yet."""
    permission_classes = CAMPUS

    def get(self, request):
        claimed = GhocsClaim.objects.filter(student=request.user).exclude(
            status__in=(GhocsClaim.Status.REJECTED, GhocsClaim.Status.WITHDRAWN)).values_list('news_post_id', flat=True)
        posts = NewsPost.objects.filter(status=NewsPost.Status.PUBLISHED, ghocs_claimable=True) \
            .exclude(pk__in=[p for p in claimed if p]).order_by('-starts_on')[:50]
        return Response([{'id': p.pk, 'title': p.title, 'starts_on': p.starts_on, 'activity_level': p.activity_level,
                          'dna_category': p.dna_category, 'merit_elements': p.merit_elements} for p in posts])


class TranscriptPdfView(APIView):
    permission_classes = CAMPUS

    def get(self, request):
        response = HttpResponse(render_transcript(request.user), content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="GHOCS-transcript-pilot.pdf"'
        return response


class SettingsView(APIView):
    """GET/PATCH ?campus=<id>: the campus's GHOCS point values. PATCH with apply_to_existing=true recalculates
    points already given (e.g. when the official table replaces the pilot values)."""
    permission_classes = CAMPUS

    def campus(self, request):
        return get_object_or_404(OrgUnit, pk=request.query_params.get('campus') or request.data.get('campus'),
                                 kind=OrgUnit.Kind.CAMPUS)

    def get(self, request):
        campus = self.campus(request)
        require(request.user, Action.VIEW_STRUCTURE, campus)
        return Response(SettingsSerializer(GhocsSettings.for_campus(campus)).data)

    def patch(self, request):
        campus = self.campus(request)
        require(request.user, Action.MANAGE_UNITS, campus)
        serializer = SettingsSerializer(GhocsSettings.for_campus(campus), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        changed = recalculate(campus) if str(request.data.get('apply_to_existing')).lower() in ('true', '1') else 0
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'GHOCS point values for {campus.name} changed by {request.user.email}; {changed} entries recalculated')
        return Response({**serializer.data, 'recalculated': changed})


OVERSIGHT_ROLES = (R.CAMPUS_ADMIN, R.DEAN, R.DEPUTY_DEAN, R.HEAD_OF_SECTION, R.SECTION_EXECUTIVE, R.GHOCS_SECRETARY)


def works_at(user, campus):
    """UniPact admins, and staff holding an oversight role anywhere in this campus (e.g. a GHOCS secretary at the
    SD section), can open a student's record."""
    if can(user, Action.MANAGE_UNITS, campus):
        return True
    return any(a.unit.campus == campus for a in RoleAssignment.objects.current()
               .filter(user=user, role__in=OVERSIGHT_ROLES).select_related('unit'))


class StudentGhocsView(APIView):
    """A student's record, for GHOCS secretaries and campus oversight roles at the student's campus."""
    permission_classes = CAMPUS

    def get(self, request, user_id):
        student = get_object_or_404(User, pk=user_id, role=User.Role.STUDENT)
        campus = campus_of(student)
        if not (campus and works_at(request.user, campus)):
            raise exceptions.PermissionDenied()
        return Response({'student': PersonSerializer(student).data, **record_payload(student)})


# --- Transcript PDF ------------------------------------------------------------------------------------------

def render_transcript(user):
    """A printable GHOCS record in the layout of the official transcript: points by component, the transferable
    skills with their web, and the activities behind them. Marked as a pilot record."""
    from reportlab.graphics.shapes import Drawing, Line, PolyLine, Polygon, String
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    import math

    data = record(user)
    navy, muted, cyan, line = (colors.HexColor('#0B1E63'), colors.HexColor('#5B6478'), colors.HexColor('#00AEEF'),
                               colors.HexColor('#C9CEDB'))
    body = ParagraphStyle('b', fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.HexColor('#0A1748'))
    small = ParagraphStyle('s', parent=body, fontSize=8.5, leading=11, textColor=muted)
    label = ParagraphStyle('l', parent=small, fontName='Helvetica-Bold')
    strong = ParagraphStyle('st', parent=body, fontName='Helvetica-Bold')
    title = ParagraphStyle('t', parent=body, fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=navy)
    section = ParagraphStyle('h', parent=body, fontName='Helvetica-Bold', fontSize=10.5, textColor=navy, spaceBefore=8,
                             spaceAfter=3)

    def p(text, style=body):
        return Paragraph(escape(str(text if text not in (None, '') else '-')), style)

    def pts(value):
        return f'{Decimal(value).normalize():f}'

    def grid(rows, widths):
        t = Table(rows, colWidths=widths)
        t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, line), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEF1F8')),
                               ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 3),
                               ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
        return t

    profile = getattr(user, 'student_profile', None)
    campus = campus_of(user)
    width = A4[0] - 36 * mm
    c = data['components']
    story = [
        p(campus.name if campus else 'UniKL', small),
        p('GHOCS ACTIVITY SUMMARY', title),
        p(f"PILOT RECORD from UniPact Campus, not an official GHOCS transcript. Points: {data['points_label']}.", label),
        Spacer(1, 3 * mm),
        grid([[p('Student name', label), p(getattr(profile, 'full_name', '') or user.email)],
              [p('Email', label), p(user.email)],
              [p('Issued', label), p(timezone.localtime(timezone=MALAYSIA).strftime('%d %b %Y'))]],
             [40 * mm, width - 40 * mm]),
        p('Total GHOCS points by component', section),
        grid([[p('Component', label), p('Points', label)],
              [p('Skill Development'), p(pts(c['skill_development']))], [p('UniKL DNA'), p(pts(c['dna']))],
              [p('Excellence'), p(pts(c['excellence']))], [p('Management Skills'), p(pts(c['management']))],
              [p('Cumulative GHOCS points', strong), p(pts(data['total']), strong)],
              [p('Total GHOCS activities'), p(data['activity_count'])]], [width - 40 * mm, 40 * mm]),
        p('UniKL DNA transferable skills', section),
    ]
    # Spider web (pentagon), each skill against the campus target
    size, centre, radius = 70 * mm, 35 * mm, 24 * mm
    drawing = Drawing(size, size)
    angles = [math.pi / 2 - i * 2 * math.pi / 5 for i in range(5)]
    for ring in (0.25, 0.5, 0.75, 1):
        drawing.add(PolyLine([v for a in angles + angles[:1] for v in (centre + radius * ring * math.cos(a),
                                                                       centre + radius * ring * math.sin(a))],
                             strokeColor=line, strokeWidth=0.5 if ring < 1 else 0.8))
    for a, row in zip(angles, data['web']):
        drawing.add(Line(centre, centre, centre + radius * math.cos(a), centre + radius * math.sin(a), strokeColor=line,
                         strokeWidth=0.5))
        drawing.add(String(centre + (radius + 7) * math.cos(a), centre + (radius + 7) * math.sin(a) - 3, row['code'],
                           fontName='Helvetica-Bold', fontSize=7.5, fillColor=navy, textAnchor='middle'))
    points = [v for a, row in zip(angles, data['web']) for v in (
        centre + radius * (row['percent'] / 100) * math.cos(a), centre + radius * (row['percent'] / 100) * math.sin(a))]
    drawing.add(Polygon(points, fillColor=colors.Color(0, 0.68, 0.94, alpha=0.25), strokeColor=cyan, strokeWidth=1.5))
    skills = grid([[p('Skill', label), p('Points', label), p(f"% of target ({pts(data['sc_target'])})", label)]] +
                  [[p(f"{row['name']} ({row['code']})"), p(pts(row['points'])), p(f"{row['percent']:.0f}%")]
                   for row in data['web']], [width - 70 * mm - 52 * mm, 22 * mm, 30 * mm])
    story.append(Table([[skills, drawing]], colWidths=[width - 70 * mm, 70 * mm],
                       style=TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 0)])))

    entries = [e for e in data['entries']]
    if entries:
        rows = [[p('Date', label), p('Activity or claim', label), p('Component', label), p('Points', label)]]
        rows += [[p(e.date.strftime('%d %b %Y')), p(e.title), p(e.get_component_display()), p(pts(e.points))]
                 for e in entries]
        story += [p('Activities and approved claims', section), grid(rows, [24 * mm, width - 84 * mm, 38 * mm, 22 * mm])]
    if data['management_terms']:
        rows = [[p('Semester', label), p('Club or body', label), p('Role', label), p('Points', label)]]
        rows += [[p(t['term']), p(t['unit']), p(t['role']), p(pts(t['points']))] for t in data['management_terms']]
        story += [p('Management Skills', section), grid(rows, [30 * mm, width - 92 * mm, 40 * mm, 22 * mm])]
    story += [Spacer(1, 4 * mm), p('Each skill counts the UniKL DNA points of every activity whose category feeds it '
                                   '(GHOC mapping), shown against the campus target. Club activities are verified by QR '
                                   'check-in and the advisor-accepted activity report; claims by the GHOCS secretary.',
                                   small)]
    buffer = BytesIO()
    SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                      title='GHOCS activity summary (pilot)').build(story)
    return buffer.getvalue()

