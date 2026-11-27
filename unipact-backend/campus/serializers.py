import json

from django.db import transaction
from rest_framework import serializers

from unipact_backend.validators import validate_image_upload, validate_project_file_upload
from users.models import User

from . import ghocs
from .clubs import COMMITTEE_POSITIONS
from .models import (
    AcademicSession, Announcement, AnnouncementComment, ApprovalRequest, ApprovalStep, CampusClub, CampusRole,
    ClubProposal, JoinRequest, NewsPost, OrgUnit, RoleAssignment, StaffProfile,
)


class UnitBriefSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = OrgUnit
        fields = ['id', 'name', 'short_name', 'kind', 'kind_label', 'sector']


class OrgUnitSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = OrgUnit
        fields = ['id', 'parent', 'kind', 'kind_label', 'name', 'short_name', 'sector', 'is_active']

    def validate(self, attrs):
        instance = self.instance or OrgUnit()
        for key, value in attrs.items():
            setattr(instance, key, value)
        if self.instance and 'kind' in attrs and attrs['kind'] != self.instance.kind:
            raise serializers.ValidationError({'kind': 'A unit cannot change kind. Create a new unit instead.'})
        try:
            instance.clean()
        except Exception as exc:  # django ValidationError → DRF error
            raise serializers.ValidationError(getattr(exc, 'message_dict', {'non_field_errors': [str(exc)]}))
        return attrs


class PersonSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'name']

    def get_name(self, user):
        for attr, field in (('staff_profile', 'full_name'), ('student_profile', 'full_name')):
            profile = getattr(user, attr, None)
            if profile is not None:
                return getattr(profile, field)
        return user.get_full_name() or user.username


class RoleAssignmentSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    person = PersonSerializer(source='user', read_only=True)
    unit_detail = UnitBriefSerializer(source='unit', read_only=True)
    is_current = serializers.BooleanField(read_only=True)
    # Appoint by email (the person must already have an account)
    email = serializers.EmailField(write_only=True)

    class Meta:
        model = RoleAssignment
        fields = ['id', 'email', 'person', 'role', 'role_label', 'unit', 'unit_detail', 'position', 'session',
                  'starts_on', 'ends_on', 'is_current', 'ended_at', 'ended_reason']
        read_only_fields = ['ended_at', 'ended_reason']

    def validate(self, attrs):
        email = attrs.pop('email').strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            raise serializers.ValidationError({'email': ['No active UniPact account uses this email. Staff are '
                                                         'invited first; students sign up themselves.']})
        assignment = RoleAssignment(user=user, **attrs)
        try:
            assignment.clean()
        except Exception as exc:
            raise serializers.ValidationError(getattr(exc, 'message_dict', {'non_field_errors': [str(exc)]}))
        if RoleAssignment.objects.current().filter(user=user, role=attrs['role'], unit=attrs['unit']).exists():
            raise serializers.ValidationError({'role': [f'{user.email} already holds this role here.']})
        attrs['user'] = user
        return attrs


class MyAssignmentSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    unit = UnitBriefSerializer(read_only=True)
    campus = serializers.SerializerMethodField()

    class Meta:
        model = RoleAssignment
        fields = ['id', 'role', 'role_label', 'unit', 'campus', 'position', 'session', 'starts_on', 'ends_on']

    def get_campus(self, assignment):
        campus = assignment.unit.campus
        return UnitBriefSerializer(campus).data if campus else None


class StaffSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email')
    home_unit_detail = UnitBriefSerializer(source='home_unit', read_only=True)
    account_ready = serializers.SerializerMethodField()

    class Meta:
        model = StaffProfile
        fields = ['id', 'email', 'full_name', 'staff_id', 'title', 'phone', 'home_unit', 'home_unit_detail',
                  'account_ready', 'created_at']
        read_only_fields = ['created_at']

    def get_account_ready(self, profile):
        """Whether the staff member has chosen a password from their invitation."""
        return profile.user.has_usable_password()

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_home_unit(self, unit):
        if unit is None:
            raise serializers.ValidationError('Choose the unit this person works in.')
        return unit

    @transaction.atomic
    def create(self, validated_data):
        email = validated_data.pop('user')['email']
        user = User(email=email, username=email, role=User.Role.STAFF)
        user.set_unusable_password()
        user.save()
        return StaffProfile.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('user', None)  # the sign-in email is the owner's to change
        return super().update(instance, validated_data)


ROLE_CHOICES = [{'value': value, 'label': label} for value, label in CampusRole.choices]


# ---------------------------------------------------------------------------------------------------------------
# M1: clubs, membership, proposals, announcements, news, approvals
# ---------------------------------------------------------------------------------------------------------------
def person_name(user):
    return PersonSerializer(user).data['name'] if user else None


class JSONListField(serializers.ListField):
    """A list that also accepts a JSON string, for multipart forms that carry a file next to lists."""

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data) if data.strip() else []
            except ValueError:
                raise serializers.ValidationError('Send a list.')
        if isinstance(data, list) and len(data) == 1 and isinstance(data[0], str) and data[0].startswith('['):
            data = json.loads(data[0])
        return super().to_internal_value(data)


class MeritElementsField(JSONListField):
    def __init__(self, **kwargs):
        kwargs.setdefault('child', serializers.ChoiceField(choices=ghocs.MeritElement.choices))
        kwargs.setdefault('required', False)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        return ghocs.clean_elements(super().to_internal_value(data))


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicSession
        fields = ['id', 'campus', 'label', 'starts_on', 'ends_on']

    def validate(self, attrs):
        session = AcademicSession(**attrs)
        try:
            session.clean()
        except Exception as exc:
            raise serializers.ValidationError(getattr(exc, 'message_dict', {'non_field_errors': [str(exc)]}))
        overlap = AcademicSession.objects.filter(campus=attrs['campus'], starts_on__lte=attrs['ends_on'],
                                                 ends_on__gte=attrs['starts_on'])
        if self.instance:
            overlap = overlap.exclude(pk=self.instance.pk)
        if overlap.exists():
            raise serializers.ValidationError({'starts_on': ['This overlaps another session at this campus.']})
        return attrs


def club_counts(unit):
    from .clubs import MEMBERSHIP_ROLES
    from .models import RoleAssignment
    return RoleAssignment.objects.current().filter(unit=unit, role__in=MEMBERSHIP_ROLES).count()


class ClubCardSerializer(serializers.Serializer):
    """A club in the directory. Built from the club's OrgUnit."""

    def to_representation(self, unit):
        club = getattr(unit, 'club', None) or CampusClub.for_unit(unit)
        section, campus = unit.parent, unit.campus
        request = self.context.get('request')
        return {
            'id': unit.pk,
            'name': unit.name,
            'short_name': unit.short_name,
            'sector': unit.sector,
            'section': section.name if section else None,
            'campus': {'id': campus.pk, 'name': campus.name, 'short_name': campus.short_name} if campus else None,
            'club_type': club.club_type,
            'club_type_label': ghocs.ClubType(club.club_type).label if club.club_type in ghocs.ClubType.values else '',
            'description': club.description,
            'dna_category': club.dna_category,
            'dna_category_label': ghocs.DnaCategory(club.dna_category).label
            if club.dna_category in ghocs.DnaCategory.values else '',
            'logo': request.build_absolute_uri(club.logo.url) if club.logo and request else (club.logo.url if club.logo else None),
            'joining_open': club.joining_open and club.status == CampusClub.Status.ACTIVE and unit.is_active,
            'status': club.status,
            'member_count': club_counts(unit),
        }


class ClubUpdateSerializer(serializers.ModelSerializer):
    objectives = JSONListField(child=serializers.CharField(max_length=500), required=False, max_length=10)
    merit_elements = MeritElementsField()
    socials = serializers.JSONField(required=False)

    class Meta:
        model = CampusClub
        fields = ['club_type', 'description', 'objectives', 'dna_category', 'merit_elements', 'location',
                  'joining_criteria', 'joining_open', 'logo', 'socials']

    def validate_club_type(self, value):
        if value and value not in ghocs.ClubType.values:
            raise serializers.ValidationError('Choose a club type from the list.')
        return value

    def validate_dna_category(self, value):
        if value and value not in ghocs.DnaCategory.values:
            raise serializers.ValidationError('Choose a UniKL DNA category from the list.')
        return value

    def validate_logo(self, value):
        return validate_image_upload(value, 'Club logo') if value else value

    def validate_socials(self, value):
        if not isinstance(value, dict) or len(value) > 8:
            raise serializers.ValidationError('Send up to 8 links as {"name": "https://..."}.')
        url = serializers.URLField()
        return {str(k)[:30]: url.run_validation(v) for k, v in value.items() if v}


class MemberSerializer(serializers.ModelSerializer):
    person = PersonSerializer(source='user', read_only=True)
    role_label = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = RoleAssignment
        fields = ['id', 'person', 'role', 'role_label', 'position', 'session', 'starts_on', 'ends_on']


class JoinRequestSerializer(serializers.ModelSerializer):
    person = PersonSerializer(source='student', read_only=True)
    club_name = serializers.CharField(source='club.name', read_only=True)

    class Meta:
        model = JoinRequest
        fields = ['id', 'club', 'club_name', 'person', 'message', 'status', 'reason', 'created_at', 'decided_at']
        read_only_fields = ['club', 'status', 'reason', 'decided_at']


class MoneyRowSerializer(serializers.Serializer):
    """A row kept in a JSON list: amounts are stored as text ("120.00") so the list stays valid JSON."""

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        return {k: (str(v) if v is not None and k == 'cost' else v) for k, v in values.items()}


class ProposedActivitySerializer(MoneyRowSerializer):
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    date = serializers.CharField(max_length=40, required=False, allow_blank=True)
    cost = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True)


class BudgetItemSerializer(MoneyRowSerializer):
    item = serializers.CharField(max_length=200)
    cost = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)


class ClubProposalSerializer(serializers.ModelSerializer):
    objectives = JSONListField(child=serializers.CharField(max_length=500), min_length=1, max_length=5)
    merit_elements = MeritElementsField()
    proposed_activities = JSONListField(child=ProposedActivitySerializer(), required=False, max_length=12)
    budget_items = JSONListField(child=BudgetItemSerializer(), required=False, max_length=30)
    founding_members = JSONListField(child=serializers.EmailField(), required=False, max_length=50)
    proposed_advisor_email = serializers.EmailField(write_only=True)
    proposed_advisor = PersonSerializer(read_only=True)
    proposer = PersonSerializer(read_only=True)
    section_detail = UnitBriefSerializer(source='section', read_only=True)
    created_club_id = serializers.IntegerField(read_only=True)
    approval_id = serializers.SerializerMethodField()

    class Meta:
        model = ClubProposal
        fields = ['id', 'section', 'section_detail', 'name', 'club_type', 'dna_category', 'merit_elements',
                  'description', 'objectives', 'proposed_activities', 'target_members', 'expected_members',
                  'benefits', 'budget_items', 'proposed_advisor_email', 'proposed_advisor', 'founding_members',
                  'document', 'proposer', 'status', 'created_club_id', 'approval_id', 'created_at']
        read_only_fields = ['status', 'created_at']

    def get_approval_id(self, proposal):
        approval = getattr(proposal, 'approval', None)
        return approval.pk if approval else None

    def validate_section(self, section):
        if section.kind != OrgUnit.Kind.SECTION or not section.is_active:
            raise serializers.ValidationError('Choose the section (Student Development or Campus Lifestyle) your '
                                              'club belongs to.')
        return section

    def validate_club_type(self, value):
        if value not in ghocs.ClubType.values:
            raise serializers.ValidationError('Choose a club type from the list.')
        return value

    def validate_dna_category(self, value):
        if value and value not in ghocs.DnaCategory.values:
            raise serializers.ValidationError('Choose a UniKL DNA category from the list.')
        return value

    def validate_document(self, value):
        return validate_project_file_upload(value, 'Proposal document') if value else value

    def validate_founding_members(self, value):
        return sorted({email.strip().lower() for email in value})

    def validate(self, attrs):
        email = attrs.pop('proposed_advisor_email').strip().lower()
        advisor = User.objects.filter(email__iexact=email, role=User.Role.STAFF, is_active=True).first()
        if not advisor:
            raise serializers.ValidationError({'proposed_advisor_email': [
                'This email is not a staff account on UniPact Campus. Ask the lecturer to be invited by SDCL first.']})
        attrs['proposed_advisor'] = advisor
        section = attrs['section']
        clash = OrgUnit.objects.filter(kind=OrgUnit.Kind.CLUB, name__iexact=attrs['name'].strip(),
                                       parent__in=OrgUnit.objects.filter(parent=section.parent)).exists() or \
            ClubProposal.objects.filter(section__parent=section.parent, name__iexact=attrs['name'].strip(),
                                        status=ClubProposal.Status.PENDING).exists()
        if clash:
            raise serializers.ValidationError({'name': ['A club with this name already exists or is being proposed.']})
        attrs['name'] = attrs['name'].strip()
        return attrs


class CommentSerializer(serializers.ModelSerializer):
    author = PersonSerializer(read_only=True)

    class Meta:
        model = AnnouncementComment
        fields = ['id', 'author', 'body', 'is_hidden', 'created_at']
        read_only_fields = ['is_hidden', 'created_at']


class AnnouncementSerializer(serializers.ModelSerializer):
    author = PersonSerializer(read_only=True)
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'body', 'pinned', 'author', 'comment_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def get_comment_count(self, announcement):
        return announcement.comments.filter(is_hidden=False).count()


class NewsSerializer(serializers.ModelSerializer):
    author = PersonSerializer(read_only=True)
    merit_elements = MeritElementsField()
    campus_detail = UnitBriefSerializer(source='campus', read_only=True)
    approval_id = serializers.SerializerMethodField()

    class Meta:
        model = NewsPost
        fields = ['id', 'campus', 'campus_detail', 'author', 'title', 'body', 'cover', 'ghocs_claimable',
                  'activity_level', 'dna_category', 'merit_elements', 'starts_on', 'ends_on', 'location', 'status',
                  'published_at', 'created_at', 'approval_id']
        read_only_fields = ['status', 'published_at', 'created_at']

    def get_approval_id(self, post):
        approval = getattr(post, 'approval', None)
        return approval.pk if approval else None

    def validate_campus(self, campus):
        if campus.kind != OrgUnit.Kind.CAMPUS:
            raise serializers.ValidationError('Choose a campus.')
        return campus

    def validate_cover(self, value):
        return validate_image_upload(value, 'Cover picture') if value else value

    def validate(self, attrs):
        if attrs.get('ghocs_claimable'):
            missing = [f for f in ('activity_level', 'dna_category', 'starts_on') if not attrs.get(f)]
            if not attrs.get('merit_elements'):
                missing.append('merit_elements')
            if missing:
                raise serializers.ValidationError({f: ['Needed for a GHOCS-claimable post.'] for f in missing})
        if attrs.get('activity_level') and attrs['activity_level'] not in ghocs.ActivityLevel.values:
            raise serializers.ValidationError({'activity_level': ['Choose a level from the list.']})
        if attrs.get('dna_category') and attrs['dna_category'] not in ghocs.DnaCategory.values:
            raise serializers.ValidationError({'dna_category': ['Choose a UniKL DNA category from the list.']})
        if attrs.get('ends_on') and attrs.get('starts_on') and attrs['ends_on'] < attrs['starts_on']:
            raise serializers.ValidationError({'ends_on': ['The end date is before the start date.']})
        return attrs


class ApprovalStepSerializer(serializers.ModelSerializer):
    role_labels = serializers.SerializerMethodField()
    scope_name = serializers.CharField(source='scope.name', read_only=True)
    assignee = PersonSerializer(read_only=True)
    decided_by = PersonSerializer(read_only=True)
    decision_label = serializers.CharField(source='get_decision_display', read_only=True)

    class Meta:
        model = ApprovalStep
        fields = ['order', 'label', 'role_labels', 'scope_name', 'assignee', 'decision', 'decision_label',
                  'decided_by', 'decided_at', 'comment']

    def get_role_labels(self, step):
        return [CampusRole(r).label for r in step.roles if r in CampusRole.values]


class ApprovalRequestSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    submitted_by = PersonSerializer(read_only=True)
    campus = UnitBriefSerializer(read_only=True)
    steps = ApprovalStepSerializer(many=True, read_only=True)
    current_step = serializers.SerializerMethodField()
    can_sign = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = ['id', 'kind', 'kind_label', 'title', 'status', 'status_label', 'campus', 'submitted_by',
                  'created_at', 'decided_at', 'current_step', 'can_sign', 'steps', 'target']

    def get_current_step(self, request):
        step = request.current_step
        return step.order if step else None

    def get_can_sign(self, request):
        from .approvals import can_sign
        user = self.context['request'].user
        return can_sign(user, request.current_step)

    def get_target(self, request):
        if not self.context.get('with_target'):
            return None
        if request.club_proposal_id:
            return {'type': 'club_proposal',
                    **ClubProposalSerializer(request.club_proposal, context=self.context).data}
        if request.news_post_id:
            return {'type': 'news', **NewsSerializer(request.news_post, context=self.context).data}
        return None


POSITION_CHOICES = COMMITTEE_POSITIONS
