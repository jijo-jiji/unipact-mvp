# pyrefly: ignore [missing-import]
from rest_framework import serializers
from .models import (
    Campaign, Application, Deliverable, ClientAsset, StudentDeliverable, ProjectTeamInvitation, Milestone,
    ProjectImpactReport, ImpactLedger,
)
from users.serializers import StudentProfileSerializer, clean_skills
from unipact_backend.validators import validate_project_file_upload, validate_image_upload


def can_view_workspace(user, campaign):
    """Owner company, assigned students and admins can see a campaign's private workspace."""
    if not user or not user.is_authenticated:
        return False
    if user.role == 'ADMIN':
        return True
    if user.role == 'COMPANY':
        return campaign.company.user_id == user.id
    if user.role == 'STUDENT' and hasattr(user, 'student_profile'):
        # A student still deciding on an offer sees the brief, not the client's files or the team's work
        return campaign.is_active_member(user.student_profile)
    return False

class ClientAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientAsset
        fields = ['id', 'campaign', 'title', 'file', 'asset_type', 'uploaded_at']
        read_only_fields = ['uploaded_at']

class StudentDeliverableSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_university = serializers.CharField(source='student.university', read_only=True)

    class Meta:
        model = StudentDeliverable
        fields = [
            'id', 'campaign', 'student', 'student_name', 'student_university',
            'title', 'external_url', 'file', 'contribution_role',
            'contribution_summary', 'submitted_at'
        ]
        read_only_fields = ['student', 'submitted_at']

class ProjectTeamInvitationSerializer(serializers.ModelSerializer):
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    campaign_company_name = serializers.CharField(source='campaign.company.company_name', read_only=True)
    invited_by_name = serializers.CharField(source='invited_by.full_name', read_only=True)
    invitee_student_name = serializers.CharField(source='invitee_student.full_name', read_only=True)

    class Meta:
        model = ProjectTeamInvitation
        fields = [
            'id', 'campaign', 'campaign_title', 'campaign_company_name', 'invited_by', 'invited_by_name',
            'invitee_email', 'invitee_student', 'invitee_student_name',
            'role_in_project', 'payout_share_percentage', 'status', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['campaign', 'invited_by', 'invitee_student', 'status', 'created_at', 'updated_at']

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = [
            'id', 'campaign', 'step_number', 'title', 'description', 'percentage', 'amount',
            'max_revisions', 'revisions_used', 'status',
            'deliverable_url', 'deliverable_file', 'deliverable_notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'campaign', 'amount', 'revisions_used', 'status', 'created_at', 'updated_at']


class CampaignSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    guild = serializers.SerializerMethodField()
    applicants = serializers.IntegerField(source='applications.count', read_only=True)
    assigned_students_details = StudentProfileSerializer(source='assigned_students', many=True, read_only=True)
    client_assets = ClientAssetSerializer(many=True, read_only=True)
    student_deliverables = StudentDeliverableSerializer(many=True, read_only=True)
    team_invitations = ProjectTeamInvitationSerializer(many=True, read_only=True)
    milestones = MilestoneSerializer(many=True, read_only=True)
    match_offers = serializers.SerializerMethodField()
    my_offer = serializers.SerializerMethodField()
    awaiting_student_acceptance = serializers.SerializerMethodField()
    # What the team is actually paid: the budget minus UniPact's service fee
    student_pool = serializers.SerializerMethodField()
    service_fee_percent = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            'id', 'company', 'company_name', 'title', 'description', 'type', 'budget',
            'requirements', 'deadline', 'status', 'created_at', 'guild', 'applicants',
            'software_sub_type', 'required_skills', 'project_outcome',
            'campaign_objective', 'target_platforms', 'match_notes', 'is_match_finalized',
            'assigned_students', 'assigned_students_details', 'client_assets', 'student_deliverables',
            'team_invitations', 'milestones', 'match_offers', 'my_offer', 'awaiting_student_acceptance',
            'payment_structure', 'platform_fee_percent', 'student_pool', 'service_fee_percent',
        ]
        # Talent assignment is admin-only (via /match/), never writable by the posting company.
        # payment_structure/platform_fee_percent are admin-only edits enforced in CampaignDetailView.
        read_only_fields = ['company', 'status', 'created_at', 'is_match_finalized', 'assigned_students', 'match_notes']

    # Workspace data that only the owner, assigned talent and admins may see
    PRIVATE_FIELDS = ('client_assets', 'student_deliverables', 'team_invitations')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request is None or can_view_workspace(request.user, instance):
            return data
        for field in self.PRIVATE_FIELDS:
            data.pop(field, None)
        return data

    def _user(self):
        request = self.context.get('request')
        return request.user if request and request.user.is_authenticated else None

    def get_student_pool(self, obj):
        return str(obj.student_pool())

    def get_service_fee_percent(self, obj):
        # normalize() alone renders 10 as '1E+1'
        return format(obj.resolved_fee_percent().normalize(), 'f')

    def get_match_offers(self, obj):
        """Who has accepted the admin's offer. Only admins see decline reasons."""
        user = self._user()
        if not user:
            return None
        is_admin = user.role == 'ADMIN'
        is_owner = user.role == 'COMPANY' and obj.company.user_id == user.id
        is_team = user.role == 'STUDENT' and hasattr(user, 'student_profile') and obj.assigned_students.filter(id=user.student_profile.id).exists()
        if not (is_admin or is_owner or is_team):
            return None
        offers = obj.match_offers.select_related('student') if is_admin else obj.match_offers.exclude(status='WITHDRAWN').select_related('student')
        return [
            {
                'student': o.student_id,
                'student_name': o.student.full_name,
                'status': o.status,
                'responded_at': o.responded_at,
                **({'decline_reason': o.decline_reason} if is_admin else {}),
            }
            for o in offers
            # Companies only see the students still on the team, not who turned the project down
            if is_admin or o.status != 'DECLINED'
        ]

    def get_my_offer(self, obj):
        user = self._user()
        if not user or user.role != 'STUDENT' or not hasattr(user, 'student_profile'):
            return None
        offer = obj.match_offers.filter(student=user.student_profile).first()
        return {'status': offer.status, 'created_at': offer.created_at} if offer else None

    def get_awaiting_student_acceptance(self, obj):
        return obj.status == 'MATCHED' and obj.has_pending_offers()

    def get_guild(self, obj):
        # Find the application that is AWARDED, SUBMITTED, or COMPLETED
        winning_app = obj.applications.filter(status__in=['AWARDED', 'SUBMITTED', 'COMPLETED']).first()
        return winning_app.club.club_name if winning_app else None

class CampaignDetailSerializer(CampaignSerializer):
    applications = serializers.SerializerMethodField()
    my_application = serializers.SerializerMethodField()
    report_url = serializers.SerializerMethodField()
    escrow = serializers.SerializerMethodField()

    class Meta(CampaignSerializer.Meta):
        fields = CampaignSerializer.Meta.fields + ['applications', 'my_application', 'report_url', 'escrow']

    def get_escrow(self, obj):
        # Only the owning company or an admin needs to see the money behind the milestones
        request = self.context.get('request')
        if not request or not can_view_workspace(request.user, obj) or request.user.role == 'STUDENT':
            return None
        from .utils import campaign_escrow
        return campaign_escrow(obj)

    def get_report_url(self, obj):
        request = self.context.get('request')
        report = getattr(obj, 'report', None) if obj.status == 'COMPLETED' else None
        if not report or not report.generated_pdf or not (request and can_view_workspace(request.user, obj)):
            return None
        return request.build_absolute_uri(report.generated_pdf.url)

    def get_applications(self, obj):
        # Only show applications to the owner (Company)
        request = self.context.get('request')
        if request and request.user.role == 'COMPANY' and obj.company == request.user.company_profile:
             return ApplicationSerializer(obj.applications.all(), many=True).data
        return None

    def get_my_application(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'CLUB':
             try:
                 app = obj.applications.get(club__user=request.user)
                 return {'id': app.id, 'status': app.status}
             except Application.DoesNotExist:
                 return None
        return None

class DeliverableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deliverable
        fields = ['id', 'application', 'file', 'uploaded_at']
        read_only_fields = ['application', 'uploaded_at']

    def validate_file(self, value):
        return validate_project_file_upload(value, 'Deliverable')

class ApplicationSerializer(serializers.ModelSerializer):
    club_name = serializers.CharField(source='club.club_name', read_only=True)
    club_user_id = serializers.IntegerField(source='club.user.id', read_only=True)
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    campaign_status = serializers.CharField(source='campaign.status', read_only=True)
    campaign_budget = serializers.DecimalField(source='campaign.budget', max_digits=10, decimal_places=2, read_only=True)
    deliverables = DeliverableSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = ['id', 'campaign', 'campaign_title', 'campaign_status', 'campaign_budget', 'club', 'club_name', 'club_user_id', 'message', 'status', 'submitted_at', 'deliverables']
        read_only_fields = ['campaign', 'club', 'status', 'submitted_at', 'deliverables']


def _normalise_name(value):
    return ' '.join(str(value or '').split()).casefold()


class ProjectImpactReportSerializer(serializers.ModelSerializer):
    """The client's statement. `sign` + a typed `signature` matching `signer_name` is the client's consent;
    saving without signing (or editing after signing) leaves it as an unsigned draft."""
    sign = serializers.BooleanField(write_only=True, required=False, default=False)
    signature = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = ProjectImpactReport
        fields = [
            'client_rating', 'business_pain_point', 'client_industry', 'metrics', 'verified_skills',
            'testimonial', 'signer_name', 'signer_title', 'signed_at', 'sign', 'signature',
        ]
        read_only_fields = ['client_rating', 'signed_at']

    def validate_metrics(self, value):
        if not isinstance(value, list) or len(value) > 2:
            raise serializers.ValidationError("Add up to 2 impact metrics.")
        cleaned = []
        for metric in value:
            if not isinstance(metric, dict):
                raise serializers.ValidationError("Each metric needs a value and a label.")
            metric_value = str(metric.get('value') or '').strip()
            label = str(metric.get('label') or '').strip()
            if not metric_value and not label:
                continue
            if not metric_value or not label:
                raise serializers.ValidationError("Each metric needs both a value (e.g. \"14 Hrs\") and a label.")
            if len(metric_value) > 20 or len(label) > 60:
                raise serializers.ValidationError("Keep metric values under 20 characters and labels under 60.")
            cleaned.append({'value': metric_value, 'label': label})
        return cleaned

    def validate_verified_skills(self, value):
        skills = clean_skills(value)
        if len(skills) > 10:
            raise serializers.ValidationError("Pick at most 10 skills.")
        return skills

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('sign'):
            merged = {f: attrs.get(f, getattr(self.instance, f, None)) for f in ('business_pain_point', 'testimonial', 'signer_name', 'signer_title', 'metrics')}
            missing = [label for field, label in (
                ('business_pain_point', 'the business problem'), ('testimonial', 'a testimonial'),
                ('signer_name', 'your full name'), ('signer_title', 'your job title'),
            ) if not str(merged[field] or '').strip()]
            if missing:
                raise serializers.ValidationError({'error': f"Before signing, add {', '.join(missing)}."})
            if not merged['metrics']:
                raise serializers.ValidationError({'error': "Before signing, add at least one impact metric."})
            if _normalise_name(attrs.get('signature')) != _normalise_name(merged['signer_name']):
                raise serializers.ValidationError({'signature': ["Type your full name exactly as entered above to sign."]})
        return attrs


class ImpactLedgerStudentSerializer(serializers.ModelSerializer):
    """The student's part of their ledger. `submit` marks it ready for UniPact review."""
    submit = serializers.BooleanField(write_only=True, required=False, default=False)
    remove_before_image = serializers.BooleanField(write_only=True, required=False, default=False)
    remove_after_image = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = ImpactLedger
        fields = [
            'role', 'technical_solution', 'proof_url', 'before_image', 'before_caption',
            'after_image', 'after_caption', 'student_submitted_at',
            'submit', 'remove_before_image', 'remove_after_image',
        ]
        read_only_fields = ['student_submitted_at']

    def validate_before_image(self, value):
        return validate_image_upload(value, 'Before screenshot')

    def validate_after_image(self, value):
        return validate_image_upload(value, 'After screenshot')

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('submit'):
            for field, label in (('role', 'your role'), ('technical_solution', 'what you built')):
                if not str(attrs.get(field, getattr(self.instance, field, '')) or '').strip():
                    raise serializers.ValidationError({'error': f"Before submitting, add {label}."})
        return attrs
