from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Campaign, Application
from .serializers import CampaignSerializer, CampaignDetailSerializer, ApplicationSerializer, DeliverableSerializer
from users.models import User, CompanyProfile
from payments.models import Transaction, Subscription
from .utils import generate_campaign_report

class IsCompany(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == User.Role.COMPANY

class IsClub(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == User.Role.CLUB

class CampaignListCreateView(generics.ListCreateAPIView):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Ensure only companies can create
        if self.request.user.role != User.Role.COMPANY:
            raise exceptions.PermissionDenied("Only companies can create campaigns.")
        
        # Check if company is verified enough to post
        company_profile = self.request.user.company_profile
        if company_profile.verification_status == CompanyProfile.VerificationStatus.HIGH_RISK:
             raise exceptions.PermissionDenied("Your account is under review (High Risk). You cannot post campaigns yet.")

        serializer.save(company=self.request.user.company_profile, status=Campaign.Status.OPEN)

class CampaignDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Campaign.objects.all()
    serializer_class = CampaignDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Companies can only edit their own
        if self.request.user.role == User.Role.COMPANY:
            return Campaign.objects.filter(company=self.request.user.company_profile)
        return Campaign.objects.all() # Clubs can view all (read-only logic needed in serializer or permission)

class ApplicationCreateView(generics.CreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsClub]

    def perform_create(self, serializer):
        campaign_id = self.kwargs['campaign_id']
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        
        if campaign.status != Campaign.Status.OPEN:
             raise exceptions.PermissionDenied("This campaign is not open for applications.")

        # Check for existing application
        if Application.objects.filter(campaign=campaign, club=self.request.user.club_profile).exists():
            raise exceptions.PermissionDenied("You have already applied to this campaign.")

        serializer.save(club=self.request.user.club_profile, campaign=campaign)

class MyApplicationsView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsClub]

    def get_queryset(self):
        return Application.objects.filter(club=self.request.user.club_profile)

class AwardApplicationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompany]

    def post(self, request, application_id):
        application = get_object_or_404(Application, pk=application_id)
        campaign = application.campaign

        # Verify ownership
        if campaign.company != request.user.company_profile:
            return Response({"error": "You do not own this campaign."}, status=status.HTTP_403_FORBIDDEN)

        # Monetization Logic
        company_profile = request.user.company_profile
        if company_profile.tier == CompanyProfile.Tier.FREE:
            # Check for successful Finder's Fee transaction for this campaign
            has_paid = Transaction.objects.filter(
                company=company_profile,
                related_campaign=campaign,
                transaction_type=Transaction.Type.FINDERS_FEE,
                status=Transaction.Status.SUCCESS
            ).exists()
            
            if not has_paid:
                return Response({
                    "error": "Payment Required. Please pay the Finder's Fee to unlock this award.",
                    "code": "payment_required"
                }, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        # Update Application Statuses
        application.status = Application.Status.AWARDED
        application.save()

        # Reject others
        Application.objects.filter(campaign=campaign).exclude(id=application_id).update(status=Application.Status.NOT_SELECTED)
        
        # Update Campaign Status
        campaign.status = Campaign.Status.IN_PROGRESS
        campaign.save()

        return Response({"message": "Application awarded successfully."}, status=status.HTTP_200_OK)

class DeliverableCreateView(generics.CreateAPIView):
    serializer_class = DeliverableSerializer
    permission_classes = [permissions.IsAuthenticated, IsClub]

    def perform_create(self, serializer):
        application_id = self.kwargs['application_id']
        application = get_object_or_404(Application, pk=application_id)

        # Verify club ownership
        if application.club != self.request.user.club_profile:
            raise exceptions.PermissionDenied("You do not own this application.")

        # Verify status
        if application.status != Application.Status.AWARDED:
            raise exceptions.PermissionDenied("You can only upload deliverables for awarded applications.")

        serializer.save(application=application)
        
        # Optional: Auto-mark campaign/application as Completed? 
        # For now, we leave it as IN_PROGRESS until manually completed or by some other logic.

class MarkCampaignCompletedView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompany]

    def post(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        
        # Verify ownership
        if campaign.company != request.user.company_profile:
             return Response({"error": "You do not own this campaign."}, status=status.HTTP_403_FORBIDDEN)

        # Verify status
        if campaign.status != Campaign.Status.IN_PROGRESS:
            return Response({"error": "Campaign must be in progress to complete."}, status=status.HTTP_400_BAD_REQUEST)

        # Mark as completed
        campaign.status = Campaign.Status.COMPLETED
        campaign.save()

        # Generate Report
        try:
            report = generate_campaign_report(campaign)
            report_url = report.generated_pdf.url
        except Exception as e:
            print(f"Report generation failed: {e}")
            report_url = None
        
        return Response({
            "message": "Mission Accomplished. Campaign marked as completed.",
            "report_url": report_url
        }, status=status.HTTP_200_OK)
