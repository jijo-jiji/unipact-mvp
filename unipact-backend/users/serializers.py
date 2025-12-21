from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import CompanyProfile, ClubProfile, ShadowUser

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'role', 'is_verified']
        read_only_fields = ['role', 'is_verified']

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
        fields = ['club_name', 'university', 'email', 'password', 'verification_status', 'verification_document']
        read_only_fields = ['verification_status']

class ShadowUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShadowUser
        fields = ['email', 'role', 'invited_by', 'created_at']
        read_only_fields = ['invited_by', 'created_at']
