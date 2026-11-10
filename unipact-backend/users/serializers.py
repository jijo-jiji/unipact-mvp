from rest_framework import serializers
from . import formats
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import CompanyProfile, ClubProfile, StudentProfile, ShadowUser, SystemLog
from unipact_backend.validators import validate_document_upload, validate_image_upload


def clean_registration(org_type, number):
    """A company gives its SSM number and an NGO its ROS number. A student club has neither (its proof is a
    proposal signed by its advisor and deputy dean), so it keeps no number."""
    if org_type == CompanyProfile.OrgType.CLUB:
        return ''
    check = formats.ros_number if org_type == CompanyProfile.OrgType.NGO else formats.ssm_number
    try:
        return check(number)
    except serializers.ValidationError as exc:
        raise serializers.ValidationError({'registration_number': exc.detail})


def clean_club_university(org_type, university):
    """A student club must name its university; other clients don't keep one."""
    if org_type != CompanyProfile.OrgType.CLUB:
        return ''
    university = (university or '').strip()
    if not university:
        raise serializers.ValidationError({'university': ["Enter your club's university."]})
    return university

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

class TermsConsentMixin:
    """Sign-up forms must record agreement to the Terms of Service and Privacy Policy (PDPA consent)."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        accepted = self.initial_data.get('accept_terms')
        if str(accepted).strip().lower() not in ('true', '1', 'on', 'yes'):
            raise serializers.ValidationError({
                'accept_terms': ['Please agree to the Terms of Service and Privacy Policy to create an account.'],
            })
        return attrs

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'role', 'is_verified', 'email_verified']
        read_only_fields = ['role', 'is_verified', 'email_verified']

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

class CompanyProfileSerializer(TermsConsentMixin, NewAccountSerializerMixin, serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CompanyProfile
        fields = ['company_name', 'company_details', 'org_type', 'registration_number', 'university', 'email', 'password',
                  'verification_status', 'tier', 'ssm_document', 'logo']
        read_only_fields = ['verification_status', 'tier']
        extra_kwargs = {'registration_number': {'required': False, 'allow_blank': True}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # A company has a 12-digit SSM number, an NGO a ROS (KDN) number such as PPM-011-10-25022025,
        # and a student club its university instead
        org_type = attrs.get('org_type', CompanyProfile.OrgType.COMPANY)
        attrs['registration_number'] = clean_registration(org_type, attrs.get('registration_number'))
        attrs['university'] = clean_club_university(org_type, attrs.get('university'))
        return attrs

    def validate_ssm_document(self, value):
        return validate_document_upload(value, 'SSM document')

    def validate_logo(self, value):
        return validate_image_upload(value, 'Company logo')

class ClubProfileSerializer(TermsConsentMixin, NewAccountSerializerMixin, serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = ClubProfile
        fields = ['club_name', 'university', 'email', 'password', 'verification_status', 'verification_document', 'rank', 'logo']
        read_only_fields = ['verification_status', 'rank']

    def validate_verification_document(self, value):
        return validate_document_upload(value, 'Verification document')

    def validate_logo(self, value):
        return validate_image_upload(value, 'Club logo')

class StudentProfileSerializer(serializers.ModelSerializer):
    """A student's full profile, including contact, ID document and bank details: only for the
    student themselves and admins. Use StudentTeamMemberSerializer anywhere clients or other
    students can see it."""
    email = serializers.EmailField(source='user.email', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    rating = serializers.SerializerMethodField()
    university_email_verified = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user_id', 'full_name', 'university', 'major', 'domain_focus',
            'verification_status', 'verification_document', 'profile_photo', 'secondary_email',
            'club_affiliation_name', 'club_affiliation_role', 'skills',
            'bio', 'rating', 'email',
            'whatsapp_number', 'university_email', 'university_email_verified', 'year_of_study', 'current_semester',
            'weekly_availability', 'linkedin_url', 'portfolio_url',
            'bank_name', 'bank_account_number', 'bank_account_holder_name', 'duitnow_id'
        ]
        read_only_fields = ['verification_status']

    def get_rating(self, obj):
        return obj.public_rating()

    def get_university_email_verified(self, obj):
        return obj.university_email_verified_at is not None


class StudentTeamMemberSerializer(serializers.ModelSerializer):
    """What a client or teammate may see about a student on a project: no contact, ID or bank details."""
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    rating = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user_id', 'full_name', 'university', 'major', 'domain_focus',
            'verification_status', 'profile_photo', 'skills', 'bio', 'rating',
            'year_of_study', 'linkedin_url', 'portfolio_url',
        ]
        read_only_fields = fields

    def get_rating(self, obj):
        return obj.public_rating()


class StudentContactChecks:
    """Format checks for the contact and availability fields, shared by sign-up and Account settings."""

    def validate_whatsapp_number(self, value):
        return formats.malaysian_mobile(value) if value else value

    def validate_university_email(self, value):
        if not value:
            return value
        email = formats.university_email(value)
        others = StudentProfile.objects.filter(university_email__iexact=email)
        if getattr(self, 'instance', None) is not None:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError('Another UniPact account already uses this university email.')
        return email

    def validate_linkedin_url(self, value):
        return formats.linkedin_url(value)

    def validate_year_of_study(self, value):
        if value is not None and not 1 <= value <= 5:
            raise serializers.ValidationError('Choose your year of study (1 to 5).')
        return value

    def validate_current_semester(self, value):
        if value is not None and not 1 <= value <= 3:
            raise serializers.ValidationError('Choose semester 1, 2, or 3 for a short semester.')
        return value


class StudentRegistrationSerializer(StudentContactChecks, TermsConsentMixin, NewAccountSerializerMixin, serializers.Serializer):
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
    whatsapp_number = serializers.CharField(max_length=30)
    university_email = serializers.EmailField()
    year_of_study = serializers.IntegerField()
    current_semester = serializers.IntegerField()
    weekly_availability = serializers.ChoiceField(choices=StudentProfile.WeeklyAvailability.choices)
    linkedin_url = serializers.URLField(required=False, allow_blank=True)
    portfolio_url = serializers.URLField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Software clients want to see code; any link that shows the work counts (GitHub, Canva, Behance, Drive...)
        if attrs.get('domain_focus', 'SOFTWARE_DEV') in ('SOFTWARE_DEV', 'BOTH') and not attrs.get('portfolio_url'):
            raise serializers.ValidationError({'portfolio_url': ['Add a link that shows your work, such as your GitHub, a Canva portfolio or a Google Drive folder.']})
        return attrs

    def validate_verification_doc(self, value):
        return validate_document_upload(value, 'Student ID document')

    def validate_verification_document(self, value):
        return validate_document_upload(value, 'Student ID document')

    def validate_skills(self, value):
        return clean_skills(value)


class PublicClubProfileSerializer(serializers.ModelSerializer):
    campaign_history = serializers.SerializerMethodField()

    class Meta:
        model = ClubProfile
        fields = ['id', 'club_name', 'university', 'verification_status', 'rank', 'logo', 'campaign_history']

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
        fields = ['id', 'email', 'role', 'entity_name', 'status', 'details', 'is_verified', 'invited']

    invited = serializers.SerializerMethodField()

    def get_invited(self, obj):
        """Created by an admin and its owner hasn't set a password yet."""
        return not obj.has_usable_password()

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
            return f"{obj.club_profile.university} · Rank {obj.club_profile.rank}"
        elif obj.role == User.Role.COMPANY and hasattr(obj, 'company_profile'):
            # Which kind of client: a company, an NGO or a student club, with its number or university
            profile = obj.company_profile
            kind = {CompanyProfile.OrgType.NGO: 'NGO', CompanyProfile.OrgType.CLUB: 'Student club'}.get(profile.org_type, 'Company')
            extra = profile.university if profile.org_type == CompanyProfile.OrgType.CLUB else profile.registration_number
            return f"{kind} · {extra}" if extra else kind
        elif obj.role == User.Role.STUDENT and hasattr(obj, 'student_profile'):
            profile = obj.student_profile
            return f"{profile.university} · {profile.get_domain_focus_display()}"
        # Club committee members joined by invitation
        membership = obj.shadow_membership.select_related('invited_by').first() if obj.role == User.Role.CLUB else None
        return f"{membership.role}, {membership.invited_by.club_name}" if membership else "-"

    def get_status(self, obj):
        return "Active" if obj.is_active else "Blocked"

class ShadowUserSerializer(serializers.ModelSerializer):
    """A club committee invitation. The claim token is never returned: it only travels in the invite email."""
    status = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = ShadowUser
        fields = ['id', 'email', 'role', 'invited_by', 'created_at', 'is_claimed', 'status', 'name']
        read_only_fields = ['invited_by', 'created_at', 'is_claimed']
        # Uniqueness is checked in the view so the error message can be friendlier
        extra_kwargs = {'email': {'validators': []}}

    def validate_email(self, value):
        return value.strip().lower()

    def validate_role(self, value):
        value = ' '.join(value.split())
        if not value:
            raise serializers.ValidationError('Give this member a committee role, e.g. "Treasurer".')
        return value

    def get_status(self, obj):
        if obj.is_claimed:
            return 'ACTIVE'
        return 'EXPIRED' if obj.is_expired else 'PENDING'

    def get_name(self, obj):
        return obj.user.get_full_name() if obj.is_claimed and obj.user else None

class AdminCompanyVerificationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email')
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = CompanyProfile
        fields = ['id', 'user_id', 'company_name', 'email', 'company_details', 'org_type', 'registration_number',
                  'university', 'verification_status', 'ssm_document']

class AdminClubVerificationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email')
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = ClubProfile
        fields = ['id', 'user_id', 'club_name', 'email', 'university', 'verification_status', 'verification_document']

class SystemLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemLog
        fields = ['id', 'category', 'level', 'message', 'created_at']

def clean_skills(value):
    """Skills arrive as a JSON list, a JSON-encoded string (multipart forms) or a comma-separated string."""
    import json
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            value = value.split(',')
    if not isinstance(value, list):
        raise serializers.ValidationError("Skills must be a list.")
    skills = []
    for skill in value:
        skill = str(skill).strip()[:60]
        if skill and skill.lower() not in (s.lower() for s in skills):
            skills.append(skill)
    if len(skills) > 30:
        raise serializers.ValidationError("Please list at most 30 skills.")
    return skills


# ------------------------------------------------------------------
# Password reset & change
# ------------------------------------------------------------------

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.check_password(attrs['current_password']):
            raise serializers.ValidationError({'current_password': ['Your current password is not correct.']})
        if attrs['current_password'] == attrs['new_password']:
            raise serializers.ValidationError({'new_password': ['Choose a password different from your current one.']})
        try:
            validate_password(attrs['new_password'], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})
        return attrs


# ------------------------------------------------------------------
# Account settings (what each role may edit about itself)
# ------------------------------------------------------------------

class StudentSettingsSerializer(StudentContactChecks, serializers.ModelSerializer):
    skills = serializers.JSONField(required=False)

    class Meta:
        model = StudentProfile
        fields = [
            'full_name', 'university', 'major', 'domain_focus', 'skills', 'bio',
            'club_affiliation_name', 'club_affiliation_role', 'secondary_email', 'verification_document',
            'profile_photo',
            'whatsapp_number', 'university_email', 'year_of_study', 'current_semester', 'weekly_availability',
            'linkedin_url', 'portfolio_url',
            'bank_name', 'bank_account_number', 'bank_account_holder_name', 'duitnow_id',
        ]

        extra_kwargs = {
            'full_name': {'allow_blank': False},
            'university': {'allow_blank': False},
            'verification_document': {'write_only': True},
        }

    def validate_skills(self, value):
        return clean_skills(value)

    def validate_bio(self, value):
        if len(value) > 1000:
            raise serializers.ValidationError("Please keep your bio under 1,000 characters.")
        return value

    def validate_verification_document(self, value):
        return validate_document_upload(value, 'Student ID document')

    def validate_profile_photo(self, value):
        return validate_image_upload(value, 'Profile picture')

    def update(self, instance, validated_data):
        # A new university email has to be confirmed again
        changed_email = 'university_email' in validated_data and validated_data['university_email'] != instance.university_email
        if changed_email:
            instance.university_email_verified_at = None
        profile = super().update(instance, validated_data)
        if changed_email and profile.university_email:
            from unipact_backend import notifications
            notifications.university_email_verification(profile)
        return profile


class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = ['company_name', 'company_details', 'org_type', 'registration_number', 'university', 'ssm_document', 'logo']
        read_only_fields = ['org_type']
        extra_kwargs = {
            'company_name': {'allow_blank': False},
            'ssm_document': {'write_only': True},
        }

    def validate_registration_number(self, value):
        instance = self.instance
        if instance and instance.verification_status == CompanyProfile.VerificationStatus.VERIFIED and value != instance.registration_number:
            raise serializers.ValidationError('Your registration number is verified. Contact UniPact support to change it.')
        org_type = instance.org_type if instance else CompanyProfile.OrgType.COMPANY
        try:
            return clean_registration(org_type, value)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(exc.detail['registration_number'])

    def validate_university(self, value):
        org_type = self.instance.org_type if self.instance else CompanyProfile.OrgType.COMPANY
        try:
            return clean_club_university(org_type, value)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(exc.detail['university'])

    def validate_ssm_document(self, value):
        return validate_document_upload(value, 'SSM document')

    def validate_logo(self, value):
        return validate_image_upload(value, 'Company logo')


class ClubSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClubProfile
        fields = ['club_name', 'university', 'verification_document', 'logo']
        extra_kwargs = {
            'club_name': {'allow_blank': False},
            'university': {'allow_blank': False},
            'verification_document': {'write_only': True},
        }

    def validate_verification_document(self, value):
        return validate_document_upload(value, 'Verification document')

    def validate_logo(self, value):
        return validate_image_upload(value, 'Club logo')


# ------------------------------------------------------------------
# Admin edits (what an admin may correct on someone else's profile)
# ------------------------------------------------------------------
# Bank details, ID documents and pictures are left out on purpose: payouts go where the bank details say,
# so those stay with the account's owner (their own settings page), who is emailed whenever they change.

class AdminStudentEditSerializer(StudentSettingsSerializer):
    class Meta(StudentSettingsSerializer.Meta):
        fields = [
            'full_name', 'university', 'major', 'domain_focus', 'skills', 'bio',
            'club_affiliation_name', 'club_affiliation_role', 'secondary_email',
            'whatsapp_number', 'university_email', 'year_of_study', 'current_semester', 'weekly_availability',
            'linkedin_url', 'portfolio_url',
        ]
        extra_kwargs = {
            'full_name': {'allow_blank': False},
            'university': {'allow_blank': False},
        }


class AdminCompanyEditSerializer(CompanySettingsSerializer):
    """Admins may also correct the organisation type and a verified registration number."""
    class Meta(CompanySettingsSerializer.Meta):
        fields = ['company_name', 'company_details', 'org_type', 'registration_number', 'university']
        read_only_fields = []
        extra_kwargs = {'company_name': {'allow_blank': False}}

    def validate_registration_number(self, value):
        return value  # checked against the organisation type in validate()

    def validate_university(self, value):
        return value  # checked against the organisation type in validate()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if {'registration_number', 'org_type', 'university'} & set(attrs):
            org_type = attrs.get('org_type', self.instance.org_type)
            number = attrs.get('registration_number', self.instance.registration_number)
            if number or org_type == CompanyProfile.OrgType.CLUB:
                attrs['registration_number'] = clean_registration(org_type, number)
            attrs['university'] = clean_club_university(org_type, attrs.get('university', self.instance.university))
        return attrs


class AdminClubEditSerializer(ClubSettingsSerializer):
    class Meta(ClubSettingsSerializer.Meta):
        fields = ['club_name', 'university']
        extra_kwargs = {
            'club_name': {'allow_blank': False},
            'university': {'allow_blank': False},
        }


class AdminCreateAccountSerializer(serializers.Serializer):
    """An account an admin sets up for a student or a company. No password: its owner picks one from the
    emailed link. Clubs sign up themselves (SRS v2.2.1)."""
    role = serializers.ChoiceField(choices=[User.Role.STUDENT, User.Role.COMPANY])
    email = serializers.EmailField()
    # Admins usually create accounts for people they have already checked, so these start verified
    verified = serializers.BooleanField(default=True)
    # Student
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    university = serializers.CharField(max_length=255, required=False, allow_blank=True)
    major = serializers.CharField(max_length=255, required=False, allow_blank=True)
    domain_focus = serializers.ChoiceField(choices=StudentProfile.DomainFocus.choices, default=StudentProfile.DomainFocus.SOFTWARE_DEV)
    skills = serializers.JSONField(required=False)
    # Company, NGO or student club (the university field above is the club's)
    company_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    company_details = serializers.CharField(required=False, allow_blank=True)
    org_type = serializers.ChoiceField(choices=CompanyProfile.OrgType.choices, default=CompanyProfile.OrgType.COMPANY)
    # Optional here: the admin may not have it yet, and the client can add it in their settings
    registration_number = serializers.CharField(max_length=30, required=False, allow_blank=True)

    REQUIRED = {
        User.Role.STUDENT: {'full_name': "Enter the student's full name.", 'university': 'Choose their university.'},
        User.Role.COMPANY: {'company_name': "Enter the company's name."},
    }

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_skills(self, value):
        return clean_skills(value)

    def validate(self, attrs):
        missing = {field: [message] for field, message in self.REQUIRED[attrs['role']].items() if not str(attrs.get(field) or '').strip()}
        if missing:
            raise serializers.ValidationError(missing)
        if attrs['role'] == User.Role.COMPANY:
            org_type = attrs['org_type']
            number = (attrs.get('registration_number') or '').strip()
            attrs['registration_number'] = clean_registration(org_type, number) if number else ''
            attrs['university'] = clean_club_university(org_type, attrs.get('university'))
        return attrs


class AccountInvitationAcceptSerializer(TermsConsentMixin, serializers.Serializer):
    token = serializers.CharField(max_length=512)
    password = serializers.CharField(write_only=True)


class ClaimProfileSerializer(TermsConsentMixin, NewAccountSerializerMixin, serializers.Serializer):
    token = serializers.CharField(max_length=64)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

