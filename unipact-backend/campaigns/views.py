import logging

from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Campaign, Application
from .serializers import CampaignSerializer, CampaignDetailSerializer, ApplicationSerializer, DeliverableSerializer, can_view_workspace
from users.models import User, CompanyProfile, StudentProfile
from payments.models import Transaction, Subscription
from .utils import generate_campaign_report
from unipact_backend.validators import validate_project_file_upload
from unipact_backend import notifications

logger = logging.getLogger(__name__)


class IsCompany(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == User.Role.COMPANY

class IsClub(permissions.BasePermission):
    def has_permission(self, request, view):
        # Committee members (joined via invitation) share the CLUB role but act through their president's ClubProfile
        return request.user.role == User.Role.CLUB and hasattr(request.user, 'club_profile')

class CampaignListCreateView(generics.ListCreateAPIView):
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        mode = self.request.query_params.get('mode')
        # Mode: my_campaigns (For Companies to manage their own)
        if mode == 'my_campaigns' and self.request.user.role == User.Role.COMPANY:
            return Campaign.objects.filter(company=self.request.user.company_profile).select_related('company')
        
        # Admin access: can view all or filter by status
        if self.request.user.role == User.Role.ADMIN:
            status_param = self.request.query_params.get('status')
            if status_param:
                return Campaign.objects.filter(status=status_param).select_related('company')
            return Campaign.objects.all().select_related('company')

        # Default: Only show OPEN campaigns (Public Board)
        return Campaign.objects.filter(status=Campaign.Status.OPEN).select_related('company')

    def perform_create(self, serializer):
        # Ensure only companies can create
        if self.request.user.role != User.Role.COMPANY:
            raise exceptions.PermissionDenied("Only companies can create campaigns.")
        
        # Check if company is verified enough to post
        company_profile = self.request.user.company_profile
        if company_profile.verification_status == CompanyProfile.VerificationStatus.HIGH_RISK:
             raise exceptions.PermissionDenied("Your account is under review (High Risk). You cannot post campaigns yet.")

        instance = serializer.save(company=self.request.user.company_profile, status=Campaign.Status.OPEN)

        # Log Event
        from users.models import SystemLog
        from users.utils import log_event
        log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.INFO, f"New Quest: '{instance.title}' posted by {self.request.user.company_profile.company_name}")

class CampaignDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Campaign.objects.all()
    serializer_class = CampaignDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Companies can only view and edit their own
        if self.request.user.role == User.Role.COMPANY:
            return Campaign.objects.filter(company=self.request.user.company_profile).prefetch_related('applications__club__user')
        return Campaign.objects.all().select_related('company').prefetch_related('applications__club__user')

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Everyone else is read-only: only the owning company or an admin may edit or delete
        if request.method not in permissions.SAFE_METHODS and request.user.role not in (User.Role.COMPANY, User.Role.ADMIN):
            raise exceptions.PermissionDenied("You do not have permission to modify this campaign.")

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

        application = serializer.save(club=self.request.user.club_profile, campaign=campaign)
        notifications.club_application_received(application)

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

        from users.models import SystemLog
        from users.utils import log_event
        log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.SUCCESS, f"Contract Awarded: {application.club.club_name} -> {company_profile.company_name}")
        notifications.club_contract_awarded(application)

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
        
        # Update Status to SUBMITTED
        application.status = Application.Status.SUBMITTED
        application.save()
        
        # Log Logic
        from users.models import SystemLog
        from users.utils import log_event
        log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.INFO, f"Deliverable Submitted: {application.club.club_name} -> {application.campaign.title}")
        notifications.work_submitted(application.campaign, application.club.club_name, 'Club deliverable')

class MarkCampaignCompletedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        
        # Verify permissions: company owner, awarded club, assigned student, or admin
        is_owner = (request.user.role == User.Role.COMPANY and hasattr(request.user, 'company_profile') and campaign.company == request.user.company_profile)
        is_club = (request.user.role == User.Role.CLUB and hasattr(request.user, 'club_profile') and campaign.applications.filter(club=request.user.club_profile, status__in=[Application.Status.AWARDED, Application.Status.SUBMITTED]).exists())
        is_student = (request.user.role == User.Role.STUDENT and hasattr(request.user, 'student_profile') and campaign.assigned_students.filter(id=request.user.student_profile.id).exists())

        if not (is_owner or is_club or is_student or request.user.role == User.Role.ADMIN):
            return Response({"error": "You do not have permission to complete this campaign."}, status=status.HTTP_403_FORBIDDEN)

        # Verify status
        if campaign.status not in [Campaign.Status.IN_PROGRESS, Campaign.Status.OPEN]:
            return Response({"error": "Campaign must be in progress to complete."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. HANDLE REVIEW CREATION
        # Only the client who owns the campaign may rate the talent; ignore ratings from anyone else
        rating = request.data.get('rating') if is_owner else None
        feedback = request.data.get('feedback')
        if rating is not None:
            try:
                rating = int(rating)
            except (TypeError, ValueError):
                return Response({"error": "Rating must be a whole number from 1 to 5."}, status=status.HTTP_400_BAD_REQUEST)
            if not 1 <= rating <= 5:
                return Response({"error": "Rating must be a whole number from 1 to 5."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Find the accepted application (could be AWARDED or SUBMITTED)
            accepted_app = campaign.applications.filter(
                status__in=[Application.Status.AWARDED, Application.Status.SUBMITTED]
            ).first()

            if accepted_app:
                if rating:
                    club = accepted_app.club
                    from reviews.models import Review
                    Review.objects.create(
                        reviewer=request.user.company_profile,
                        reviewee=club,
                        campaign=campaign,
                        rating=rating,
                        comment=feedback or "No feedback provided."
                    )
                    # Recalculate Rank
                    club.calculate_rank()
                
                # Mark Application as COMPLETED
                accepted_app.status = Application.Status.COMPLETED
                accepted_app.save()

            # Handle V3.0 assigned students rating
            if campaign.assigned_students.exists() and rating:
                for student in campaign.assigned_students.all():
                    student.rating = rating
                    student.save()

        except Exception:
            logger.exception('Error processing review/completion for campaign %s', campaign.id)

        # 2. MARK AS COMPLETED
        campaign.status = Campaign.Status.COMPLETED
        campaign.save()
        notifications.project_completed(campaign, rating)

        # Generate Report
        try:
            report = generate_campaign_report(campaign)
            report_url = request.build_absolute_uri(report.generated_pdf.url)
        except Exception:
            logger.exception('Report generation failed for campaign %s', campaign.id)
            report_url = None
        
        return Response({
            "message": "Mission Accomplished. Campaign marked as completed.",
            "report_url": report_url
        }, status=status.HTTP_200_OK)


# ==========================================
# V3.0 TALENT MARKETPLACE VIEWS
# ==========================================

class AdminMatchmakingAssignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        if request.user.role != User.Role.ADMIN:
            raise exceptions.PermissionDenied("Admin access required.")

        campaign = get_object_or_404(Campaign, pk=campaign_id)
        student_ids = request.data.get('student_ids', [])
        match_notes = request.data.get('match_notes', '')

        if campaign.status not in (Campaign.Status.OPEN, Campaign.Status.MATCHED):
            return Response({"error": "Only open or matched projects can be (re)assigned."}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(student_ids, list) or not student_ids:
            return Response({"error": "At least one student ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        from users.models import StudentProfile
        students = StudentProfile.objects.filter(id__in=student_ids)
        if not students.exists():
            return Response({"error": "No students found with the provided IDs."}, status=status.HTTP_400_BAD_REQUEST)

        campaign.assigned_students.set(students)
        campaign.status = Campaign.Status.MATCHED
        campaign.match_notes = match_notes
        campaign.save()

        from users.models import SystemLog
        from users.utils import log_event
        student_names = ", ".join([s.full_name for s in students])
        log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.INFO, f"Admin matched '{student_names}' to job #{campaign.id}: '{campaign.title}'")
        notifications.match_proposed(campaign)

        return Response({
            "message": "Talent successfully assigned and job status updated to MATCHED.",
            "campaign": CampaignSerializer(campaign).data
        }, status=status.HTTP_200_OK)


class FinalizeMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)

        # The owning company finalizes; admins may also lock a match from the Matchmaking Hub
        is_admin = request.user.role == User.Role.ADMIN
        is_owner = request.user.role == User.Role.COMPANY and campaign.company == getattr(request.user, 'company_profile', None)
        if not (is_owner or is_admin):
            return Response({"error": "You do not own this campaign."}, status=status.HTTP_403_FORBIDDEN)

        if campaign.status != Campaign.Status.MATCHED:
            return Response({"error": "Campaign must be in MATCHED status to finalize."}, status=status.HTTP_400_BAD_REQUEST)

        company_profile = campaign.company

        # Monetization Gate: Free tier requires Finder's Fee payment
        if company_profile.tier == CompanyProfile.Tier.FREE:
            has_paid = Transaction.objects.filter(
                company=company_profile,
                related_campaign=campaign,
                status=Transaction.Status.SUCCESS,
                transaction_type=Transaction.Type.FINDERS_FEE
            ).exists()

            if not has_paid:
                mock_pay = request.data.get('mock_pay', True)
                if mock_pay:
                    Transaction.objects.create(
                        company=company_profile,
                        related_campaign=campaign,
                        amount=150.00,
                        transaction_type=Transaction.Type.FINDERS_FEE,
                        status=Transaction.Status.SUCCESS
                    )
                else:
                    return Response({
                        "status": "payment_required",
                        "finder_fee": 150.00,
                        "message": "Finder's Fee payment required to finalize match."
                    }, status=status.HTTP_402_PAYMENT_REQUIRED)

        campaign.is_match_finalized = True
        campaign.status = Campaign.Status.IN_PROGRESS
        campaign.save()

        from users.models import SystemLog
        from users.utils import log_event
        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS, f"Match Finalized for '{campaign.title}' by {company_profile.company_name}")
        notifications.match_confirmed(campaign)

        return Response({
            "message": "Match finalized successfully. Project is now IN_PROGRESS.",
            "campaign": CampaignSerializer(campaign).data
        }, status=status.HTTP_200_OK)


class StudentAssignedJobsView(generics.ListAPIView):
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role != User.Role.STUDENT or not hasattr(self.request.user, 'student_profile'):
            return Campaign.objects.none()
        return Campaign.objects.filter(assigned_students=self.request.user.student_profile).distinct()


class StudentSubmitDeliverableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        if self.request.user.role != User.Role.STUDENT or not hasattr(self.request.user, 'student_profile'):
            raise exceptions.PermissionDenied("Only assigned students can submit deliverables.")

        campaign = get_object_or_404(Campaign, pk=campaign_id)
        if not campaign.assigned_students.filter(id=request.user.student_profile.id).exists():
            raise exceptions.PermissionDenied("You are not assigned to this project.")

        from .models import StudentDeliverable
        from .serializers import StudentDeliverableSerializer

        if campaign.status == Campaign.Status.COMPLETED:
            return Response({"error": "This project is already completed."}, status=status.HTTP_400_BAD_REQUEST)

        title = request.data.get('title') or 'Project Deliverable'
        external_url = (request.data.get('external_url') or '').strip()
        contribution_role = request.data.get('contribution_role', '')
        contribution_summary = request.data.get('contribution_summary', '')
        file_obj = request.FILES.get('file', None)

        if not external_url and not file_obj:
            return Response({"error": "Please attach a file or provide a link to your work."}, status=status.HTTP_400_BAD_REQUEST)

        if file_obj:
            try:
                validate_project_file_upload(file_obj, 'Deliverable')
            except exceptions.ValidationError as exc:
                return Response({"error": exc.detail[0]}, status=status.HTTP_400_BAD_REQUEST)

        if external_url:
            from django.core.validators import URLValidator
            from django.core.exceptions import ValidationError
            try:
                URLValidator()(external_url)
            except ValidationError:
                return Response({"error": "Please enter a valid link starting with http:// or https://."}, status=status.HTTP_400_BAD_REQUEST)

        deliverable = StudentDeliverable.objects.create(
            campaign=campaign,
            student=request.user.student_profile,
            title=title,
            external_url=external_url,
            file=file_obj,
            contribution_role=contribution_role,
            contribution_summary=contribution_summary
        )
        notifications.work_submitted(campaign, request.user.student_profile.full_name, title)

        return Response({
            "message": "Deliverable submitted successfully.",
            "deliverable": StudentDeliverableSerializer(deliverable).data
        }, status=status.HTTP_201_CREATED)


class ClientAssetView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        from .models import ClientAsset
        from .serializers import ClientAssetSerializer

        is_company = (request.user.role == User.Role.COMPANY and campaign.company == getattr(request.user, 'company_profile', None))
        is_assigned = (request.user.role == User.Role.STUDENT and hasattr(request.user, 'student_profile') and campaign.assigned_students.filter(id=request.user.student_profile.id).exists())
        is_admin = (request.user.role == User.Role.ADMIN)

        if not (is_company or is_assigned or is_admin):
            raise exceptions.PermissionDenied("Access to raw client assets is restricted.")

        assets = campaign.client_assets.all()
        return Response(ClientAssetSerializer(assets, many=True, context={'request': request}).data)

    def post(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        if request.user.role != User.Role.COMPANY or campaign.company != request.user.company_profile:
            raise exceptions.PermissionDenied("Only the project owner can upload client assets.")

        from .models import ClientAsset
        from .serializers import ClientAssetSerializer

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "File is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_project_file_upload(file_obj, 'Project file')
        except exceptions.ValidationError as exc:
            return Response({"error": exc.detail[0]}, status=status.HTTP_400_BAD_REQUEST)

        title = request.data.get('title') or file_obj.name
        asset_type = request.data.get('asset_type') or ClientAsset.AssetType.DOCUMENT
        if asset_type not in ClientAsset.AssetType.values:
            return Response({"error": "Invalid asset type."}, status=status.HTTP_400_BAD_REQUEST)

        asset = ClientAsset.objects.create(
            campaign=campaign,
            title=title,
            asset_type=asset_type,
            file=file_obj
        )

        return Response(ClientAssetSerializer(asset).data, status=status.HTTP_201_CREATED)


class ProjectTeamInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        if request.user.role != User.Role.STUDENT or not hasattr(request.user, 'student_profile'):
            raise exceptions.PermissionDenied("Only registered students can invite collaborators.")

        campaign = get_object_or_404(Campaign, pk=campaign_id)
        current_student = request.user.student_profile

        if not campaign.assigned_students.filter(id=current_student.id).exists():
            raise exceptions.PermissionDenied("You are not an assigned team member on this project.")

        if campaign.status == Campaign.Status.COMPLETED:
            return Response({"error": "You cannot invite teammates to a completed project."}, status=status.HTTP_400_BAD_REQUEST)

        email = (request.data.get('email') or request.data.get('invitee_email') or '').strip().lower()
        if not email:
            return Response({"error": "Invitee email is required."}, status=status.HTTP_400_BAD_REQUEST)

        if email == request.user.email.lower():
            return Response({"error": "You cannot invite yourself."}, status=status.HTTP_400_BAD_REQUEST)

        from .models import ProjectTeamInvitation
        from .serializers import ProjectTeamInvitationSerializer

        # Check if already assigned
        if campaign.assigned_students.filter(user__email__iexact=email).exists():
            return Response({"error": "This student is already a member of the project team."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if pending invite already exists
        if ProjectTeamInvitation.objects.filter(campaign=campaign, invitee_email__iexact=email, status=ProjectTeamInvitation.Status.PENDING).exists():
            return Response({"error": "A pending invitation has already been sent to this email."}, status=status.HTTP_400_BAD_REQUEST)

        # Find student profile if already registered
        invitee_student = StudentProfile.objects.filter(user__email__iexact=email).first()

        role_in_project = request.data.get('role_in_project') or 'Collaborator'
        notes = request.data.get('notes', '')
        try:
            payout_share = int(float(request.data.get('payout_share_percentage', 0) or 0))
        except (TypeError, ValueError):
            payout_share = -1
        if not 0 <= payout_share <= 100:
            return Response({"error": "Payout share must be between 0 and 100%."}, status=status.HTTP_400_BAD_REQUEST)

        invitation = ProjectTeamInvitation.objects.create(
            campaign=campaign,
            invited_by=current_student,
            invitee_email=email,
            invitee_student=invitee_student,
            role_in_project=role_in_project,
            payout_share_percentage=payout_share,
            status=ProjectTeamInvitation.Status.PENDING,
            notes=notes
        )

        from users.models import SystemLog
        from users.utils import log_event
        log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.INFO, f"Student {current_student.full_name} invited {email} as {role_in_project} to project #{campaign.id} ('{campaign.title}')")
        notifications.team_invitation(invitation)

        return Response(ProjectTeamInvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)


class ProjectTeamListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        if not can_view_workspace(request.user, campaign):
            raise exceptions.PermissionDenied("You are not part of this project team.")

        from users.serializers import StudentProfileSerializer
        from .serializers import ProjectTeamInvitationSerializer

        team_members = StudentProfileSerializer(campaign.assigned_students.all(), many=True).data
        invitations = ProjectTeamInvitationSerializer(campaign.team_invitations.filter(status='PENDING'), many=True).data

        return Response({
            "campaign_id": campaign.id,
            "campaign_title": campaign.title,
            "team_members": team_members,
            "pending_invitations": invitations
        })


class MyTeamInvitationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT or not hasattr(request.user, 'student_profile'):
            return Response([])

        from .models import ProjectTeamInvitation
        from .serializers import ProjectTeamInvitationSerializer
        from django.db.models import Q

        invitations = ProjectTeamInvitation.objects.filter(
            Q(invitee_student=request.user.student_profile) | Q(invitee_email__iexact=request.user.email),
            status=ProjectTeamInvitation.Status.PENDING
        ).select_related('campaign', 'invited_by')

        return Response(ProjectTeamInvitationSerializer(invitations, many=True).data)


class RespondTeamInvitationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, invitation_id):
        if request.user.role != User.Role.STUDENT or not hasattr(request.user, 'student_profile'):
            raise exceptions.PermissionDenied("Only registered students can respond to team invitations.")

        from .models import ProjectTeamInvitation
        from .serializers import ProjectTeamInvitationSerializer
        from django.db.models import Q

        invitation = get_object_or_404(
            ProjectTeamInvitation,
            Q(invitee_student=request.user.student_profile) | Q(invitee_email__iexact=request.user.email),
            pk=invitation_id
        )

        if invitation.status != ProjectTeamInvitation.Status.PENDING:
            return Response({"error": f"Invitation is already {invitation.status}."}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get('action', '').lower()
        student_profile = request.user.student_profile

        if action == 'accept':
            invitation.invitee_student = student_profile
            invitation.status = ProjectTeamInvitation.Status.ACCEPTED
            invitation.save()

            # Add student to campaign assigned students
            invitation.campaign.assigned_students.add(student_profile)

            from users.models import SystemLog
            from users.utils import log_event
            log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.SUCCESS, f"Student {student_profile.full_name} accepted team invitation for '{invitation.campaign.title}' as {invitation.role_in_project}")
            notifications.team_invitation_answered(invitation, accepted=True)

            return Response({
                "message": f"You have successfully joined the team for '{invitation.campaign.title}' as {invitation.role_in_project}!",
                "invitation": ProjectTeamInvitationSerializer(invitation).data
            }, status=status.HTTP_200_OK)

        elif action == 'decline':
            invitation.status = ProjectTeamInvitation.Status.DECLINED
            invitation.save()
            notifications.team_invitation_answered(invitation, accepted=False)
            return Response({"message": "Invitation declined."}, status=status.HTTP_200_OK)

        return Response({"error": "Invalid action. Use 'accept' or 'decline'."}, status=status.HTTP_400_BAD_REQUEST)


