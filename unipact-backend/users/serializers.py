from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import CompanyProfile, ClubProfile, ShadowUser, SystemLog

User = get_user_model()

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

class CompanyProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CompanyProfile
        fields = ['company_name', 'company_details', 'email', 'password', 'verification_status', 'tier', 'ssm_document']
        read_only_fields = ['verification_status', 'tier']

class ClubProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = ClubProfile
        fields = ['club_name', 'university', 'email', 'password', 'verification_status', 'verification_document', 'rank']
        read_only_fields = ['verification_status', 'rank']

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
        return "Unknown"

    def get_details(self, obj):
        if obj.role == User.Role.CLUB and hasattr(obj, 'club_profile'):
            return f"Rank: {obj.club_profile.rank}"
        elif obj.role == User.Role.COMPANY and hasattr(obj, 'company_profile'):
            return f"Tier: {obj.company_profile.tier}"
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

class ClaimProfileSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False)
    last_name = serializers.CharField(required=False)

