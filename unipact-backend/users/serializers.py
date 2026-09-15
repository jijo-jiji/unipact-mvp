from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import CompanyProfile, ClubProfile, StudentProfile, ShadowUser, SystemLog
from unipact_backend.validators import validate_document_upload

User = get_user_model()


def check_new_password(password, email=None):
    """Run Django's password validators (length, common passwords, all-numeric, similarity to email)."""
    probe = User(email=email or '', username=email or '')
    try:
        validate_password(password, user=probe)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
    return password


class NewAccountSerializerMixin:
    """Shared validation for every sign-up form: a strong password (duplicate emails are checked in the views)."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if 'password' in attrs:
            try:
                check_new_password(attrs['password'], attrs.get('email'))
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'password': exc.detail})
        return attrs

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'role', 'is_verified']
        read_only_fields = ['role', 'is_verified']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.role == User.Role.COMPANY:
            try:
                representation['company_profile'] = CompanyProfileSerializer(instance.company_profile).data
            except CompanyProfile.DoesNotExist:
                representation['company_profile'] = None
        elif instance.role == User.Role.CLUB:
            try:
                representation['club_profile'] = ClubProfileSerializer(instance.club_profile).data
            except ClubProfile.DoesNotExist:
                representation['club_profile'] = None
        elif instance.role == User.Role.STUDENT:
            try:
                representation['student_profile'] = StudentProfileSerializer(instance.student_profile).data
            except StudentProfile.DoesNotExist:
                representation['student_profile'] = None
        return representation

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

class CompanyProfileSerializer(NewAccountSerializerMixin, serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CompanyProfile
        fields = ['company_name', 'company_details', 'email', 'password', 'verification_status', 'tier', 'ssm_document']
        read_only_fields = ['verification_status', 'tier']

    def validate_ssm_document(self, value):
        return validate_document_upload(value, 'SSM document')

class ClubProfileSerializer(NewAccountSerializerMixin, serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = ClubProfile
        fields = ['club_name', 'university', 'email', 'password', 'verification_status', 'verification_document', 'rank']
        read_only_fields = ['verification_status', 'rank']

    def validate_verification_document(self, value):
        return validate_document_upload(value, 'Verification document')

class StudentProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user_id', 'full_name', 'university', 'major', 'domain_focus',
            'verification_status', 'verification_document', 'secondary_email',
            'club_affiliation_name', 'club_affiliation_role', 'skills',
            'bio', 'rating', 'email'
        ]
        read_only_fields = ['verification_status', 'rating']

class StudentRegistrationSerializer(NewAccountSerializerMixin, serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    secondary_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True)
    university = serializers.CharField(max_length=255)
    major = serializers.CharField(max_length=255, required=False, allow_blank=True)
    domain_focus = serializers.ChoiceField(choices=StudentProfile.DomainFocus.choices, default='SOFTWARE_DEV')
    verification_doc = serializers.FileField(required=False, allow_null=True)
    verification_document = serializers.FileField(required=False, allow_null=True)
    club_affiliation_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    club_affiliation_role = serializers.CharField(max_length=255, required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    # Accepts a JSON list, a JSON-encoded string (multipart forms) or a comma-separated string
    skills = serializers.JSONField(required=False)

    def validate_verification_doc(self, value):
        return validate_document_upload(value, 'Student ID document')

    def validate_verification_document(self, value):
        return validate_document_upload(value, 'Student ID document')

    def validate_skills(self, value):
        import json
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                value = value.split(',')
        if not isinstance(value, list):
            raise serializers.ValidationError("Skills must be a list.")
        return [str(s).strip() for s in value if str(s).strip()]


class PublicClubProfileSerializer(serializers.ModelSerializer):
    campaign_history = serializers.SerializerMethodField()

    class Meta:
        model = ClubProfile
        fields = ['id', 'club_name', 'university', 'verification_status', 'rank', 'campaign_history']

    def get_campaign_history(self, obj):
        # Fetch awarded applications
        awarded_apps = obj.applications.filter(status='AWARDED').select_related('campaign')
        history = []
        for app in awarded_apps:
            history.append({
                'title': app.campaign.title,
                'date': app.campaign.updated_at.strftime("%b %Y"),
                'status': 'Mission Accomplished'
            })
        return history

class AdminEntityListSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    entity_name = serializers.SerializerMethodField()
    details = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'entity_name', 'status', 'details', 'is_verified']

    def get_entity_name(self, obj):
        if obj.role == User.Role.CLUB and hasattr(obj, 'club_profile'):
            return obj.club_profile.club_name
        elif obj.role == User.Role.COMPANY and hasattr(obj, 'company_profile'):
            return obj.company_profile.company_name
        elif obj.role == User.Role.STUDENT and hasattr(obj, 'student_profile'):
            return obj.student_profile.full_name
        return "Unknown"

    def get_details(self, obj):
        if obj.role == User.Role.CLUB and hasattr(obj, 'club_profile'):
            return f"Rank: {obj.club_profile.rank}"
        elif obj.role == User.Role.COMPANY and hasattr(obj, 'company_profile'):
            return f"Tier: {obj.company_profile.tier}"
        elif obj.role == User.Role.STUDENT and hasattr(obj, 'student_profile'):
            return f"Uni: {obj.student_profile.university} ({obj.student_profile.domain_focus})"
        return "-"

    def get_status(self, obj):
        return "Active" if obj.is_active else "Blocked"

class ShadowUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShadowUser
        fields = ['email', 'role', 'invited_by', 'created_at']
        read_only_fields = ['invited_by', 'created_at']

class AdminCompanyVerificationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email')
    
    class Meta:
        model = CompanyProfile
        fields = ['id', 'company_name', 'email', 'company_details', 'verification_status', 'ssm_document']

class AdminClubVerificationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email')

    class Meta:
        model = ClubProfile
        fields = ['id', 'club_name', 'email', 'university', 'verification_status', 'verification_document']

class SystemLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemLog
        fields = ['id', 'category', 'level', 'message', 'created_at']

class ClaimProfileSerializer(NewAccountSerializerMixin, serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False)
    last_name = serializers.CharField(required=False)

