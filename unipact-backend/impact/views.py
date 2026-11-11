from decimal import Decimal

from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework import exceptions, generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from payments.models import Payout
from users.models import StudentProfile, SystemLog, User
from users.utils import log_event

from . import stats
from .models import B40Record, ImpactSettings, LearningModule, ModuleItem, Workshop, WorkshopAttendee
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from django.utils import timezone

from unipact_backend.throttling import WorkshopCheckinThrottle

from .linking import student_for_email
from .results import workshop_results
from .serializers import (
    CheckinSerializer, FeedbackSerializer,
    B40RecordSerializer, ImpactSettingsSerializer, LearningModuleSerializer, ModuleItemSerializer, WorkshopSerializer,
)


class IsPlatformAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class PublicImpactView(APIView):
    """The homepage counter. Totals only, and nothing until an admin publishes it."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(stats.public())


class AdminImpactView(APIView):
    """GET: every figure, plus the counter's settings. PATCH: set the counting start date or
    publish/unpublish the counter."""
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        return Response({'stats': stats.compute(), 'settings': ImpactSettingsSerializer(ImpactSettings.load()).data})

    def patch(self, request):
        serializer = ImpactSettingsSerializer(ImpactSettings.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO, f'Impact counter settings updated by {request.user.email}')
        return Response({'stats': stats.compute(), 'settings': serializer.data})


class AdminWorkshopListView(generics.ListCreateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = WorkshopSerializer
    queryset = Workshop.objects.prefetch_related('modules')
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AdminWorkshopDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = WorkshopSerializer
    queryset = Workshop.objects.prefetch_related('modules')


class AdminWorkshopResultsView(APIView):
    """What one workshop led to, with every attendee (names are admin-only)."""
    permission_classes = [IsPlatformAdmin]

    def get(self, request, pk):
        return Response(workshop_results(get_object_or_404(Workshop, pk=pk)))


class AdminWorkshopAttendeeDeleteView(APIView):
    """Remove a check-in, e.g. a duplicate or someone asking for their details to be deleted."""
    permission_classes = [IsPlatformAdmin]

    def delete(self, request, pk):
        get_object_or_404(WorkshopAttendee, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- Public pages attendees open from the QR code ---

class PublicWorkshopView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, code):
        w = get_object_or_404(Workshop.objects.prefetch_related('modules'), checkin_code=code)
        return Response({
            'title': w.title, 'kind_label': w.get_kind_display(), 'held_on': w.held_on, 'location': w.location,
            'checkin_open': w.checkin_open, 'feedback_open': w.feedback_open,
            'modules': [m.title for m in w.modules.all() if m.is_published],
        })


class WorkshopCheckinView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [WorkshopCheckinThrottle]

    def post(self, request, code):
        workshop = get_object_or_404(Workshop, checkin_code=code)
        if not workshop.checkin_open:
            return Response({'error': 'Check-in for this workshop is closed.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CheckinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        student = student_for_email(data['email'])
        attendee, created = WorkshopAttendee.objects.get_or_create(
            workshop=workshop, email=data['email'],
            defaults={
                'full_name': data['full_name'].strip(), 'phone': data.get('phone', '').strip(),
                'university': data.get('university', '').strip(), 'b40_self_declared': data['b40_self_declared'],
                'confidence_before': data['confidence_before'], 'consented_at': timezone.now(), 'student': student,
            },
        )
        return Response({'checked_in': True, 'already': not created, 'has_account': attendee.student_id is not None},
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class WorkshopFeedbackView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [WorkshopCheckinThrottle]

    def post(self, request, code):
        workshop = get_object_or_404(Workshop, checkin_code=code)
        if not workshop.feedback_open:
            return Response({'error': 'Feedback for this workshop is closed.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = FeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        attendee = WorkshopAttendee.objects.filter(workshop=workshop, email=data['email']).first()
        if attendee is None:
            return Response({'email': ['Use the same email you checked in with.']}, status=status.HTTP_400_BAD_REQUEST)
        attendee.confidence_after = data['confidence_after']
        attendee.recommend_score = data['recommend_score']
        attendee.feedback_comment = data.get('comment', '').strip()
        attendee.feedback_at = timezone.now()
        attendee.save(update_fields=['confidence_after', 'recommend_score', 'feedback_comment', 'feedback_at'])
        return Response({'saved': True, 'has_account': attendee.student_id is not None})


class AdminB40ListView(APIView):
    """GET: students marked B40, with what each has been paid. POST {student_id, evidence_note}: mark one."""
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        # Paid since the counting start date, so each line adds up to the counter's figure
        paid = Q(student__payouts__status=Payout.Status.PAID, student__payouts__paid_at__isnull=False)
        start = ImpactSettings.load().counting_starts_on
        if start:
            paid &= Q(student__payouts__paid_at__date__gte=start)
        records = B40Record.objects.select_related('student').annotate(
            amount_paid=Sum('student__payouts__amount', filter=paid),
        ).order_by('student__full_name')
        for record in records:
            record.amount_paid = record.amount_paid or Decimal('0.00')
        return Response(B40RecordSerializer(records, many=True).data)

    def post(self, request):
        student_id = request.data.get('student_id')
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            raise exceptions.ValidationError({'student_id': 'Choose a student.'})
        student = get_object_or_404(StudentProfile, pk=student_id)
        record, created = B40Record.objects.get_or_create(
            student=student,
            defaults={'evidence_note': (request.data.get('evidence_note') or '')[:255], 'verified_by': request.user},
        )
        if created:
            # The log says who did it, not whom: the feed is visible to every admin and B40 status is private
            log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO, f'A student was marked B40 by {request.user.email}')
        return Response({'id': record.id, 'created': created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AdminB40DetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    def delete(self, request, pk):
        get_object_or_404(B40Record, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- Learning library: workshop modules and exercises students can come back to ---

class CanUseLibrary(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in (User.Role.STUDENT, User.Role.ADMIN))


class LibraryListView(generics.ListAPIView):
    """Published modules, with their materials and exercises, for signed-in students."""
    permission_classes = [CanUseLibrary]
    serializer_class = LearningModuleSerializer
    pagination_class = None

    def get_queryset(self):
        return LearningModule.objects.filter(is_published=True).prefetch_related('items')


class LibraryDetailView(generics.RetrieveAPIView):
    permission_classes = [CanUseLibrary]
    serializer_class = LearningModuleSerializer

    def get_queryset(self):
        return LearningModule.objects.filter(is_published=True).prefetch_related('items')


class AdminModuleListView(generics.ListCreateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = LearningModuleSerializer
    pagination_class = None
    queryset = LearningModule.objects.prefetch_related('items')


class AdminModuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = LearningModuleSerializer
    queryset = LearningModule.objects.prefetch_related('items')

    def perform_destroy(self, instance):
        for item in instance.items.all():
            if item.file:
                item.file.delete(save=False)
        instance.delete()


class AdminModuleItemCreateView(generics.CreateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = ModuleItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(module=get_object_or_404(LearningModule, pk=self.kwargs['module_id']))


class AdminModuleItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = ModuleItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = ModuleItem.objects.all()

    def perform_update(self, serializer):
        # A replaced or removed file is deleted from storage, so old slides don't pile up
        old_name = serializer.instance.file.name if serializer.instance.file else None
        item = serializer.save()
        if old_name and old_name != (item.file.name if item.file else None):
            ModuleItem._meta.get_field('file').storage.delete(old_name)

    def perform_destroy(self, instance):
        if instance.file:
            instance.file.delete(save=False)
        instance.delete()
