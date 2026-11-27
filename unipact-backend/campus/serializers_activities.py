from decimal import Decimal

from rest_framework import serializers

from unipact_backend.validators import validate_project_file_upload

from . import ghocs
from .activities import needs_dean
from .models import Activity, ActivityComment, ActivityPolicy, ActivityReport, Attendance
from .serializers import JSONListField, MeritElementsField, PersonSerializer

CENT = Decimal('0.01')


class BudgetRowSerializer(serializers.Serializer):
    item = serializers.CharField(max_length=200)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    quantity = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal('0.01'), default=1)

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        return {'item': values['item'], 'price': str(values['price']), 'quantity': str(values['quantity'])}


class ActivitySerializer(serializers.ModelSerializer):
    objectives = JSONListField(child=serializers.CharField(max_length=500), min_length=1, max_length=8)
    merit_elements = MeritElementsField(required=True)
    budget_items = JSONListField(child=BudgetRowSerializer(), required=False, max_length=40)
    extra = serializers.JSONField(required=False)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    club_detail = serializers.SerializerMethodField()
    total_budget = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_funding = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    needs_dean = serializers.SerializerMethodField()
    approval_id = serializers.SerializerMethodField()
    attendance_count = serializers.SerializerMethodField()
    report_status = serializers.SerializerMethodField()
    created_by = PersonSerializer(read_only=True)

    class Meta:
        model = Activity
        fields = ['id', 'club', 'club_detail', 'title', 'background', 'objectives', 'activity_level', 'dna_category',
                  'merit_elements', 'venue', 'on_campus', 'starts_at', 'ends_at', 'expected_participants',
                  'justification', 'budget_items', 'funding_saf', 'funding_campus', 'funding_other', 'extra',
                  'document', 'status', 'status_label', 'approval_number', 'total_budget', 'total_funding',
                  'needs_dean', 'approval_id', 'published_at', 'checkin_open', 'attendance_count', 'report_status',
                  'created_by', 'created_at']
        read_only_fields = ['club', 'status', 'approval_number', 'published_at', 'checkin_open', 'created_at']

    def get_club_detail(self, activity):
        club = activity.club
        return {'id': club.pk, 'name': club.name, 'sector': club.sector}

    def get_needs_dean(self, activity):
        return needs_dean(activity)

    def get_approval_id(self, activity):
        approval = getattr(activity, 'approval', None)
        return approval.pk if approval else None

    def get_attendance_count(self, activity):
        return activity.attendance.count()

    def get_report_status(self, activity):
        report = getattr(activity, 'report', None)
        return report.status if report else None

    def validate_activity_level(self, value):
        if value not in ghocs.ActivityLevel.values:
            raise serializers.ValidationError('Choose a level from the list.')
        return value

    def validate_dna_category(self, value):
        if value not in ghocs.DnaCategory.values:
            raise serializers.ValidationError('Choose a UniKL DNA category from the list.')
        return value

    def validate_merit_elements(self, value):
        if not value:
            raise serializers.ValidationError('Choose at least one S.P.I.C.E.S element.')
        return value

    def validate_document(self, value):
        return validate_project_file_upload(value, 'Proposal document') if value else value

    def validate_extra(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('Send the additional details as an object.')
        allowed = ('logistics', 'vehicle', 'sponsor', 'person_in_charge', 'participants')
        return {k: str(v)[:1000] for k, v in value.items() if k in allowed and v}

    def validate(self, attrs):
        if attrs['ends_at'] <= attrs['starts_at']:
            raise serializers.ValidationError({'ends_at': ['The activity must end after it starts.']})
        rows = attrs.get('budget_items') or []
        total = sum((Decimal(r['price']) * Decimal(r['quantity'])).quantize(CENT) for r in rows) if rows else Decimal('0')
        funding = sum(attrs.get(f, Decimal('0')) or Decimal('0') for f in ('funding_saf', 'funding_campus', 'funding_other'))
        if total and funding != total:
            raise serializers.ValidationError({'funding_saf': [
                f'Where the money comes from (SAF + UniKL + others = RM {funding:,.2f}) must add up to the '
                f'budget total (RM {total:,.2f}).']})
        if not total and funding:
            raise serializers.ValidationError({'budget_items': ['List what the money is for in the budget.']})
        return attrs


class ActivityCommentSerializer(serializers.ModelSerializer):
    author = PersonSerializer(read_only=True)

    class Meta:
        model = ActivityComment
        fields = ['id', 'author', 'body', 'is_hidden', 'created_at']
        read_only_fields = ['is_hidden', 'created_at']


class AttendanceSerializer(serializers.ModelSerializer):
    person = PersonSerializer(source='student', read_only=True)
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    method_label = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'person', 'role', 'role_label', 'method', 'method_label', 'checked_in_at']
        read_only_fields = ['method', 'checked_in_at']


class ActivityReportSerializer(serializers.ModelSerializer):
    merit_elements = MeritElementsField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    submitted_by = PersonSerializer(read_only=True)
    reviewed_by = PersonSerializer(read_only=True)
    files = serializers.SerializerMethodField()

    class Meta:
        model = ActivityReport
        fields = ['summary', 'budget_used', 'merit_elements', 'status', 'status_label', 'submitted_by',
                  'submitted_at', 'advisor_remarks', 'reviewed_by', 'reviewed_at', 'files']
        read_only_fields = ['status', 'submitted_at', 'advisor_remarks', 'reviewed_at']

    def get_files(self, report):
        request = self.context.get('request')
        return [{'id': f.pk, 'name': f.file.name.rsplit('/', 1)[-1],
                 'url': request.build_absolute_uri(f.file.url) if request else f.file.url} for f in report.files.all()]


class ActivityPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityPolicy
        fields = ['campus', 'src_steps', 'finance_step', 'dean_threshold', 'report_due_days']
        read_only_fields = ['campus']

    def validate_dean_threshold(self, value):
        if value <= 0:
            raise serializers.ValidationError('Enter an amount above RM 0.')
        return value
