from django.db import transaction
from rest_framework import serializers

from users.models import User

from .models import CampusRole, OrgUnit, RoleAssignment, StaffProfile


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
