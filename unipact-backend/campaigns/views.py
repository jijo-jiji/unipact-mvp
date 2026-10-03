import logging
from decimal import Decimal, InvalidOperation

from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.db import models, transaction as db_transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Campaign, Application, MatchOffer, Milestone, ImpactLedger
from .serializers import CampaignSerializer, CampaignDetailSerializer, ApplicationSerializer, DeliverableSerializer, MilestoneSerializer, can_view_workspace
from users.models import User, CompanyProfile, StudentProfile
from users import agreements
from payments.models import Transaction, Subscription, Payout
from payments.serializers import PayoutSerializer
from .utils import (
    generate_campaign_report, campaign_escrow, campaign_student_shares, split_by_percent,
    paid_project_fees, recompute_milestone_amounts,
)
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
        
        if not self.request.user.email_verified:
            raise exceptions.PermissionDenied("Please confirm your email address before posting a project. Check your inbox for the link.")

        # Check if company is verified enough to post
        company_profile = self.request.user.company_profile
        if company_profile.verification_status == CompanyProfile.VerificationStatus.HIGH_RISK:
             raise exceptions.PermissionDenied("Your account is under review (High Risk). You cannot post campaigns yet.")

        # payment_structure/platform_fee_percent are an admin-only lever (see CampaignDetailView's PATCH
        # guard) - only companies ever reach this endpoint, so always force the safe defaults here
        # regardless of what a request tried to set, rather than trusting the posting company.
        instance = serializer.save(
            company=self.request.user.company_profile,
            status=Campaign.Status.OPEN,
            payment_structure=Campaign.PaymentStructure.UPFRONT,
            platform_fee_percent=None,
        )

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
        # The escrow fee/payment structure is an admin-only lever, even for the owning company
        if request.method in ('PUT', 'PATCH') and request.user.role != User.Role.ADMIN:
            for field in ('payment_structure', 'platform_fee_percent'):
                if field in request.data:
                    raise exceptions.PermissionDenied("Only UniPact admins can change a project's fee or payment structure.")

    def perform_update(self, serializer):
        campaign = serializer.instance
        money_changed = any(
            field in serializer.validated_data and serializer.validated_data[field] != getattr(campaign, field)
            for field in ('budget', 'platform_fee_percent')
        )
        # Once the client has paid and work has started, the budget and fee are what that payment
        # and the milestone amounts were based on - changing them now would make escrow disagree
        # with the plan.
        if money_changed and campaign.is_match_finalized:
            raise exceptions.ValidationError({"error": "The budget and fee are locked once the match is finalized."})
        with db_transaction.atomic():
            campaign = serializer.save()
            if money_changed:
                recompute_milestone_amounts(campaign)

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

        # Managed-escrow projects can't be closed out until every milestone has been approved
        # and paid out - that's what actually releases the student's money now (see ReviewMilestoneView).
        if campaign.milestones.exists() and campaign.milestones.exclude(status=Milestone.Status.APPROVED).exists():
            return Response({
                "error": "All milestones must be reviewed and approved before this project can be marked complete.",
                "code": "milestones_incomplete"
            }, status=status.HTTP_400_BAD_REQUEST)

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

        except Exception:
            logger.exception('Error processing review/completion for campaign %s', campaign.id)

        campaign.status = Campaign.Status.COMPLETED
        campaign.completed_at = timezone.now()
        campaign.save()

        # V3.0 student projects: keep the client's rating and words (they seed the Verified Impact
        # Ledger's testimonial) and give every student a ledger to fill in. Ratings are averaged
        # across projects rather than overwritten by the latest one.
        if campaign.assigned_students.exists():
            from .ledger import ensure_ledgers, recompute_student_rating
            report = ensure_ledgers(campaign)
            if rating:
                report.client_rating = rating
            if is_owner and feedback and not report.testimonial:
                report.testimonial = str(feedback).strip()[:2000]
            report.save()
            for student in campaign.assigned_students.all():
                recompute_student_rating(student)

        notifications.project_completed(campaign, rating)

        # Student payouts are no longer generated here in bulk: each milestone's approval
        # (ReviewMilestoneView) already created and funded its own Payout records as work
        # progressed, checked against what the client had actually paid into escrow.

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
        students = list(StudentProfile.objects.filter(id__in=student_ids).select_related('user'))
        if not students:
            return Response({"error": "No students found with the provided IDs."}, status=status.HTTP_400_BAD_REQUEST)

        chosen_ids = {s.id for s in students}
        newly_offered, withdrawn = [], []
        with db_transaction.atomic():
            offers = {o.student_id: o for o in campaign.match_offers.select_related('student__user')}
            current_team = set(campaign.assigned_students.values_list('id', flat=True))
            for student in students:
                offer = offers.get(student.id)
                if offer is None:
                    # Already working on it without an offer (joined as a teammate): nothing to ask
                    if student.id in current_team:
                        continue
                    MatchOffer.objects.create(campaign=campaign, student=student)
                    newly_offered.append(student)
                elif offer.status in (MatchOffer.Status.DECLINED, MatchOffer.Status.WITHDRAWN):
                    offer.status, offer.decline_reason, offer.responded_at = MatchOffer.Status.PENDING, '', None
                    offer.save(update_fields=['status', 'decline_reason', 'responded_at'])
                    newly_offered.append(student)
            for student_id, offer in offers.items():
                if student_id not in chosen_ids and offer.status in (MatchOffer.Status.PENDING, MatchOffer.Status.ACCEPTED):
                    offer.status, offer.responded_at = MatchOffer.Status.WITHDRAWN, timezone.now()
                    offer.save(update_fields=['status', 'responded_at'])
                    withdrawn.append(offer.student)

            campaign.assigned_students.set(students)
            campaign.status = Campaign.Status.MATCHED
            campaign.match_notes = match_notes
            campaign.save()

        from users.models import SystemLog
        from users.utils import log_event
        student_names = ", ".join([s.full_name for s in students])
        log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.INFO, f"Admin offered job #{campaign.id} '{campaign.title}' to {student_names}")
        notifications.match_offered(campaign, newly_offered)
        notifications.match_withdrawn(campaign, withdrawn)
        if not campaign.has_pending_offers():
            notifications.match_ready(campaign)

        waiting = campaign.has_pending_offers()
        return Response({
            "message": "Offer sent. The client can confirm once every student accepts." if waiting else "Team updated and ready for the client to confirm.",
            "campaign": CampaignSerializer(campaign).data
        }, status=status.HTTP_200_OK)


class RespondMatchOfferView(APIView):
    """A matched student accepts or declines the admin's offer (wireframe §9)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        if request.user.role != User.Role.STUDENT or not hasattr(request.user, 'student_profile'):
            raise exceptions.PermissionDenied("Only students can respond to project offers.")
        profile = request.user.student_profile
        action = str(request.data.get('action', '')).lower()
        if action not in ('accept', 'decline'):
            return Response({"error": "Choose 'accept' or 'decline'."}, status=status.HTTP_400_BAD_REQUEST)
        if action == 'accept' and not request.user.email_verified:
            raise exceptions.PermissionDenied("Please confirm your email address before accepting a project. Check your inbox for the link.")
        if action == 'accept':
            agreements.require(request.user, agreements.TALENT)

        from users.models import SystemLog
        from users.utils import log_event

        with db_transaction.atomic():
            offer = MatchOffer.objects.select_for_update().select_related('campaign__company__user').filter(campaign_id=campaign_id, student=profile).first()
            if not offer:
                raise exceptions.NotFound("You don't have an offer for this project.")
            campaign = offer.campaign
            if offer.status != MatchOffer.Status.PENDING or campaign.status != Campaign.Status.MATCHED:
                return Response({"error": "This offer is no longer open."}, status=status.HTTP_400_BAD_REQUEST)

            offer.responded_at = timezone.now()
            if action == 'accept':
                offer.status = MatchOffer.Status.ACCEPTED
                offer.save(update_fields=['status', 'responded_at'])
            else:
                offer.status = MatchOffer.Status.DECLINED
                offer.decline_reason = str(request.data.get('reason') or '').strip()[:500]
                offer.save(update_fields=['status', 'decline_reason', 'responded_at'])
                campaign.assigned_students.remove(profile)
                if not campaign.assigned_students.exists():
                    # Nobody left: back to the admin's "needs match" queue
                    campaign.status = Campaign.Status.OPEN
                    campaign.save(update_fields=['status', 'updated_at'])

        if action == 'accept':
            log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.SUCCESS, f"{profile.full_name} accepted the offer for '{campaign.title}'")
            if not campaign.has_pending_offers():
                notifications.match_ready(campaign)
            message = "You accepted the project. We'll let you know when the client confirms."
        else:
            log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.WARNING, f"{profile.full_name} declined the offer for '{campaign.title}'")
            notifications.match_declined(offer)
            message = "You declined the project. Thanks for letting us know."

        return Response({"message": message, "status": offer.status, "campaign_status": campaign.status}, status=status.HTTP_200_OK)


class FinalizeMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)

        # The owning company finalizes; admins may also lock a match from the Matchmaking Hub
        is_admin = request.user.role == User.Role.ADMIN
        is_owner = request.user.role == User.Role.COMPANY and campaign.company == getattr(request.user, 'company_profile', None)
        if not (is_owner or is_admin):
            return Response({"error": "You do not own this campaign."}, status=status.HTTP_403_FORBIDDEN)
        if is_owner:
            agreements.require(request.user, agreements.CLIENT)

        if campaign.status != Campaign.Status.MATCHED:
            return Response({"error": "Campaign must be in MATCHED status to finalize."}, status=status.HTTP_400_BAD_REQUEST)
        if campaign.has_pending_offers():
            return Response({"error": "Waiting for the matched students to accept the project. You can confirm once they do."}, status=status.HTTP_400_BAD_REQUEST)
        if not campaign.assigned_students.exists():
            return Response({"error": "There are no students on this match yet."}, status=status.HTTP_400_BAD_REQUEST)

        company_profile = campaign.company

        # Managed-escrow gate: a milestone plan must exist so there's a defined way to pay the team out
        if not campaign.milestones.exists():
            return Response({
                "error": "UniPact hasn't set up a milestone plan for this project yet. Contact your account manager.",
                "code": "milestone_plan_missing"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Monetization Gate: the client must fund the full project fee before work starts,
        # unless UniPact is billing this client manually (e.g. a monthly bundle arrangement).
        if campaign.payment_structure == Campaign.PaymentStructure.UPFRONT:
            # Compare what was actually paid against the budget - a payment merely existing isn't
            # enough, since the create-intent endpoint accepts any client-supplied amount.
            outstanding = campaign.budget - paid_project_fees(campaign)

            if outstanding > 0:
                # Must be explicitly requested - never assumed. An admin's "Lock & start" click
                # sends no body at all, and defaulting this to True used to silently fabricate a
                # full-budget "paid" transaction with no real money ever collected.
                # Only honoured where the demo checkout is enabled (never in production), or a client
                # could mark its own project fee as paid with one request.
                mock_pay = settings.MOCK_PAYMENTS_ENABLED and bool(request.data.get('mock_pay', False))
                if mock_pay:
                    Transaction.objects.create(
                        company=company_profile,
                        related_campaign=campaign,
                        amount=outstanding,
                        transaction_type=Transaction.Type.PROJECT_FEE,
                        status=Transaction.Status.SUCCESS
                    )
                else:
                    from payments import toyyibpay
                    # ToyyibPay (FPX) when configured; the client can still ask for an invoice instead
                    payment_method = 'toyyibpay' if toyyibpay.is_available_to(request.user) else 'card' if settings.MOCK_PAYMENTS_ENABLED else 'bank_transfer'
                    invoice = None
                    if payment_method == 'bank_transfer' and is_owner:
                        from users.models import SystemLog
                        from users.utils import log_event
                        from payments.invoices import request_bank_transfer
                        invoice = request_bank_transfer(campaign, outstanding)
                        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.INFO, f"Invoice requested: RM {outstanding} for '{campaign.title}' ({company_profile.company_name})")
                    from payments.serializers import InvoiceSerializer
                    return Response({
                        "error": f"RM {outstanding} of the project fee is still outstanding. The full fee is required to finalize the match.",
                        "status": "payment_required",
                        "project_fee": outstanding,
                        "invoice": InvoiceSerializer(invoice).data if invoice else None,
                        "payment_method": payment_method,
                        "test_mode": payment_method == 'toyyibpay' and toyyibpay.is_sandbox(),
                        "message": "Full project fee payment required to finalize match."
                    }, status=status.HTTP_402_PAYMENT_REQUIRED)

        campaign.is_match_finalized = True
        campaign.status = Campaign.Status.IN_PROGRESS
        campaign.started_at = campaign.started_at or timezone.now()
        campaign.save()
        # However the fee arrived (FPX, card, bank transfer), its invoice is now settled
        from payments.invoices import settle_invoices
        settle_invoices(campaign)

        from users.models import SystemLog
        from users.utils import log_event
        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS, f"Match Finalized for '{campaign.title}' by {company_profile.company_name}")
        notifications.match_confirmed(campaign)

        return Response({
            "message": "Match finalized successfully. Project is now IN_PROGRESS.",
            "campaign": CampaignSerializer(campaign).data
        }, status=status.HTTP_200_OK)


class MilestonePlanView(APIView):
    """Admin defines (or replaces) a project's milestone plan before the match is finalized.

    Each milestone's rupiah amount is computed server-side against the campaign's student pool
    (budget minus UniPact's cut), so admin only ever has to reason about percentages.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        if request.user.role != User.Role.ADMIN:
            raise exceptions.PermissionDenied("Admin access required.")

        campaign = get_object_or_404(Campaign, pk=campaign_id)
        if campaign.is_match_finalized:
            return Response({"error": "The milestone plan can't change after the match has been finalized."}, status=status.HTTP_400_BAD_REQUEST)

        milestones_data = request.data.get('milestones', [])
        if not isinstance(milestones_data, list) or not milestones_data:
            return Response({"error": "At least one milestone is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            percentages = [Decimal(str(m.get('percentage', 0))) for m in milestones_data]
        except (InvalidOperation, TypeError):
            return Response({"error": "Every milestone needs a numeric percentage."}, status=status.HTTP_400_BAD_REQUEST)

        if any(not p.is_finite() or p <= 0 for p in percentages):
            return Response({"error": "Milestone percentages must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)
        if any(p != p.quantize(Decimal('0.01')) for p in percentages):
            return Response({"error": "Milestone percentages can have at most 2 decimal places."}, status=status.HTTP_400_BAD_REQUEST)
        if sum(percentages) != 100:
            return Response({"error": f"Milestone percentages must sum to 100 (got {sum(percentages)})."}, status=status.HTTP_400_BAD_REQUEST)

        pool = campaign.student_pool()
        amounts = split_by_percent(pool, percentages)
        with db_transaction.atomic():
            campaign.milestones.all().delete()
            for i, (m, pct, amount) in enumerate(zip(milestones_data, percentages, amounts), start=1):
                title = str(m.get('title') or f'Milestone {i}').strip()
                Milestone.objects.create(
                    campaign=campaign,
                    step_number=i,
                    title=title,
                    description=str(m.get('description') or '').strip(),
                    percentage=pct,
                    amount=amount,
                    max_revisions=int(m.get('max_revisions') or 2),
                )

        from users.models import SystemLog
        from users.utils import log_event
        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.INFO, f"Milestone plan set for '{campaign.title}': {len(milestones_data)} milestones, student pool RM {pool}")

        return Response(MilestoneSerializer(campaign.milestones.all(), many=True).data, status=status.HTTP_201_CREATED)


class StudentSubmitMilestoneView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, milestone_id):
        if request.user.role != User.Role.STUDENT or not hasattr(request.user, 'student_profile'):
            raise exceptions.PermissionDenied("Only assigned students can submit milestone work.")

        campaign = get_object_or_404(Campaign, pk=campaign_id)
        if not campaign.assigned_students.filter(id=request.user.student_profile.id).exists():
            raise exceptions.PermissionDenied("You are not on this project's team.")

        milestone = get_object_or_404(Milestone, pk=milestone_id, campaign=campaign)
        if milestone.status not in (Milestone.Status.PENDING, Milestone.Status.IN_PROGRESS, Milestone.Status.REVISION_REQUESTED):
            return Response({"error": f"This milestone is {milestone.get_status_display()} and can't be submitted right now."}, status=status.HTTP_400_BAD_REQUEST)

        url = str(request.data.get('deliverable_url') or '').strip()
        notes = str(request.data.get('deliverable_notes') or '').strip()
        file_obj = request.FILES.get('deliverable_file')

        if not url and not file_obj and not milestone.deliverable_file:
            return Response({"error": "Attach a file or a link to the work before submitting."}, status=status.HTTP_400_BAD_REQUEST)

        if file_obj:
            validate_project_file_upload(file_obj, 'Milestone deliverable')
            milestone.deliverable_file = file_obj
        if url:
            milestone.deliverable_url = url
        milestone.deliverable_notes = notes
        milestone.status = Milestone.Status.SUBMITTED
        milestone.save()

        notifications.work_submitted(campaign, request.user.student_profile.full_name, milestone.title)
        return Response(MilestoneSerializer(milestone).data)


class ReviewMilestoneView(APIView):
    """The client (or an admin) approves a milestone - releasing that slice of escrow to the
    assigned students - or sends it back for revision."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, milestone_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        is_owner = request.user.role == User.Role.COMPANY and campaign.company == getattr(request.user, 'company_profile', None)
        is_admin = request.user.role == User.Role.ADMIN
        if not (is_owner or is_admin):
            return Response({"error": "Only the client or an admin can review milestone submissions."}, status=status.HTTP_403_FORBIDDEN)

        get_object_or_404(Milestone, pk=milestone_id, campaign=campaign)
        action = str(request.data.get('action') or '').lower()
        if action not in ('approve', 'request_revision'):
            return Response({"error": "Choose 'approve' or 'request_revision'."}, status=status.HTTP_400_BAD_REQUEST)

        from users.models import SystemLog
        from users.utils import log_event

        with db_transaction.atomic():
            # Lock the campaign (serialises every approval that draws on this project's escrow) and
            # the milestone, then re-check under the lock - so a double-click or two reviewers acting
            # at once can't both pass the status and escrow checks and each release the same money.
            Campaign.objects.select_for_update().get(pk=campaign.pk)
            milestone = Milestone.objects.select_for_update().get(pk=milestone_id)
            if milestone.status != Milestone.Status.SUBMITTED:
                return Response({"error": f"This milestone is {milestone.get_status_display()}, not awaiting review."}, status=status.HTTP_400_BAD_REQUEST)

            if action == 'request_revision':
                if milestone.revisions_used >= milestone.max_revisions and not is_admin:
                    return Response({"error": "The revision limit has been reached for this milestone. Contact UniPact support."}, status=status.HTTP_400_BAD_REQUEST)
                milestone.revisions_used += 1
                milestone.status = Milestone.Status.REVISION_REQUESTED
                feedback = str(request.data.get('feedback') or '').strip()
                if feedback:
                    milestone.deliverable_notes = feedback
                milestone.save()
                log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.INFO, f"Revision requested on milestone '{milestone.title}' for '{campaign.title}'")
                return Response(MilestoneSerializer(milestone).data)

            escrow = campaign_escrow(campaign)
            if escrow['available'] < milestone.amount:
                return Response({
                    "error": (
                        f"Only RM {escrow['available']} of the client's escrow is available, but this "
                        f"milestone needs RM {milestone.amount}. Confirm the client's payment has cleared "
                        f"before approving."
                    ),
                    "code": "escrow_insufficient",
                    "available": escrow['available'],
                    "required": milestone.amount,
                }, status=status.HTTP_402_PAYMENT_REQUIRED)

            shares = campaign_student_shares(campaign)
            recipients = [s for s in campaign.assigned_students.order_by('id') if shares.get(s.id, Decimal('0')) > 0]
            amounts = split_by_percent(milestone.amount, [shares[s.id] for s in recipients]) if recipients else []
            payouts = []
            for student, amount in zip(recipients, amounts):
                has_bank = student.has_bank_details
                payout, _created = Payout.objects.get_or_create(
                    campaign=campaign, student=student, milestone=milestone,
                    defaults={
                        'amount': amount,
                        'status': Payout.Status.PROCESSING if has_bank else Payout.Status.PENDING,
                        'bank_name': student.bank_name or '',
                        'bank_account_number': student.bank_account_number or '',
                        'bank_account_holder_name': student.bank_account_holder_name or student.full_name,
                        'duitnow_id': student.duitnow_id or '',
                        'notes': 'Ready for disbursement.' if has_bank else 'Awaiting student bank details.',
                    }
                )
                payouts.append(payout)

            milestone.status = Milestone.Status.APPROVED
            milestone.save()

        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS, f"Milestone '{milestone.title}' approved for '{campaign.title}' - RM {milestone.amount} released to escrow-pending payouts")

        return Response({
            "milestone": MilestoneSerializer(milestone).data,
            "payouts": PayoutSerializer(payouts, many=True).data,
        })


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
        if not campaign.is_active_member(request.user.student_profile):
            raise exceptions.PermissionDenied("Accept the project offer before submitting work.")

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
        is_assigned = (request.user.role == User.Role.STUDENT and hasattr(request.user, 'student_profile') and campaign.is_active_member(request.user.student_profile))
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
        if not campaign.is_active_member(current_student):
            raise exceptions.PermissionDenied("Accept the project offer before inviting teammates.")

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

        already_committed = ProjectTeamInvitation.objects.filter(
            campaign=campaign, status=ProjectTeamInvitation.Status.ACCEPTED
        ).aggregate(total=models.Sum('payout_share_percentage'))['total'] or 0
        if already_committed + payout_share > 100:
            return Response({
                "error": f"That share would push the team's committed payout split past 100% "
                         f"({already_committed}% already accepted). Choose {100 - already_committed}% or less."
            }, status=status.HTTP_400_BAD_REQUEST)

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

        from users.serializers import StudentTeamMemberSerializer
        from .serializers import ProjectTeamInvitationSerializer

        team_members = StudentTeamMemberSerializer(campaign.assigned_students.all(), many=True).data
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
            agreements.require(request.user, agreements.TALENT)
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


# ------------------------------------------------------------------
# Verified Impact Ledger
# ------------------------------------------------------------------

class ImpactReportView(APIView):
    """The client's impact statement for a completed project (GET/PUT). Admins can read it."""
    permission_classes = [permissions.IsAuthenticated]

    def _campaign(self, request, campaign_id, write):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        is_owner = request.user.role == User.Role.COMPANY and campaign.company == getattr(request.user, 'company_profile', None)
        if not (is_owner or (request.user.role == User.Role.ADMIN and not write)):
            raise exceptions.PermissionDenied("Only the client who ran this project can write its impact statement.")
        if campaign.status != Campaign.Status.COMPLETED or not campaign.assigned_students.exists():
            raise exceptions.ValidationError({"error": "The impact statement opens once the student project is completed."})
        return campaign

    def get(self, request, campaign_id):
        from .ledger import ensure_ledgers, is_report_locked
        from .serializers import ProjectImpactReportSerializer
        campaign = self._campaign(request, campaign_id, write=False)
        report = ensure_ledgers(campaign)
        data = ProjectImpactReportSerializer(report).data
        data['locked'] = is_report_locked(campaign)
        data['suggested_skills'] = campaign.required_skills or []
        return Response(data)

    def put(self, request, campaign_id):
        from .ledger import ensure_ledgers, is_report_locked
        from .serializers import ProjectImpactReportSerializer
        campaign = self._campaign(request, campaign_id, write=True)
        report = ensure_ledgers(campaign)
        if is_report_locked(campaign):
            return Response({"error": "A ledger for this project is already published, so the statement is locked. Contact UniPact to change it."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ProjectImpactReportSerializer(report, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        sign = serializer.validated_data.pop('sign', False)
        serializer.validated_data.pop('signature', None)
        was_signed = bool(report.signed_at)
        report = serializer.save()
        # Any save without signing leaves an unsigned draft: a signature must cover the exact words published
        report.signed_at = timezone.now() if sign else None
        report.signed_by = request.user if sign else None
        report.save(update_fields=['signed_at', 'signed_by', 'updated_at'])

        if sign and not was_signed:
            from users.models import SystemLog
            from users.utils import log_event
            log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.SUCCESS, f"{campaign.company.company_name} signed the impact statement for '{campaign.title}'")
            notifications.impact_statement_signed(campaign)

        data = ProjectImpactReportSerializer(report).data
        data['locked'] = False
        data['suggested_skills'] = campaign.required_skills or []
        return Response(data)


class MyImpactLedgerView(APIView):
    """A student's own part of their ledger for a completed project (GET/PUT, multipart for screenshots)."""
    permission_classes = [permissions.IsAuthenticated]

    def _ledger(self, request, campaign_id):
        from .ledger import ensure_ledgers
        if request.user.role != User.Role.STUDENT or not hasattr(request.user, 'student_profile'):
            raise exceptions.PermissionDenied("Only students on this project have a ledger here.")
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        if not campaign.assigned_students.filter(id=request.user.student_profile.id).exists():
            raise exceptions.PermissionDenied("You weren't on this project's team.")
        if campaign.status != Campaign.Status.COMPLETED:
            raise exceptions.ValidationError({"error": "Your impact ledger opens once the project is completed."})
        ensure_ledgers(campaign)
        return ImpactLedger.objects.select_related('campaign__company', 'student').get(campaign=campaign, student=request.user.student_profile)

    def _response(self, request, ledger):
        from .ledger import ledger_payload, student_prefill
        from .serializers import ImpactLedgerStudentSerializer
        data = ImpactLedgerStudentSerializer(ledger, context={'request': request}).data
        data['prefill'] = student_prefill(ledger)
        data['ledger'] = ledger_payload(ledger, request)
        return Response(data)

    def get(self, request, campaign_id):
        return self._response(request, self._ledger(request, campaign_id))

    def put(self, request, campaign_id):
        from .serializers import ImpactLedgerStudentSerializer
        ledger = self._ledger(request, campaign_id)
        if ledger.status == ImpactLedger.Status.PUBLISHED:
            return Response({"error": "This ledger is already published. Contact UniPact if something needs correcting."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ImpactLedgerStudentSerializer(ledger, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        submit = serializer.validated_data.pop('submit', False)
        remove_before = serializer.validated_data.pop('remove_before_image', False)
        remove_after = serializer.validated_data.pop('remove_after_image', False)
        ledger = serializer.save()
        for flag, field in ((remove_before, 'before_image'), (remove_after, 'after_image')):
            if flag and getattr(ledger, field) and field not in serializer.validated_data:
                getattr(ledger, field).delete(save=False)
                setattr(ledger, field, None)
        ledger.student_submitted_at = timezone.now() if submit else None
        ledger.save()
        return self._response(request, ledger)


class ImpactLedgerDetailView(APIView):
    """A ledger by its slug. Published ledgers are public (the shareable proof of work); drafts are
    visible only to the student, the client and UniPact admins, as a preview."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        from .ledger import ledger_payload
        ledger = ImpactLedger.objects.select_related('campaign__company__user', 'student__user').filter(slug=slug).first()
        if not ledger:
            raise exceptions.NotFound("Ledger not found.")
        if ledger.status != ImpactLedger.Status.PUBLISHED:
            user = request.user if request.user.is_authenticated else None
            can_preview = user and (
                user.role == User.Role.ADMIN
                or user.id == ledger.student.user_id
                or user.id == ledger.campaign.company.user_id
            )
            if not can_preview:
                # Same answer as a missing ledger, so unpublished ones can't be confirmed to exist
                raise exceptions.NotFound("Ledger not found.")
        return Response(ledger_payload(ledger, request))


class AdminImpactLedgerListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .ledger import readiness
        if request.user.role != User.Role.ADMIN:
            raise exceptions.PermissionDenied("Admin access required.")
        ledgers = ImpactLedger.objects.select_related('campaign__company', 'campaign__impact_report', 'student').order_by('-updated_at')
        status_filter = request.query_params.get('status')
        if status_filter in ImpactLedger.Status.values:
            ledgers = ledgers.filter(status=status_filter)
        return Response([
            {
                'slug': l.slug,
                'status': l.status,
                'student_name': l.student.full_name,
                'project_title': l.campaign.title,
                'client_name': l.campaign.company.company_name,
                'published_at': l.published_at,
                'updated_at': l.updated_at,
                'readiness': readiness(l),
            }
            for l in ledgers
        ])


class AdminImpactLedgerPublishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug, action):
        from .ledger import readiness
        if request.user.role != User.Role.ADMIN:
            raise exceptions.PermissionDenied("Admin access required.")
        if action not in ('publish', 'unpublish'):
            raise exceptions.NotFound()
        ledger = get_object_or_404(ImpactLedger.objects.select_related('campaign', 'student__user'), slug=slug)
        from users.models import SystemLog
        from users.utils import log_event

        if action == 'unpublish':
            ledger.status = ImpactLedger.Status.DRAFT
            ledger.published_at = None
            ledger.published_by = None
            ledger.save(update_fields=['status', 'published_at', 'published_by', 'updated_at'])
            log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.WARNING, f"Ledger {ledger.slug} unpublished by {request.user.email}")
            return Response({"message": "Ledger unpublished.", "status": ledger.status})

        checks = readiness(ledger)
        if not checks['ready']:
            labels = {
                'project_completed': 'the project is completed',
                'client_signed': 'the client has signed the impact statement',
                'student_submitted': 'the student has submitted their part',
                'escrow_released': "the student's payout has been disbursed",
            }
            missing = [text for key, text in labels.items() if not checks[key]]
            return Response({"error": f"Not ready to publish yet. Waiting until {', and '.join(missing)}.", "readiness": checks}, status=status.HTTP_400_BAD_REQUEST)

        if ledger.status != ImpactLedger.Status.PUBLISHED:
            ledger.status = ImpactLedger.Status.PUBLISHED
            ledger.published_at = timezone.now()
            ledger.published_by = request.user
            ledger.save(update_fields=['status', 'published_at', 'published_by', 'updated_at'])
            log_event(SystemLog.Category.MARKETPLACE, SystemLog.Level.SUCCESS, f"Ledger {ledger.slug} published for {ledger.student.full_name}")
            notifications.impact_ledger_published(ledger)
        return Response({"message": "Ledger published.", "status": ledger.status, "slug": ledger.slug})


