"""M2 endpoints: activity proposals, publishing, QR check-in, attendance, discussion and activity reports."""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from unipact_backend.validators import validate_project_file_upload
from campaigns.workdays import MALAYSIA
from users.models import SystemLog, User
from users.utils import log_event

from . import approvals, emails
from .activities import chain_for, new_checkin_code, render_saf_pdf
from .points import award_activity
from .clubs import ADVISOR_ROLES, MEMBERSHIP_ROLES
from .models import (
    Activity, ActivityComment, ActivityPolicy, ActivityReport, ActivityReportFile, ApprovalRequest, Attendance,
    OrgUnit, RoleAssignment,
)
from .models import CampusRole as R
from .permissions import Action, can, holds, is_platform_admin
from .serializers_activities import (
    ActivityCommentSerializer, ActivityPolicySerializer, ActivityReportSerializer, ActivitySerializer,
    AttendanceSerializer,
)
from .views import CAMPUS, require
from .views_clubs import can_see_request, get_club

UPLOADS = [JSONParser, MultiPartParser, FormParser]
VISIBLE = (Activity.Status.PUBLISHED, Activity.Status.COMPLETED)
MAX_REPORT_FILES = 10


def get_activity(pk):
    return get_object_or_404(Activity.objects.select_related('club', 'club__parent', 'created_by'), pk=pk)


def can_view_activity(user, activity):
    """Published activities are open to everyone in Campus; proposals only to the club, staff overseeing it and
    the people on its approval chain."""
    if activity.status in VISIBLE:
        return True
    return can(user, Action.VIEW_CLUB, activity.club) or can_see_request(user, getattr(activity, 'approval', None))


def can_discuss(user, activity):
    return (can(user, Action.VIEW_CLUB, activity.club)
            or Attendance.objects.filter(activity=activity, student=user).exists())


def can_review_report(user, activity):
    return is_platform_admin(user) or holds(user, ADVISOR_ROLES + (R.HEAD_OF_SECTION,), activity.club)


def committee_of(club):
    return [a.user for a in RoleAssignment.objects.current().filter(unit=club, role=R.COMMITTEE).select_related('user')]


def advisors_of(club):
    return [a.user for a in RoleAssignment.objects.current().filter(unit=club, role__in=ADVISOR_ROLES)
            .select_related('user')]


def with_me(data, user, activity):
    """Add what the signed-in person can do with this activity."""
    data['me'] = {
        'can_manage': can(user, Action.MANAGE_CLUB, activity.club),
        'can_discuss': can_discuss(user, activity),
        'can_review_report': can_review_report(user, activity),
        'attendance': AttendanceSerializer(Attendance.objects.filter(activity=activity, student=user).first()).data
        if Attendance.objects.filter(activity=activity, student=user).exists() else None,
    }
    return data


class ClubActivityListView(generics.ListCreateAPIView):
    """GET: a club's activities (proposals too, for its members and managers). POST: propose one; it starts the
    campus approval chain (SAF 2026)."""
    permission_classes = CAMPUS
    serializer_class = ActivitySerializer
    parser_classes = UPLOADS
    pagination_class = None

    def club(self):
        return get_club(self.kwargs['pk'])

    def get_queryset(self):
        club = self.club()
        activities = Activity.objects.filter(club=club).select_related('club', 'created_by')
        if not can(self.request.user, Action.VIEW_CLUB, club):
            activities = activities.filter(status__in=VISIBLE)
        return activities

    def perform_create(self, serializer):
        club = self.club()
        require(self.request.user, Action.MANAGE_CLUB, club)
        if club.parent is None or club.parent.kind != OrgUnit.Kind.SECTION or club.campus is None:
            raise exceptions.ValidationError({'detail': 'This club is not placed under a section yet.'})
        with transaction.atomic():
            activity = serializer.save(club=club, created_by=self.request.user)
            approvals.start(ApprovalRequest.Kind.ACTIVITY, club.campus, activity.title, self.request.user,
                            chain_for(activity), activity=activity)
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Activity proposed: {activity.title} ({club.name}) by {self.request.user.email}')


class ActivityListView(APIView):
    """Activities for the Campus home: ?scope=mine (my clubs' published activities and ones I attended),
    or ?scope=campus (everything published), upcoming first."""
    permission_classes = CAMPUS

    def get(self, request):
        activities = Activity.objects.filter(status__in=VISIBLE).select_related('club', 'created_by')
        if request.query_params.get('scope', 'mine') == 'mine':
            clubs = RoleAssignment.objects.current().filter(user=request.user, role__in=MEMBERSHIP_ROLES + ADVISOR_ROLES) \
                .values_list('unit_id', flat=True)
            activities = activities.filter(Q(club_id__in=list(clubs)) | Q(attendance__student=request.user)).distinct()
        if request.query_params.get('when') == 'past':
            activities = activities.filter(ends_at__lt=timezone.now()).order_by('-starts_at')
        else:
            activities = activities.filter(ends_at__gte=timezone.now()).order_by('starts_at')
        return Response(ActivitySerializer(activities[:50], many=True, context={'request': request}).data)


class ActivityDetailView(APIView):
    permission_classes = CAMPUS

    def get(self, request, pk):
        activity = get_activity(pk)
        if not can_view_activity(request.user, activity):
            raise exceptions.NotFound()
        data = ActivitySerializer(activity, context={'request': request}).data
        return Response(with_me(data, request.user, activity))


class ActivityPublishView(APIView):
    """Approved → published: members see it and the committee can open check-in."""
    permission_classes = CAMPUS

    def post(self, request, pk):
        activity = get_activity(pk)
        require(request.user, Action.MANAGE_CLUB, activity.club)
        if activity.status != Activity.Status.APPROVED:
            raise exceptions.ValidationError({'detail': 'Only an approved activity can be published.'})
        activity.status = Activity.Status.PUBLISHED
        activity.published_at = timezone.now()
        activity.checkin_code = activity.checkin_code or new_checkin_code()
        activity.save(update_fields=['status', 'published_at', 'checkin_code'])
        return Response(with_me(ActivitySerializer(activity, context={'request': request}).data, request.user, activity))


class ActivityCancelView(APIView):
    permission_classes = CAMPUS

    def post(self, request, pk):
        activity = get_activity(pk)
        require(request.user, Action.MANAGE_CLUB, activity.club)
        if activity.status not in (Activity.Status.APPROVED, Activity.Status.PUBLISHED):
            raise exceptions.ValidationError({'detail': 'Only an approved or published activity can be cancelled. '
                                                        'Withdraw a proposal from Approvals instead.'})
        activity.status = Activity.Status.CANCELLED
        activity.checkin_open = False
        activity.save(update_fields=['status', 'checkin_open'])
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Activity cancelled: {activity.title} by {request.user.email}')
        return Response(with_me(ActivitySerializer(activity, context={'request': request}).data, request.user, activity))


class ActivitySafPdfView(APIView):
    """The filled SAF 2026 form with the sign-off trail, for printing and i-STAR."""
    permission_classes = CAMPUS

    def get(self, request, pk):
        activity = get_activity(pk)
        if not (can(request.user, Action.VIEW_CLUB, activity.club)
                or can_see_request(request.user, getattr(activity, 'approval', None))):
            raise exceptions.NotFound()
        response = HttpResponse(render_saf_pdf(activity), content_type='application/pdf')
        name = activity.approval_number or f'proposal-{activity.pk}'
        response['Content-Disposition'] = f'inline; filename="SAF-{name}.pdf"'
        return response


# --- Check-in and attendance ---------------------------------------------------------------------------------

class CheckinControlView(APIView):
    """The committee opens or closes QR check-in, or makes a new code (the old QR stops working)."""
    permission_classes = CAMPUS

    def post(self, request, pk):
        activity = get_activity(pk)
        require(request.user, Action.MANAGE_CLUB, activity.club)
        if activity.status != Activity.Status.PUBLISHED:
            raise exceptions.ValidationError({'detail': 'Publish the activity before opening check-in.'})
        if str(request.data.get('new_code')).lower() in ('true', '1'):
            activity.checkin_code = new_checkin_code()
        if 'open' in request.data:
            activity.checkin_open = str(request.data.get('open')).lower() in ('true', '1', 'yes')
        activity.save(update_fields=['checkin_open', 'checkin_code'])
        return Response({'checkin_open': activity.checkin_open, 'checkin_code': activity.checkin_code})


class CheckinCodeView(APIView):
    """The QR link: GET shows what you're checking in to; POST checks you in."""
    permission_classes = CAMPUS

    def get_activity(self, code):
        return get_object_or_404(Activity.objects.select_related('club'), checkin_code=code,
                                 status=Activity.Status.PUBLISHED)

    def get(self, request, code):
        activity = self.get_activity(code)
        mine = Attendance.objects.filter(activity=activity, student=request.user).first()
        return Response({'activity': {'id': activity.pk, 'title': activity.title, 'club': activity.club.name,
                                      'starts_at': activity.starts_at, 'ends_at': activity.ends_at,
                                      'venue': activity.venue},
                         'checkin_open': activity.checkin_open,
                         'checked_in': AttendanceSerializer(mine).data if mine else None,
                         'can_check_in': request.user.role == User.Role.STUDENT})

    def post(self, request, code):
        activity = self.get_activity(code)
        if request.user.role != User.Role.STUDENT:
            raise exceptions.PermissionDenied('Check-in is for students.')
        if not activity.checkin_open:
            raise exceptions.ValidationError({'detail': "Check-in isn't open. Ask the committee to open it."})
        role = Attendance.Role.COMMITTEE if RoleAssignment.objects.current().filter(
            unit=activity.club, user=request.user, role=R.COMMITTEE).exists() else Attendance.Role.PARTICIPANT
        try:
            attendance, created = Attendance.objects.get_or_create(activity=activity, student=request.user,
                                                                   defaults={'role': role})
        except IntegrityError:
            attendance, created = Attendance.objects.get(activity=activity, student=request.user), False
        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AttendanceListView(APIView):
    """GET: who took part (the committee). POST {email, role}: add someone who didn't scan."""
    permission_classes = CAMPUS

    def get(self, request, pk):
        activity = get_activity(pk)
        require(request.user, Action.MANAGE_CLUB, activity.club)
        rows = Attendance.objects.filter(activity=activity).select_related('student')
        return Response({'checkin_open': activity.checkin_open, 'checkin_code': activity.checkin_code,
                         'attendance': AttendanceSerializer(rows, many=True).data})

    def post(self, request, pk):
        activity = get_activity(pk)
        require(request.user, Action.MANAGE_CLUB, activity.club)
        if activity.status not in VISIBLE:
            raise exceptions.ValidationError({'detail': 'Publish the activity first.'})
        email = str(request.data.get('email') or '').strip().lower()
        student = User.objects.filter(email__iexact=email, role=User.Role.STUDENT, is_active=True).first()
        if not student:
            raise exceptions.ValidationError({'email': ['No student account uses this email.']})
        role = request.data.get('role') or Attendance.Role.PARTICIPANT
        if role not in Attendance.Role.values:
            raise exceptions.ValidationError({'role': ['Choose participant, committee or organiser.']})
        attendance, created = Attendance.objects.update_or_create(
            activity=activity, student=student,
            defaults={'role': role, 'method': Attendance.Method.MANUAL, 'added_by': request.user})
        award_activity(activity)
        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AttendanceDetailView(APIView):
    permission_classes = CAMPUS

    def get_row(self, request, pk, attendance_id):
        activity = get_activity(pk)
        require(request.user, Action.MANAGE_CLUB, activity.club)
        return get_object_or_404(Attendance, pk=attendance_id, activity=activity)

    def patch(self, request, pk, attendance_id):
        row = self.get_row(request, pk, attendance_id)
        role = request.data.get('role')
        if role not in Attendance.Role.values:
            raise exceptions.ValidationError({'role': ['Choose participant, committee or organiser.']})
        row.role = role
        row.save(update_fields=['role'])
        award_activity(row.activity)
        return Response(AttendanceSerializer(row).data)

    def delete(self, request, pk, attendance_id):
        self.get_row(request, pk, attendance_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- Discussion ----------------------------------------------------------------------------------------------

class ActivityCommentListView(generics.ListCreateAPIView):
    permission_classes = CAMPUS
    serializer_class = ActivityCommentSerializer
    pagination_class = None

    def activity(self):
        activity = get_activity(self.kwargs['pk'])
        if not can_discuss(self.request.user, activity):
            raise exceptions.PermissionDenied('The discussion is for club members and participants.')
        return activity

    def get_queryset(self):
        activity = self.activity()
        comments = activity.comments.select_related('author')
        if not can(self.request.user, Action.MANAGE_CLUB, activity.club):
            comments = comments.filter(Q(is_hidden=False) | Q(author=self.request.user))
        return comments

    def perform_create(self, serializer):
        serializer.save(activity=self.activity(), author=self.request.user)


class ActivityCommentHideView(APIView):
    permission_classes = CAMPUS

    def post(self, request, pk, comment_id):
        comment = get_object_or_404(ActivityComment.objects.select_related('activity__club'), pk=comment_id,
                                    activity_id=pk)
        require(request.user, Action.MANAGE_CLUB, comment.activity.club)
        comment.is_hidden = str(request.data.get('hidden', 'true')).lower() in ('true', '1', 'yes')
        comment.save(update_fields=['is_hidden'])
        return Response(ActivityCommentSerializer(comment).data)


# --- Report --------------------------------------------------------------------------------------------------

class ActivityReportView(APIView):
    """GET: the report. PUT (multipart, files[] for photos and documents): the committee writes or updates it
    once the activity has ended; the advisors are told."""
    permission_classes = CAMPUS
    parser_classes = UPLOADS

    def get(self, request, pk):
        activity = get_activity(pk)
        if not can(request.user, Action.VIEW_CLUB, activity.club):
            raise exceptions.NotFound()
        report = getattr(activity, 'report', None)
        policy = ActivityPolicy.for_campus(activity.club.campus)
        return Response({'report': ActivityReportSerializer(report, context={'request': request}).data if report else None,
                         'due_on': timezone.localtime(activity.ends_at, MALAYSIA).date() + timedelta(days=policy.report_due_days)})

    def put(self, request, pk):
        activity = get_activity(pk)
        require(request.user, Action.MANAGE_CLUB, activity.club)
        if activity.status != Activity.Status.PUBLISHED or activity.ends_at > timezone.now():
            raise exceptions.ValidationError({'detail': 'You can write the report once the published activity has ended.'})
        report = getattr(activity, 'report', None)
        if report and report.status == ActivityReport.Status.ACCEPTED:
            raise exceptions.ValidationError({'detail': 'The advisor has already accepted this report.'})
        files = request.FILES.getlist('files')
        existing = report.files.count() if report else 0
        if existing + len(files) > MAX_REPORT_FILES:
            raise exceptions.ValidationError({'files': [f'Attach up to {MAX_REPORT_FILES} files in all.']})
        for f in files:
            validate_project_file_upload(f, 'Report file')
        serializer = ActivityReportSerializer(report, data=request.data, partial=bool(report),
                                              context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            report = serializer.save(activity=activity, submitted_by=request.user,
                                     status=ActivityReport.Status.SUBMITTED)
            for f in files:
                ActivityReportFile.objects.create(report=report, file=f)
        emails.activity_report_submitted(report, advisors_of(activity.club))
        return Response({'report': ActivityReportSerializer(report, context={'request': request}).data})


class ActivityReportReviewView(APIView):
    """The advisor accepts the report (the activity is then complete) or asks for changes, with remarks."""
    permission_classes = CAMPUS

    def post(self, request, pk):
        activity = get_activity(pk)
        if not can_review_report(request.user, activity):
            raise exceptions.PermissionDenied("Only the club's advisors review its reports.")
        report = getattr(activity, 'report', None)
        if not report or report.status != ActivityReport.Status.SUBMITTED:
            raise exceptions.ValidationError({'detail': 'There is no report waiting for review.'})
        accept = str(request.data.get('accept')).lower() in ('true', '1', 'yes')
        remarks = str(request.data.get('remarks') or '').strip()
        if not accept and not remarks:
            raise exceptions.ValidationError({'remarks': ['Say what needs changing.']})
        with transaction.atomic():
            report.status = ActivityReport.Status.ACCEPTED if accept else ActivityReport.Status.CHANGES
            report.advisor_remarks = remarks
            report.reviewed_by = request.user
            report.reviewed_at = timezone.now()
            report.save()
            if accept:
                activity.status = Activity.Status.COMPLETED
                activity.checkin_open = False
                activity.save(update_fields=['status', 'checkin_open'])
                # Everyone who attended gets their UniKL DNA points now: attendance + an accepted report
                award_activity(activity)
        emails.activity_report_reviewed(report, committee_of(activity.club))
        return Response({'report': ActivityReportSerializer(report, context={'request': request}).data})


# --- Campus approval settings --------------------------------------------------------------------------------

class ActivityPolicyView(APIView):
    """GET/PATCH ?campus=<id>: which steps the activity chain uses, and the Dean threshold."""
    permission_classes = CAMPUS

    def campus(self, request):
        campus = get_object_or_404(OrgUnit, pk=request.query_params.get('campus') or request.data.get('campus'),
                                   kind=OrgUnit.Kind.CAMPUS)
        return campus

    def get(self, request):
        campus = self.campus(request)
        require(request.user, Action.VIEW_STRUCTURE, campus)
        return Response(ActivityPolicySerializer(ActivityPolicy.for_campus(campus)).data)

    def patch(self, request):
        campus = self.campus(request)
        require(request.user, Action.MANAGE_UNITS, campus)
        serializer = ActivityPolicySerializer(ActivityPolicy.for_campus(campus), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Activity approval settings for {campus.name} changed by {request.user.email}: {serializer.data}')
        return Response(serializer.data)
