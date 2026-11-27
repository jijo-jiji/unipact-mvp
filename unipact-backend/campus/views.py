from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from unipact_backend import notifications
from users.models import SystemLog
from users.utils import invitation_path, log_event

from .models import ROLE_UNIT_KINDS, STAFF_ROLES, OrgUnit, RoleAssignment, StaffProfile
from .permissions import Action, CampusEnabled, can, current_assignments, is_platform_admin, role_action, visible_units
from .serializers import (
    ROLE_CHOICES, MyAssignmentSerializer, OrgUnitSerializer, RoleAssignmentSerializer, StaffSerializer,
)

CAMPUS = [permissions.IsAuthenticated, CampusEnabled]


def require(user, action, unit):
    if not can(user, action, unit):
        raise exceptions.PermissionDenied("You don't have a role that allows this here.")


class MeView(APIView):
    """The signed-in person's current campus roles, for the Campus menu and home page."""
    permission_classes = CAMPUS

    def get(self, request):
        assignments = current_assignments(request.user).order_by('unit__kind', 'role')
        return Response({
            'is_platform_admin': is_platform_admin(request.user),
            'assignments': MyAssignmentSerializer(assignments, many=True).data,
            'can_manage_structure': is_platform_admin(request.user) or any(
                can(request.user, Action.MANAGE_STAFF, a.unit) or can(request.user, Action.MANAGE_UNITS, a.unit)
                for a in assignments),
        })


class RoleListView(APIView):
    """The roles that exist and the kind of unit each one is held at (for appointment forms)."""
    permission_classes = CAMPUS

    def get(self, request):
        return Response([{**choice, 'unit_kinds': list(ROLE_UNIT_KINDS[choice['value']]),
                          'staff_role': choice['value'] in STAFF_ROLES} for choice in ROLE_CHOICES])


class UnitListView(generics.ListCreateAPIView):
    """GET: every unit the person can see, flat with parent ids (the app draws the tree).
    POST: add a unit under a parent the person manages."""
    permission_classes = CAMPUS
    serializer_class = OrgUnitSerializer
    pagination_class = None

    def get_queryset(self):
        units = visible_units(self.request.user)
        kind = self.request.query_params.get('kind')
        return units.filter(kind=kind) if kind else units.order_by('parent_id', 'kind', 'name')

    def perform_create(self, serializer):
        parent = serializer.validated_data.get('parent')
        if parent is None:
            if not is_platform_admin(self.request.user):
                raise exceptions.PermissionDenied('Only UniPact admins add universities.')
        else:
            require(self.request.user, Action.MANAGE_UNITS, parent)
        unit = serializer.save()
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Campus unit added: {unit.name} ({unit.kind}) by {self.request.user.email}')


class UnitDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = CAMPUS
    serializer_class = OrgUnitSerializer

    def get_object(self):
        unit = get_object_or_404(OrgUnit, pk=self.kwargs['pk'])
        require(self.request.user, Action.VIEW_STRUCTURE, unit)
        return unit

    def perform_update(self, serializer):
        require(self.request.user, Action.MANAGE_UNITS, serializer.instance)
        new_parent = serializer.validated_data.get('parent', serializer.instance.parent)
        if new_parent != serializer.instance.parent:
            require(self.request.user, Action.MANAGE_UNITS, new_parent)
        serializer.save()


class AssignmentListView(generics.ListCreateAPIView):
    """GET ?unit=<id>: who holds which role at that unit (add &history=1 for ended terms too).
    POST: appoint someone by email."""
    permission_classes = CAMPUS
    serializer_class = RoleAssignmentSerializer
    pagination_class = None

    def get_queryset(self):
        unit_id = self.request.query_params.get('unit')
        if not unit_id:
            raise exceptions.ValidationError({'unit': 'Choose a unit.'})
        unit = get_object_or_404(OrgUnit, pk=unit_id)
        require(self.request.user, Action.VIEW_STRUCTURE, unit)
        assignments = RoleAssignment.objects.filter(unit=unit).select_related('user', 'unit')
        if self.request.query_params.get('history') not in ('1', 'true'):
            assignments = assignments.current()
        return assignments

    def perform_create(self, serializer):
        data = serializer.validated_data
        require(self.request.user, role_action(data['role']), data['unit'])
        assignment = serializer.save(assigned_by=self.request.user)
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Campus role {assignment.role} at {assignment.unit} given to {assignment.user.email} '
                  f'by {self.request.user.email}')


class AssignmentEndView(APIView):
    """End someone's term early (resignation, handover). The record stays for their history."""
    permission_classes = CAMPUS

    def post(self, request, pk):
        assignment = get_object_or_404(RoleAssignment.objects.select_related('unit', 'user'), pk=pk)
        require(request.user, role_action(assignment.role), assignment.unit)
        if assignment.ended_at:
            raise exceptions.ValidationError({'detail': 'This term has already ended.'})
        assignment.end(reason=str(request.data.get('reason') or '')[:255])
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Campus role {assignment.role} at {assignment.unit} ended for {assignment.user.email} '
                  f'by {request.user.email}')
        return Response(RoleAssignmentSerializer(assignment).data)


class StaffListView(generics.ListCreateAPIView):
    """GET: staff in the units the person manages. POST: invite a staff member; they get an email to set
    their password (the same link admins use for accounts they create)."""
    permission_classes = CAMPUS
    serializer_class = StaffSerializer
    pagination_class = None

    def get_queryset(self):
        staff = StaffProfile.objects.select_related('user', 'home_unit').order_by('full_name')
        if is_platform_admin(self.request.user):
            return staff
        managed = [unit for unit in visible_units(self.request.user) if can(self.request.user, Action.MANAGE_STAFF, unit)]
        return staff.filter(home_unit__in=managed)

    def perform_create(self, serializer):
        require(self.request.user, Action.MANAGE_STAFF, serializer.validated_data['home_unit'])
        profile = serializer.save()
        notifications.account_invitation(profile.user, invitation_path(profile.user))
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Staff account invited: {profile.user.email} by {self.request.user.email}')


class StaffDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = CAMPUS
    serializer_class = StaffSerializer

    def get_object(self):
        profile = get_object_or_404(StaffProfile.objects.select_related('user', 'home_unit'), pk=self.kwargs['pk'])
        require(self.request.user, Action.MANAGE_STAFF, profile.home_unit)
        return profile


class StaffResendInviteView(APIView):
    permission_classes = CAMPUS

    def post(self, request, pk):
        profile = get_object_or_404(StaffProfile.objects.select_related('user', 'home_unit'), pk=pk)
        require(request.user, Action.MANAGE_STAFF, profile.home_unit)
        if profile.user.has_usable_password():
            raise exceptions.ValidationError({'detail': 'This person has already set up their account.'})
        notifications.account_invitation(profile.user, invitation_path(profile.user))
        return Response({'message': f'Invitation sent again to {profile.user.email}.', 'sent_at': timezone.now()},
                        status=status.HTTP_200_OK)
