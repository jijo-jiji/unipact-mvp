from rest_framework import status, generics, views, permissions
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, logout
from django.db import transaction
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import CompanyProfileSerializer, ClubProfileSerializer, UserSerializer, ShadowUserSerializer
from .models import User, CompanyProfile, ClubProfile, ShadowUser
from .utils import is_public_domain

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
        if user.role == User.Role.COMPANY and hasattr(user, 'company_profile'):
            ver_status = user.company_profile.verification_status
        elif user.role == User.Role.CLUB and hasattr(user, 'club_profile'):
            ver_status = user.club_profile.verification_status

        return Response({
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "verification_status": ver_status,
        })

class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, username=email, password=password)

        if user:
            tokens = get_tokens_for_user(user)
            
            # Determine verification status based on role
            ver_status = None
            if user.role == User.Role.COMPANY and hasattr(user, 'company_profile'):
                ver_status = user.company_profile.verification_status
            elif user.role == User.Role.CLUB and hasattr(user, 'club_profile'):
                ver_status = user.club_profile.verification_status

            response = Response({
                "message": "Login successful",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "verification_status": ver_status,
                }
            }, status=status.HTTP_200_OK)
            
            set_auth_cookies(response, tokens)
            return response
        
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

        response = Response({
            "message": "Company registered successfully.",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
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

        response = Response({
            "message": "Club registered successfully. Please wait for admin verification.",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "verification_status": profile.verification_status,
            }
        }, status=status.HTTP_201_CREATED)

        set_auth_cookies(response, tokens)
        return response
