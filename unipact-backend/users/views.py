import logging

from django.conf import settings
from django.utils import timezone
from rest_framework import status, generics, views, permissions
from rest_framework.response import Response
from unipact_backend.throttling import LoginThrottle, RegisterThrottle, TokenRefreshThrottle, PasswordResetThrottle, PasswordChangeThrottle
from unipact_backend import notifications
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, logout
from django.db import transaction
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, CompanyProfile, ClubProfile, StudentProfile, ShadowUser, SystemLog
from django.shortcuts import get_object_or_404

from .utils import is_public_domain
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.pagination import PageNumberPagination
from .serializers import (
    CompanyProfileSerializer, 
    ClubProfileSerializer, 
    StudentProfileSerializer,
    StudentRegistrationSerializer,
    UserSerializer, 
    ShadowUserSerializer, 
    AdminEntityListSerializer,
    ClaimProfileSerializer
)

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

def _cookie_options():
    # Secure/SameSite/domain come from settings so production cookies are HTTPS-only
    return {
        'httponly': True,
        'secure': settings.AUTH_COOKIE_SECURE,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
        'domain': settings.AUTH_COOKIE_DOMAIN,
        'path': '/',
    }

def set_auth_cookies(response, tokens):
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        key='access_token',
        value=tokens['access'],
        max_age=int(jwt['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        **_cookie_options(),
    )
    response.set_cookie(
        key='refresh_token',
        value=tokens['refresh'],
        max_age=int(jwt['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        **_cookie_options(),
    )

def clear_auth_cookies(response):
    options = _cookie_options()
    for name in ('access_token', 'refresh_token'):
        response.delete_cookie(name, path=options['path'], domain=options['domain'], samesite=options['samesite'])

def account_payload(user):
    """The signed-in user's account as the frontend expects it (used by /me/ and the settings endpoint)."""
    ver_status = None
    tier = None
    card_last_4 = None
    card_brand = None

    company_profile_data = None
    club_profile_data = None
    student_profile_data = None

    if user.role == User.Role.COMPANY and hasattr(user, 'company_profile'):
        ver_status = user.company_profile.verification_status
        tier = user.company_profile.tier
        name = user.company_profile.company_name
        card_last_4 = user.company_profile.card_last_4
        card_brand = user.company_profile.card_brand
        company_profile_data = CompanyProfileSerializer(user.company_profile).data
    elif user.role == User.Role.CLUB and hasattr(user, 'club_profile'):
        ver_status = user.club_profile.verification_status
        name = user.club_profile.club_name
        club_profile_data = ClubProfileSerializer(user.club_profile).data
    elif user.role == User.Role.STUDENT and hasattr(user, 'student_profile'):
        ver_status = user.student_profile.verification_status
        name = user.student_profile.full_name
        student_profile_data = StudentProfileSerializer(user.student_profile).data
    else:
        name = user.get_full_name() or user.username

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "name": name,
        "verification_status": ver_status,
        "tier": tier,
        "card_last_4": card_last_4,
        "card_brand": card_brand,
        "company_profile": company_profile_data,
        "club_profile": club_profile_data,
        "student_profile": student_profile_data,
        "has_verification_document": bool(
            getattr(getattr(user, 'student_profile', None), 'verification_document', None)
            or getattr(getattr(user, 'company_profile', None), 'ssm_document', None)
            or getattr(getattr(user, 'club_profile', None), 'verification_document', None)
        ) if user.role != User.Role.ADMIN else None,
    }


class UserView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(account_payload(request.user))


class AccountSettingsView(views.APIView):
    """GET or PATCH the signed-in user's own profile. Email, role, verification and ratings are not editable here."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(account_payload(request.user))

    def patch(self, request):
        from .serializers import StudentSettingsSerializer, CompanySettingsSerializer, ClubSettingsSerializer
        from .utils import log_event

        user = request.user
        config = {
            User.Role.STUDENT: ('student_profile', StudentSettingsSerializer, 'verification_document', StudentProfile.VerificationStatus.PENDING_VERIFICATION),
            User.Role.COMPANY: ('company_profile', CompanySettingsSerializer, 'ssm_document', CompanyProfile.VerificationStatus.PENDING_REVIEW),
            User.Role.CLUB: ('club_profile', ClubSettingsSerializer, 'verification_document', ClubProfile.VerificationStatus.PENDING_VERIFICATION),
        }.get(user.role)
        if not config or not hasattr(user, config[0]):
            return Response({"error": "There is no editable profile for this account."}, status=status.HTTP_400_BAD_REQUEST)

        profile_attr, serializer_class, document_field, pending_status = config
        profile = getattr(user, profile_attr)
        serializer = serializer_class(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = sorted(serializer.validated_data.keys())

        with transaction.atomic():
            profile = serializer.save()
            # A rejected account that uploads a new document goes back into the review queue
            if document_field in serializer.validated_data and profile.verification_status == 'REJECTED':
                profile.verification_status = pending_status
                profile.save(update_fields=['verification_status'])
            if user.role == User.Role.STUDENT and 'full_name' in serializer.validated_data:
                user.first_name = profile.full_name[:150]
                user.save(update_fields=['first_name'])

        if changed:
            log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO, f"Profile updated by {user.email}: {', '.join(changed)}")
        user.refresh_from_db()
        return Response(account_payload(user))


class PasswordChangeView(views.APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PasswordChangeThrottle]

    def post(self, request):
        from .serializers import PasswordChangeSerializer
        from .utils import log_event

        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])

        log_event(SystemLog.Category.SECURITY, SystemLog.Level.INFO, f"Password changed: {user.email}")
        notifications.password_changed(user)

        response = Response({"message": "Your password has been updated."})
        set_auth_cookies(response, get_tokens_for_user(user))  # keep this device signed in
        return response


class PasswordResetRequestView(views.APIView):
    """Always answers the same way so the form can't be used to discover which emails have accounts."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        from urllib.parse import urlencode
        from .serializers import PasswordResetRequestSerializer
        from .utils import log_event

        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user and user.has_usable_password():
            query = urlencode({'uid': urlsafe_base64_encode(force_bytes(user.pk)), 'token': default_token_generator.make_token(user)})
            notifications.password_reset(user, f'/reset-password?{query}')
            log_event(SystemLog.Category.SECURITY, SystemLog.Level.INFO, f"Password reset requested: {user.email}")

        return Response({"message": "If an account exists for that email, we've sent a link to reset the password."})


class PasswordResetConfirmView(views.APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode
        from .serializers import PasswordResetConfirmSerializer
        from .utils import log_event

        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invalid = Response({"error": "This reset link is invalid or has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(data['uid'])), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return invalid
        # Tokens are tied to the current password hash, so each link works only once
        if not default_token_generator.check_token(user, data['token']):
            return invalid

        try:
            from django.contrib.auth.password_validation import validate_password
            from django.core.exceptions import ValidationError as DjangoValidationError
            validate_password(data['password'], user=user)
        except DjangoValidationError as exc:
            return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(data['password'])
        user.save(update_fields=['password'])
        log_event(SystemLog.Category.SECURITY, SystemLog.Level.INFO, f"Password reset completed: {user.email}")
        notifications.password_changed(user)

        response = Response({"message": "Your password has been reset. You can now sign in."})
        clear_auth_cookies(response)
        return response

class LoginView(views.APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, username=email, password=password)

        if user:
            tokens = get_tokens_for_user(user)
            
            # Determine verification status and name based on role
            ver_status = None
            company_profile_data = None
            club_profile_data = None
            student_profile_data = None
            name = user.username

            if user.role == User.Role.COMPANY and hasattr(user, 'company_profile'):
                ver_status = user.company_profile.verification_status
                name = user.company_profile.company_name
                company_profile_data = CompanyProfileSerializer(user.company_profile).data
            elif user.role == User.Role.CLUB and hasattr(user, 'club_profile'):
                ver_status = user.club_profile.verification_status
                name = user.club_profile.club_name
                club_profile_data = ClubProfileSerializer(user.club_profile).data
            elif user.role == User.Role.STUDENT and hasattr(user, 'student_profile'):
                ver_status = user.student_profile.verification_status
                name = user.student_profile.full_name
                student_profile_data = StudentProfileSerializer(user.student_profile).data

            response = Response({
                "message": "Login successful",
                "role": user.role,
                "verification_status": ver_status,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "name": name,
                    "verification_status": ver_status,
                    "company_profile": company_profile_data,
                    "club_profile": club_profile_data,
                    "student_profile": student_profile_data
                }
            }, status=status.HTTP_200_OK)

            set_auth_cookies(response, tokens)
            
            # Log Success
            from .models import SystemLog
            from .utils import log_event
            log_event(SystemLog.Category.SECURITY, SystemLog.Level.SUCCESS, f"User Login: {email}")

            return response
        
        # Log Failure
        from .models import SystemLog
        from .utils import log_event
        # Differentiate simple failure vs suspicious later, for now just WARNING
        log_event(SystemLog.Category.SECURITY, SystemLog.Level.WARNING, f"Failed Login: {email}")
        
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

class CookieTokenRefreshView(views.APIView):
    """Issues a fresh access token from the HttpOnly refresh cookie so sessions survive the 60-minute access lifetime."""
    permission_classes = [AllowAny]
    throttle_classes = [TokenRefreshThrottle]
    authentication_classes = []

    def post(self, request):
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer
        from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

        raw_refresh = request.COOKIES.get('refresh_token')
        if not raw_refresh:
            return Response({"error": "No active session."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={'refresh': raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken, exceptions.ValidationError):
            response = Response({"error": "Session expired. Please sign in again."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(response)
            return response

        tokens = {
            'access': serializer.validated_data['access'],
            # ROTATE_REFRESH_TOKENS issues a new refresh token; fall back to the current one otherwise
            'refresh': serializer.validated_data.get('refresh', raw_refresh),
        }
        response = Response({"message": "Session refreshed"}, status=status.HTTP_200_OK)
        set_auth_cookies(response, tokens)
        return response

class LogoutView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"message": "Logout successful"}, status=status.HTTP_200_OK)
        clear_auth_cookies(response)
        return response

class InviteMemberView(generics.CreateAPIView):
    serializer_class = ShadowUserSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Validate that requester is a Club
        if self.request.user.role != User.Role.CLUB:
             raise exceptions.PermissionDenied("Only clubs can invite members.")
        
        email = serializer.validated_data['email']
        
        # Check if already in roster (ShadowUser exists for this club)
        if ShadowUser.objects.filter(email=email, invited_by=self.request.user.club_profile).exists():
             raise exceptions.ValidationError("User is already a member or has a pending invite.")

        import uuid
        token = str(uuid.uuid4())

        # Check if User already exists in the system
        existing_user = User.objects.filter(email=email).first()

        if existing_user:
            raise exceptions.ValidationError("User with this email is already registered.")

        # Standard Invite for new user
        serializer.save(invited_by=self.request.user.club_profile, token=token)
        # Club roster invites (postponed V2.2.1 track): there is no claim page in the frontend yet, so no email is sent
        logging.getLogger(__name__).info('Club invitation created for %s', email)

class ClaimProfileView(views.APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        serializer = ClaimProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data['token']
        password = serializer.validated_data['password']
        first_name = serializer.validated_data.get('first_name', '')
        last_name = serializer.validated_data.get('last_name', '')

        try:
            shadow = ShadowUser.objects.get(token=token, is_claimed=False)
        except ShadowUser.DoesNotExist:
            return Response({"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create User
            user = User.objects.create_user(
                username=shadow.email, # Use email as username
                email=shadow.email,
                password=password,
                role=User.Role.CLUB,  # Or a new 'STUDENT' role? For now Club Member is just a user
                first_name=first_name,
                last_name=last_name
            )
            
            # Link & Claim
            shadow.user = user
            shadow.is_claimed = True
            shadow.save()

        # Generate tokens
        tokens = get_tokens_for_user(user)
        response = Response({
            "message": "Profile claimed successfully!",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": f"{first_name} {last_name}"
            }
        }, status=status.HTTP_201_CREATED)
        
        set_auth_cookies(response, tokens)
        return response

class TransferOwnershipView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Only existing President (Club Profile Owner) can do this
        if request.user.role != User.Role.CLUB or not hasattr(request.user, 'club_profile'):
             raise exceptions.PermissionDenied("Only Club Presidents can transfer ownership.")
        
        club_profile = request.user.club_profile
        new_owner_email = request.data.get('new_owner_email')
        
        if not new_owner_email:
            return Response({"error": "New owner email is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Find the new owner
        # They must be a claimed member (linked via ShadowUser) OR just a valid User
        try:
            new_owner = User.objects.get(email=new_owner_email)
        except User.DoesNotExist:
             return Response({"error": "User not found. Invite them first."}, status=status.HTTP_404_NOT_FOUND)

        if new_owner.role != User.Role.CLUB:
             return Response({"error": "New owner must be a Club/Student user."}, status=status.HTTP_400_BAD_REQUEST)

        # Logic: Swap
        # The ClubProfile is OneToOne with User. We need to update that FK.
        # But OneToOne is unique. request.user is currently holding it.
        # So:
        # 1. Update request.user.club_profile = None? No, accessed via related_name.
        #    We set club_profile.user = new_owner.
        
        with transaction.atomic():
            club_profile.user = new_owner
            club_profile.save()
            
            # Log
            from .models import SystemLog
            from .utils import log_event
            log_event(SystemLog.Category.SECURITY, SystemLog.Level.WARNING, f"Club Ownership Transferred: {club_profile.club_name} from {request.user.email} -> {new_owner_email}")

        return Response({
            "message": f"Ownership transferred to {new_owner_email}. You are no longer the President."
        })

class ClubPublicProfileView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            profile = ClubProfile.objects.get(user_id=user_id)
            from .serializers import PublicClubProfileSerializer
            serializer = PublicClubProfileSerializer(profile)
            return Response(serializer.data)
        except ClubProfile.DoesNotExist:
            return Response({"error": "Club not found"}, status=status.HTTP_404_NOT_FOUND)

class StudentPublicProfileView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        # Portfolio links use the user id; fall back to the profile id for older links.
        # Matching both in one OR query could return a different student whose ids collide.
        profile = (
            StudentProfile.objects.filter(user_id=user_id).first()
            or StudentProfile.objects.filter(id=user_id).first()
        )
        if not profile:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        completed = profile.assigned_jobs.filter(status='COMPLETED')
        showcase = []
        for c in completed:
            showcase.append({
                'id': c.id,
                'title': c.title,
                'company_name': c.company.company_name,
                'type': c.type,
                'requirements': c.requirements,
                'completed_at': c.updated_at
            })

        return Response({
            'id': profile.id,
            'user_id': profile.user.id,
            'full_name': profile.full_name,
            'university': profile.university,
            'major': profile.major,
            'domain_focus': profile.domain_focus,
            'skills': profile.skills,
            'bio': profile.bio,
            'rating': str(profile.rating),
            'verification_status': profile.verification_status,
            'club_affiliation_name': profile.club_affiliation_name,
            'club_affiliation_role': profile.club_affiliation_role,
            'completed_projects': showcase
        })

class ClubRosterView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            club_profile = ClubProfile.objects.get(user_id=user_id)
        except ClubProfile.DoesNotExist:
            return Response({"error": "Club not found"}, status=status.HTTP_404_NOT_FOUND)

        shadow_users = ShadowUser.objects.filter(invited_by=club_profile)
        
        roster_data = []
        
        # Add President
        president = {
            'id': club_profile.user.id,
            'email': club_profile.user.email,
            'name': club_profile.user.first_name + " " + club_profile.user.last_name if club_profile.user.first_name else "President",
            'role': 'President',
            'status': 'ACTIVE',
            'joined_at': club_profile.user.date_joined
        }
        roster_data.append(president)

        for shadow in shadow_users:
            member = {
                'email': shadow.email,
                'role': shadow.role,
                'invited_by': shadow.invited_by.club_name,
                'created_at': shadow.created_at
            }
            
            if shadow.is_claimed and shadow.user:
                member['id'] = shadow.user.id
                member['name'] = shadow.user.first_name + " " + shadow.user.last_name
                member['status'] = 'Active Member'
            else:
                member['id'] = None
                member['name'] = "Pending Invitation"
                member['status'] = 'Pending'
            
            roster_data.append(member)
        
        return Response(roster_data)

class RegisterCompanyView(generics.CreateAPIView):
    queryset = CompanyProfile.objects.all()
    serializer_class = CompanyProfileSerializer
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        company_name = serializer.validated_data['company_name']
        company_details = serializer.validated_data.get('company_details', '')

        if User.objects.filter(email__iexact=email).exists():
            return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create User
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                role=User.Role.COMPANY,
                terms_accepted_at=timezone.now(),
            )

            # Determine Verification Status
            if is_public_domain(email):
                ver_status = CompanyProfile.VerificationStatus.HIGH_RISK
            else:
                ver_status = CompanyProfile.VerificationStatus.PENDING_REVIEW

            # Create Profile
            profile = CompanyProfile.objects.create(
                user=user,
                company_name=company_name,
                company_details=company_details,
                verification_status=ver_status
            )

        # Generate Tokens & Login
        tokens = get_tokens_for_user(user)

        from .models import SystemLog
        from .utils import log_event

        if profile.verification_status == CompanyProfile.VerificationStatus.HIGH_RISK:
            log_event(SystemLog.Category.SECURITY, SystemLog.Level.CRITICAL, f"High Risk Reg: {email} (Public Domain)")
        else:
            log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO, f"New Company Joined: {company_name}")
        notifications.welcome(user)

        response = Response({
            "message": "Company registered successfully.",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "name": company_name,
                "verification_status": profile.verification_status,
            }
        }, status=status.HTTP_201_CREATED)

        set_auth_cookies(response, tokens)
        return response

class RegisterClubView(generics.CreateAPIView):
    queryset = ClubProfile.objects.all()
    serializer_class = ClubProfileSerializer
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        club_name = serializer.validated_data['club_name']
        university = serializer.validated_data['university']
        # File handling would happen here if passed in request.FILES

        if User.objects.filter(email__iexact=email).exists():
            return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create User
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                role=User.Role.CLUB,
                terms_accepted_at=timezone.now(),
            )

            # Create Profile
            profile = ClubProfile.objects.create(
                user=user,
                club_name=club_name,
                university=university,
                verification_status=ClubProfile.VerificationStatus.PENDING_VERIFICATION
            )
            
            # Handle Document Upload if present in request context
            if 'verification_document' in request.FILES:
                profile.verification_document = request.FILES['verification_document']
                profile.save()

        # Generate Tokens & Login
        tokens = get_tokens_for_user(user)

        from .models import SystemLog
        from .utils import log_event
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO, f"New Club Joined: {club_name} ({university})")
        notifications.welcome(user)

        response = Response({
            "message": "Club registered successfully. Please wait for admin verification.",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "name": club_name,
                "verification_status": profile.verification_status,
            }
        }, status=status.HTTP_201_CREATED)

        set_auth_cookies(response, tokens)
        return response

class RegisterStudentView(generics.CreateAPIView):
    serializer_class = StudentRegistrationSerializer
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        full_name = serializer.validated_data['full_name']
        university = serializer.validated_data['university']
        major = serializer.validated_data.get('major', '')
        domain_focus = serializer.validated_data.get('domain_focus', 'SOFTWARE_DEV')
        secondary_email = serializer.validated_data.get('secondary_email')
        club_name = serializer.validated_data.get('club_affiliation_name')
        club_role = serializer.validated_data.get('club_affiliation_role')
        skills = serializer.validated_data.get('skills') or []
        bio = serializer.validated_data.get('bio', '')

        if User.objects.filter(email__iexact=email).exists():
            return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                role=User.Role.STUDENT,
                first_name=full_name[:150],
                terms_accepted_at=timezone.now(),
            )

            profile = StudentProfile.objects.create(
                user=user,
                full_name=full_name,
                university=university,
                major=major,
                domain_focus=domain_focus,
                secondary_email=secondary_email,
                club_affiliation_name=club_name,
                club_affiliation_role=club_role,
                skills=skills,
                bio=bio,
                verification_status=StudentProfile.VerificationStatus.PENDING_VERIFICATION
            )

            doc = request.FILES.get('verification_doc') or request.FILES.get('verification_document')
            if doc:
                profile.verification_document = doc
                profile.save()

        tokens = get_tokens_for_user(user)

        from .models import SystemLog
        from .utils import log_event
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO, f"New Student Talent Joined: {full_name} ({university})")
        notifications.welcome(user)

        response = Response({
            "message": "Student talent registered successfully. Account pending Admin verification.",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "name": full_name,
                "verification_status": profile.verification_status,
                "student_profile": StudentProfileSerializer(profile).data
            }
        }, status=status.HTTP_201_CREATED)

        set_auth_cookies(response, tokens)
        return response

class AdminDashboardStatsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
            raise exceptions.PermissionDenied("Admin access required.")
        
        pending_reviews = CompanyProfile.objects.filter(verification_status=CompanyProfile.VerificationStatus.PENDING_REVIEW).count() + \
                          ClubProfile.objects.filter(verification_status=ClubProfile.VerificationStatus.PENDING_VERIFICATION).count() + \
                          StudentProfile.objects.filter(verification_status=StudentProfile.VerificationStatus.PENDING_VERIFICATION).count()
        system_flags = CompanyProfile.objects.filter(verification_status=CompanyProfile.VerificationStatus.HIGH_RISK).count()
        total_users = User.objects.count()
        
        # Dynamic Revenue
        from payments.models import Transaction
        from django.db.models import Sum
        
        total_rev = Transaction.objects.filter(status=Transaction.Status.SUCCESS).aggregate(Sum('amount'))['amount__sum'] or 0
        
        return Response({
            "pending_reviews": pending_reviews,
            "system_flags": system_flags,
            "total_users": total_users,
            "total_revenue": total_rev
        })

class AdminVerificationQueueView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")

        pending_companies = CompanyProfile.objects.filter(verification_status__in=[
            CompanyProfile.VerificationStatus.PENDING_REVIEW,
            CompanyProfile.VerificationStatus.HIGH_RISK
        ])
        
        pending_clubs = ClubProfile.objects.filter(verification_status=ClubProfile.VerificationStatus.PENDING_VERIFICATION)
        pending_students = StudentProfile.objects.filter(verification_status=StudentProfile.VerificationStatus.PENDING_VERIFICATION)

        from .serializers import AdminCompanyVerificationSerializer, AdminClubVerificationSerializer
        
        # Request context makes document URLs absolute, so admins can open them from the frontend
        context = {'request': request}
        company_data = AdminCompanyVerificationSerializer(pending_companies, many=True, context=context).data
        club_data = AdminClubVerificationSerializer(pending_clubs, many=True, context=context).data
        student_data = StudentProfileSerializer(pending_students, many=True, context=context).data
        
        # Combine and structure for frontend
        results = []
        for c in company_data:
            c['type'] = 'COMPANY'
            results.append(c)
        
        for c in club_data:
            c['type'] = 'CLUB'
            results.append(c)

        for s in student_data:
            s['type'] = 'STUDENT'
            results.append(s)
            
        return Response(results)

class AdminVerifyEntityView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, entity_type, entity_id):
        if request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")
        
        action = request.data.get('action') # 'approve', 'reject', 'high_risk'
        allowed_actions = ('approve', 'reject', 'high_risk') if entity_type == 'COMPANY' else ('approve', 'reject')
        if action not in allowed_actions:
            return Response({"error": f"Invalid action. Use one of: {', '.join(allowed_actions)}."}, status=status.HTTP_400_BAD_REQUEST)

        if entity_type == 'COMPANY':
            try:
                profile = CompanyProfile.objects.get(id=entity_id)
                if action == 'approve':
                    profile.verification_status = CompanyProfile.VerificationStatus.VERIFIED
                elif action == 'reject':
                    profile.verification_status = CompanyProfile.VerificationStatus.REJECTED
                elif action == 'high_risk':
                    profile.verification_status = CompanyProfile.VerificationStatus.HIGH_RISK
                profile.save()
            except CompanyProfile.DoesNotExist:
                return Response({"error": "Company not found"}, status=status.HTTP_404_NOT_FOUND)
        
        elif entity_type == 'CLUB':
            try:
                profile = ClubProfile.objects.get(id=entity_id)
                if action == 'approve':
                    profile.verification_status = ClubProfile.VerificationStatus.VERIFIED
                elif action == 'reject':
                    profile.verification_status = ClubProfile.VerificationStatus.REJECTED
                profile.save()
            except ClubProfile.DoesNotExist:
                return Response({"error": "Club not found"}, status=status.HTTP_404_NOT_FOUND)

        elif entity_type == 'STUDENT':
            try:
                profile = StudentProfile.objects.get(id=entity_id)
                if action == 'approve':
                    profile.verification_status = StudentProfile.VerificationStatus.VERIFIED
                    profile.user.is_verified = True
                    profile.user.save()
                elif action == 'reject':
                    profile.verification_status = StudentProfile.VerificationStatus.REJECTED
                profile.save()
            except StudentProfile.DoesNotExist:
                return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        
        else:
             return Response({"error": "Invalid entity type"}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import SystemLog
        from .utils import log_event
        
        log_event(
            SystemLog.Category.SECURITY,
            SystemLog.Level.INFO,
            f"Admin {action.replace('_', ' ')} for {entity_type.lower()} #{entity_id}"
        )
        if action in ('approve', 'reject'):
            notifications.verification_result(profile.user, approved=(action == 'approve'))

        return Response({"message": f"Entity {action}d successfully"})

class AdminSystemLogsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")
        
        from .models import SystemLog
        from .serializers import SystemLogSerializer
        
        logs = SystemLog.objects.all()[:50]
        serializer = SystemLogSerializer(logs, many=True)
        return Response(serializer.data)
        
class AdminStudentPoolView(views.APIView):
    """Student profiles for the Matchmaking Hub. The match endpoint expects StudentProfile ids, not User ids."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
            raise exceptions.PermissionDenied("Admin access required.")

        students = StudentProfile.objects.filter(user__is_active=True).select_related('user').order_by('-verification_status', 'full_name')
        return Response(StudentProfileSerializer(students, many=True).data)

class AdminEntityListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AdminEntityListSerializer
    pagination_class = PageNumberPagination
    pagination_class.page_size = 10 # Explicitly set page size
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['role', 'company_profile__tier', 'club_profile__rank']
    search_fields = ['email', 'company_profile__company_name', 'club_profile__club_name', 'student_profile__full_name']

    def get_queryset(self):
        if self.request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")
        return User.objects.filter(role__in=[User.Role.CLUB, User.Role.COMPANY, User.Role.STUDENT]).order_by('-date_joined')

class AdminBlockUserView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")
        
        if user_id == request.user.id:
            return Response({"error": "You cannot block your own account."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
            # Toggle status
            user.is_active = not user.is_active
            user.save()
            
            from .models import SystemLog
            from .utils import log_event
            status_str = "Unblocked" if user.is_active else "Blocked"
            log_event(SystemLog.Category.SECURITY, SystemLog.Level.WARNING, f"Admin {status_str} User: {user.email}")
            
            return Response({"message": f"User {status_str} successfully", "is_active": user.is_active})
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
