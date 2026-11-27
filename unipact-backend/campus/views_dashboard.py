"""M5 endpoints: the pilot dashboard (with CSV export) and the pilot evaluation survey."""
import csv
from datetime import date, timedelta

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from campaigns.workdays import MALAYSIA
from users.models import User

from . import dashboard
from . import survey as survey_module
from .models import AcademicSession, OrgUnit, RoleAssignment, SurveyResponse, SurveySettings
from .models import CampusRole as R
from .permissions import Action, can, current_assignments, works_at
from .points import campus_of
from .views import CAMPUS, require


def period(request, campus):
    """?start=YYYY-MM-DD&end=YYYY-MM-DD; by default from the campus's first semester (or 90 days ago) to today."""
    today = timezone.localdate(timezone=MALAYSIA)
    first = AcademicSession.objects.filter(campus=campus).order_by('starts_on').first()
    try:
        start = date.fromisoformat(request.query_params['start']) if request.query_params.get('start') else \
            (first.starts_on if first else today - timedelta(days=90))
        end = date.fromisoformat(request.query_params['end']) if request.query_params.get('end') else today
    except ValueError:
        raise exceptions.ValidationError({'start': ['Use dates like 2026-09-01.']})
    if end < start:
        raise exceptions.ValidationError({'end': ['The end is before the start.']})
    return start, end


def dashboard_campus(request):
    campus_id = request.query_params.get('campus')
    if campus_id:
        campus = get_object_or_404(OrgUnit, pk=campus_id, kind=OrgUnit.Kind.CAMPUS)
    else:
        campus = next((a.unit.campus for a in current_assignments(request.user) if a.unit.campus), None) \
            or OrgUnit.objects.filter(kind=OrgUnit.Kind.CAMPUS).order_by('pk').first()
    if campus is None or not works_at(request.user, campus):
        raise exceptions.PermissionDenied('The pilot dashboard is for campus management.')
    return campus


class DashboardView(APIView):
    """GET ?campus=&start=&end=: every pilot figure. Add &export=activities|claims|approvals for a CSV."""
    permission_classes = CAMPUS

    def get(self, request):
        campus = dashboard_campus(request)
        start, end = period(request, campus)
        table = request.query_params.get('export')
        if table:
            if table not in ('activities', 'claims', 'approvals'):
                raise exceptions.ValidationError({'export': ['Choose activities, claims or approvals.']})
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="unipact-campus-{table}-{start}-to-{end}.csv"'
            response.write('﻿')  # Excel opens UTF-8 correctly with a byte-order mark
            csv.writer(response).writerows(dashboard.csv_rows(campus, start, end, table))
            return response
        data = dashboard.compute(campus, start, end)
        data['survey_open'] = SurveySettings.for_campus(campus).is_open
        data['can_manage'] = can(request.user, Action.MANAGE_UNITS, campus)
        return Response(data)


def respondent_type(user):
    if user.role in (User.Role.STAFF, User.Role.ADMIN):
        return 'STAFF'
    if RoleAssignment.objects.current().filter(user=user, role=R.COMMITTEE).exists():
        return 'COMMITTEE'
    return 'STUDENT'


class SurveyView(APIView):
    """GET: the questions, whether the survey is open, and my answers. POST {answers, comment}: answer (again)."""
    permission_classes = CAMPUS

    def campus(self, request):
        campus_id = request.query_params.get('campus') or request.data.get('campus')
        return get_object_or_404(OrgUnit, pk=campus_id, kind=OrgUnit.Kind.CAMPUS) if campus_id else campus_of(request.user)

    def get(self, request):
        campus = self.campus(request)
        mine = SurveyResponse.objects.filter(campus=campus, user=request.user).first() if campus else None
        return Response({'campus': campus.pk if campus else None, 'is_open': bool(campus and SurveySettings.for_campus(campus).is_open),
                         'scale': [{'value': v, 'label': label} for v, label in survey_module.SCALE],
                         'categories': survey_module.questions(),
                         'my_response': {'answers': mine.answers, 'comment': mine.comment} if mine else None})

    def post(self, request):
        campus = self.campus(request)
        if not campus or not SurveySettings.for_campus(campus).is_open:
            raise exceptions.ValidationError({'detail': 'The survey is not open.'})
        answers = request.data.get('answers')
        if not isinstance(answers, dict):
            raise exceptions.ValidationError({'answers': ['Answer every question.']})
        cleaned = {}
        for q in survey_module.QUESTION_IDS:
            try:
                value = int(answers.get(q))
            except (TypeError, ValueError):
                raise exceptions.ValidationError({'answers': ['Answer every question.']})
            if value not in range(1, 6):
                raise exceptions.ValidationError({'answers': ['Answers run from 1 to 5.']})
            cleaned[q] = value
        response, created = SurveyResponse.objects.update_or_create(
            campus=campus, user=request.user,
            defaults={'answers': cleaned, 'comment': str(request.data.get('comment') or '')[:2000],
                      'respondent_type': respondent_type(request.user)})
        return Response({'message': 'Thank you!'}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class SurveySettingsView(APIView):
    """PATCH {campus, is_open}: open or close the survey."""
    permission_classes = CAMPUS

    def patch(self, request):
        campus = get_object_or_404(OrgUnit, pk=request.data.get('campus'), kind=OrgUnit.Kind.CAMPUS)
        require(request.user, Action.MANAGE_UNITS, campus)
        settings_ = SurveySettings.for_campus(campus)
        settings_.is_open = str(request.data.get('is_open')).lower() in ('true', '1', 'yes')
        if settings_.is_open and not settings_.opened_at:
            settings_.opened_at = timezone.now()
        settings_.save()
        return Response({'is_open': settings_.is_open})
