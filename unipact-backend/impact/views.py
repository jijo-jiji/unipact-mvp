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
from .models import B40Record, ImpactSettings, Workshop
from .serializers import B40RecordSerializer, ImpactSettingsSerializer, WorkshopSerializer


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
    queryset = Workshop.objects.all()
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AdminWorkshopDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = WorkshopSerializer
    queryset = Workshop.objects.all()


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
