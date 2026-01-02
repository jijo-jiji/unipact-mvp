from rest_framework import status, generics, views, permissions
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, logout
from django.db import transaction
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, CompanyProfile, ClubProfile, ShadowUser, SystemLog
from django.shortcuts import get_object_or_404

from .utils import is_public_domain
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.pagination import PageNumberPagination
from .serializers import (
    CompanyProfileSerializer, 
    ClubProfileSerializer, 
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

def set_auth_cookies(response, tokens):
    response.set_cookie(
        key='access_token',
        value=tokens['access'],
        httponly=True,
        samesite='Lax',
        secure=False, # Set to True in production
    )
    response.set_cookie(
        key='refresh_token',
        value=tokens['refresh'],
        httponly=True,
        samesite='Lax',
        secure=False, # Set to True in production
    )

class UserView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        ver_status = None
        tier = None
        card_last_4 = None
        card_brand = None
        
        if user.role == User.Role.COMPANY and hasattr(user, 'company_profile'):
            ver_status = user.company_profile.verification_status
            tier = user.company_profile.tier
            name = user.company_profile.company_name
            card_last_4 = user.company_profile.card_last_4
            card_brand = user.company_profile.card_brand
        elif user.role == User.Role.CLUB and hasattr(user, 'club_profile'):
            ver_status = user.club_profile.verification_status
            name = user.club_profile.club_name
        else:
            name = user.username

        return Response({
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "name": name,
            "verification_status": ver_status,
            "tier": tier,
            "card_last_4": card_last_4,
            "card_brand": card_brand,
        })

class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, username=email, password=password)

        if user:
            tokens = get_tokens_for_user(user)
            
            # Determine verification status and name based on role
            ver_status = None
            name = user.username
            if user.role == User.Role.COMPANY and hasattr(user, 'company_profile'):
                ver_status = user.company_profile.verification_status
                name = user.company_profile.company_name
            elif user.role == User.Role.CLUB and hasattr(user, 'club_profile'):
                ver_status = user.club_profile.verification_status
                name = user.club_profile.club_name

            response = Response({
                "message": "Login successful",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "name": name,
                    "verification_status": ver_status,
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

class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = Response({"message": "Logout successful"}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response

class InviteMemberView(generics.CreateAPIView):
    serializer_class = ShadowUserSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Validate that requester is a Club
        if self.request.user.role != User.Role.CLUB:
             raise exceptions.PermissionDenied("Only clubs can invite members.")
        
        email = serializer.validated_data['email']
        
        # Check if User already exists
        if User.objects.filter(email=email).exists():
            raise exceptions.ValidationError("User with this email already exists.")

        # Check if already invited
        if ShadowUser.objects.filter(email=email).exists():
            raise exceptions.ValidationError("User already invited.")

        import uuid
        token = str(uuid.uuid4())

        serializer.save(invited_by=self.request.user.club_profile, token=token)

        # Mock Email Sending
        print(f"Sending invitation to {email} with token {token}")

class ClaimProfileView(views.APIView):
    permission_classes = [AllowAny]

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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        company_name = serializer.validated_data['company_name']
        company_details = serializer.validated_data.get('company_details', '')

        with transaction.atomic():
            # Create User
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                role=User.Role.COMPANY
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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        club_name = serializer.validated_data['club_name']
        university = serializer.validated_data['university']
        # File handling would happen here if passed in request.FILES

        with transaction.atomic():
            # Create User
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                role=User.Role.CLUB
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

class AdminDashboardStatsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
            raise exceptions.PermissionDenied("Admin access required.")
        
        pending_reviews = CompanyProfile.objects.filter(verification_status=CompanyProfile.VerificationStatus.PENDING_REVIEW).count() + \
                          ClubProfile.objects.filter(verification_status=ClubProfile.VerificationStatus.PENDING_VERIFICATION).count()
        system_flags = CompanyProfile.objects.filter(verification_status=CompanyProfile.VerificationStatus.HIGH_RISK).count()
        total_users = User.objects.count()
        
        # Dynamic Revenue
        from payments.models import Transaction
        from django.db.models import Sum
        
        total_rev = Transaction.objects.filter(status=Transaction.Status.SUCCESS).aggregate(Sum('amount'))['amount__sum'] or 0
        revenue = f"RM {total_rev:,.2f}" 

        return Response({
            "pending_reviews": pending_reviews,
            "system_flags": system_flags,
            "total_users": total_users,
            "revenue": revenue
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

        from .serializers import AdminCompanyVerificationSerializer, AdminClubVerificationSerializer
        
        company_data = AdminCompanyVerificationSerializer(pending_companies, many=True).data
        club_data = AdminClubVerificationSerializer(pending_clubs, many=True).data
        
        # Combine and structure for frontend
        results = []
        for c in company_data:
            c['type'] = 'COMPANY'
            results.append(c)
        
        for c in club_data:
            c['type'] = 'CLUB'
            results.append(c)
            
        return Response(results)

class AdminVerifyEntityView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, entity_type, entity_id):
        if request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")
        
        action = request.data.get('action') # 'approve', 'reject', 'high_risk'
        
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
        
        else:
             return Response({"error": "Invalid entity type"}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import SystemLog
        from .utils import log_event
        
        log_event(
            SystemLog.Category.SECURITY,
            SystemLog.Level.INFO,
            f"Admin {action.upper()}D entity {entity_id} ({entity_type})"
        )

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
        
class AdminEntityListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AdminEntityListSerializer
    pagination_class = PageNumberPagination
    pagination_class.page_size = 10 # Explicitly set page size
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['role', 'company_profile__tier', 'club_profile__rank']
    search_fields = ['email', 'company_profile__company_name', 'club_profile__club_name']

    def get_queryset(self):
        if self.request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")
        return User.objects.filter(role__in=[User.Role.CLUB, User.Role.COMPANY]).order_by('-date_joined')

class AdminBlockUserView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.role != User.Role.ADMIN:
             raise exceptions.PermissionDenied("Admin access required.")
        
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
