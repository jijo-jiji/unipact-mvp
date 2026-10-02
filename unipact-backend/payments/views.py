from decimal import Decimal, InvalidOperation
from django.db import transaction as db_transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from users.models import User, SystemLog, CompanyProfile
from users.utils import log_event
from campaigns.models import Campaign
from .serializers import TransactionSerializer, TreasurySummarySerializer, SubscriptionSerializer, PayoutSerializer, InvoiceSerializer
from .models import Transaction, Subscription, Payout, Invoice
from .invoices import request_bank_transfer, settle_invoices, render_invoice_pdf
from .services import MockStripeService
from unipact_backend import notifications
from django.conf import settings
from django.http import HttpResponse
from django.urls import reverse
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from datetime import timedelta
import logging
import re
from . import toyyibpay

logger = logging.getLogger(__name__)


def online_payments_unavailable():
    return Response({
        "error": "Card payments aren't available yet. UniPact will email you an invoice to pay by bank transfer.",
        "code": "online_payments_unavailable",
    }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class CreatePaymentIntentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.MOCK_PAYMENTS_ENABLED:
            return online_payments_unavailable()
        if request.user.role != User.Role.COMPANY:
            return Response({"error": "Only companies can make payments"}, status=status.HTTP_403_FORBIDDEN)
        
        campaign_id = request.data.get('campaign_id')
        transaction_type = request.data.get('type', Transaction.Type.FINDERS_FEE)

        # Amount may arrive as a number or a string; "150" * 100 would repeat the string instead of multiplying
        try:
            amount = Decimal(str(request.data.get('amount')))
        except (InvalidOperation, TypeError):
            amount = None
        if amount is None or amount <= 0:
            return Response({"error": "A positive amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        if transaction_type not in Transaction.Type.values:
            return Response({"error": "Invalid payment type"}, status=status.HTTP_400_BAD_REQUEST)

        campaign = None
        if campaign_id:
            campaign = get_object_or_404(Campaign, pk=campaign_id, company=request.user.company_profile)

        # Create Intent via Service
        intent = MockStripeService.create_payment_intent(amount=int(amount * 100)) # Stripe uses cents
        
        # Create Pending Transaction
        transaction = Transaction.objects.create(
            company=request.user.company_profile,
            amount=amount,
            transaction_type=transaction_type,
            status=Transaction.Status.PENDING,
            related_campaign=campaign,
            stripe_payment_id=intent['id']
        )
        
        return Response({
            "clientSecret": intent['client_secret'],
            "transactionId": transaction.id,
            "amount": transaction.amount
        })

class MockCheckoutView(APIView):
    """
    Stands in for Stripe.js charging the card in the browser. Without this step the mock intent
    stays 'pending' and ConfirmPaymentView (correctly) rejects every payment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        if not settings.MOCK_PAYMENTS_ENABLED:
            return online_payments_unavailable()
        transaction = get_object_or_404(Transaction, pk=transaction_id)
        if transaction.company != getattr(request.user, 'company_profile', None):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        if transaction.status != Transaction.Status.PENDING or not transaction.stripe_payment_id:
            return Response({"error": "Invalid transaction state"}, status=status.HTTP_400_BAD_REQUEST)

        intent = MockStripeService.confirm_payment_intent(transaction.stripe_payment_id)
        if not intent:
            return Response({"error": "Payment session expired. Please try again."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"status": intent['status']})

class ConfirmPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        if not settings.MOCK_PAYMENTS_ENABLED:
            return online_payments_unavailable()
        transaction = get_object_or_404(Transaction, pk=transaction_id)

        # Verify ownership
        if transaction.company != getattr(request.user, 'company_profile', None):
             return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        
        # Security Check: Verify with Stripe
        intent_id = transaction.stripe_payment_id
        if not intent_id:
             return Response({"error": "Invalid transaction state"}, status=status.HTTP_400_BAD_REQUEST)
             
        intent = MockStripeService.retrieve_payment_intent(intent_id)
        if not intent:
             return Response({"error": "Payment intent not found"}, status=status.HTTP_404_NOT_FOUND)
             
        if intent['status'] != 'succeeded':
             return Response({
                 "error": f"Payment not successful. Current status: {intent['status']}",
                 "code": "payment_failed"
             }, status=status.HTTP_400_BAD_REQUEST)

        # Update Status
        transaction.status = Transaction.Status.SUCCESS
        transaction.save()
        
        # Save Mock Card Details (For MVP "Update Card" flow)
        # In real Stripe, this comes from the PaymentMethod object
        transaction.company.card_last_4 = "4242"
        transaction.company.card_brand = "VISA"
        transaction.company.save()
        
        # Handle Pro Tier Upgrade
        if transaction.transaction_type == Transaction.Type.SUBSCRIPTION and transaction.amount >= 499:
             transaction.company.tier = CompanyProfile.Tier.PRO
             transaction.company.save()
             log_event(SystemLog.Category.GROWTH, SystemLog.Level.SUCCESS, f"Company Upgraded to PRO: {transaction.company.company_name}")

        # Log Logic
        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS, f"Payment Received: RM {transaction.amount} from {transaction.company.company_name}")
        notifications.payment_receipt(transaction)

        return Response({"status": "SUCCESS", "message": "Payment confirmed"})

class TransactionHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.COMPANY:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        
        transactions = Transaction.objects.filter(company=request.user.company_profile).order_by('-created_at')
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)

class TreasurySummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.COMPANY:
             return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        company = request.user.company_profile
        
        # Get/Create Mock Subscription (for MVP)
        subscription, _ = Subscription.objects.get_or_create(
            company=company,
            defaults={
                'plan_name': company.tier,
                'status': Subscription.Status.ACTIVE,
                'start_date': "2024-01-01T00:00:00Z",
                'end_date': "2025-01-01T00:00:00Z"
            }
        )
        # Keep the mock plan in sync after an upgrade
        if subscription.plan_name != company.tier:
            subscription.plan_name = company.tier
            subscription.save(update_fields=['plan_name'])

        transactions = Transaction.objects.filter(company=company).order_by('-created_at')[:5]
        
        data = {
            "tier": company.tier,
            "subscription": subscription,
            "transactions": TransactionSerializer(transactions, many=True).data,
            "balance": 15000.00 # Mock Balance
        }
        
        serializer = TreasurySummarySerializer(data)
        return Response(serializer.data)

class CreateTransactionView(generics.CreateAPIView):
    """
    Simulates payment for Finder's Fee.
    """
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # In a real app, this would handle Stripe Intent Creation
        # Here we simulate a successful payment instantly
        company_profile = self.request.user.company_profile
        serializer.save(
            company=company_profile, 
            status=Transaction.Status.SUCCESS
        )


class StudentPayoutListView(APIView):
    """Returns payout records and earnings breakdown for the authenticated student."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT or not hasattr(request.user, 'student_profile'):
            return Response({"error": "Only student talent can view their payouts."}, status=status.HTTP_403_FORBIDDEN)

        student = request.user.student_profile
        payouts = Payout.objects.filter(student=student).select_related('campaign', 'milestone', 'student__user').order_by('-created_at')

        total_earned = payouts.filter(status=Payout.Status.PAID).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        pending_amount = payouts.filter(status__in=[Payout.Status.PENDING, Payout.Status.PROCESSING]).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return Response({
            "total_earned": total_earned,
            "pending_amount": pending_amount,
            "has_bank_details": student.has_bank_details,
            "bank_details": {
                "bank_name": student.bank_name or "",
                "bank_account_number": student.bank_account_number or "",
                "bank_account_holder_name": student.bank_account_holder_name or "",
                "duitnow_id": student.duitnow_id or "",
            },
            "payouts": PayoutSerializer(payouts, many=True).data,
        })


class AdminPayoutListView(APIView):
    """Allows administrators to view and manage student milestone payouts."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
            return Response({"error": "Only admins can view the payout registry."}, status=status.HTTP_403_FORBIDDEN)

        status_filter = request.query_params.get('status')
        queryset = Payout.objects.select_related('campaign', 'milestone', 'student', 'student__user').order_by('-created_at')
        if status_filter and status_filter in Payout.Status.values:
            queryset = queryset.filter(status=status_filter)

        total_disbursed = Payout.objects.filter(status=Payout.Status.PAID).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_pending = Payout.objects.filter(status__in=[Payout.Status.PENDING, Payout.Status.PROCESSING]).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return Response({
            "total_disbursed": total_disbursed,
            "total_pending": total_pending,
            "count_ready": Payout.objects.filter(status=Payout.Status.PROCESSING).count(),
            "payouts": PayoutSerializer(queryset, many=True).data,
        })


class AdminRecordPayoutView(APIView):
    """Allows administrators to record a bank transfer (e.g. DuitNow/IBG) and disburse payout to student."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != User.Role.ADMIN:
            return Response({"error": "Only admins can record payouts."}, status=status.HTTP_403_FORBIDDEN)

        get_object_or_404(Payout, pk=pk)

        transfer_reference = str(request.data.get('transfer_reference') or '').strip()
        if not transfer_reference:
            return Response({"error": "Bank transfer reference (e.g. DuitNow/IBG reference number) is required."}, status=status.HTTP_400_BAD_REQUEST)

        notes = str(request.data.get('notes') or '').strip()
        confirmed_bank_change = str(request.data.get('confirm_bank_change', '')).lower() in ('true', '1')

        with db_transaction.atomic():
            # Lock the row so a double-submit can't record (and notify) the same transfer twice
            payout = Payout.objects.select_for_update().select_related('student', 'student__user', 'campaign').get(pk=pk)
            if payout.status == Payout.Status.PAID:
                return Response({"error": f"This payout was already recorded as disbursed (Ref: {payout.transfer_reference})."}, status=status.HTTP_400_BAD_REQUEST)
            if payout.status != Payout.Status.PROCESSING:
                return Response({"error": "This payout has no bank details to transfer to yet."}, status=status.HTTP_400_BAD_REQUEST)
            if payout.bank_details_changed_at and not confirmed_bank_change:
                return Response({
                    "error": "The student changed their bank details after this payout was approved. Confirm the new account with them before recording the transfer.",
                    "code": "bank_change_unconfirmed",
                }, status=status.HTTP_400_BAD_REQUEST)

            payout.status = Payout.Status.PAID
            payout.transfer_reference = transfer_reference
            if notes:
                payout.notes = notes
            payout.paid_at = timezone.now()
            payout.save(update_fields=['status', 'transfer_reference', 'notes', 'paid_at', 'updated_at'])

        log_event(
            SystemLog.Category.FINANCIAL,
            SystemLog.Level.INFO,
            f"Payout of RM {payout.amount} disbursed to {payout.student.full_name} for project '{payout.campaign.title}' (Ref: {transfer_reference})"
        )

        try:
            notifications.payout_released(payout)
        except Exception:
            pass

        return Response({
            "message": f"Payout of RM {payout.amount} successfully recorded as disbursed.",
            "payout": PayoutSerializer(payout).data,
        })


class AdminRecordClientPaymentView(APIView):
    """Records a client's project-fee payment an admin received outside the card checkout - bank
    transfer, or instalments for a MANUAL-billing client - so it funds the project's escrow."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        if request.user.role != User.Role.ADMIN:
            return Response({"error": "Only admins can record client payments."}, status=status.HTTP_403_FORBIDDEN)

        from campaigns.utils import escrow_summary, paid_project_fees

        try:
            amount = Decimal(str(request.data.get('amount')))
        except (InvalidOperation, TypeError):
            amount = None
        if amount is None or not amount.is_finite() or amount <= 0 or amount != amount.quantize(Decimal('0.01')):
            return Response({"error": "Enter a positive amount in ringgit, e.g. 1500.00."}, status=status.HTTP_400_BAD_REQUEST)

        reference = str(request.data.get('reference') or '').strip()[:100]
        if not reference:
            return Response({"error": "The bank or DuitNow reference for this payment is required."}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            campaign = get_object_or_404(Campaign.objects.select_for_update().select_related('company'), pk=campaign_id)
            outstanding = campaign.budget - paid_project_fees(campaign)
            # Catches a typo (RM 15000 for RM 1500) before it inflates escrow and lets milestones release money never received
            if amount > outstanding:
                return Response({
                    "error": f"That's more than the RM {max(outstanding, Decimal('0'))} still outstanding on this project's RM {campaign.budget} fee. Check the amount, or raise the budget first.",
                }, status=status.HTTP_400_BAD_REQUEST)
            tx = Transaction.objects.create(
                company=campaign.company,
                related_campaign=campaign,
                amount=amount,
                transaction_type=Transaction.Type.PROJECT_FEE,
                status=Transaction.Status.SUCCESS,
                reference=reference,
                provider=Transaction.Provider.MANUAL,
                paid_at=timezone.now(),
            )
            settle_invoices(campaign)
            # The client already confirmed their team when they asked to pay by bank transfer (that is what
            # issued the invoice), so start the project now instead of making them come back and click again.
            # FPX payments already work this way.
            started = (
                outstanding - amount <= 0
                and campaign.status == Campaign.Status.MATCHED
                and campaign.invoices.exists()
                and campaign.assigned_students.exists()
                and not campaign.has_pending_offers()
            )
            if started:
                campaign.is_match_finalized = True
                campaign.status = Campaign.Status.IN_PROGRESS
                campaign.started_at = campaign.started_at or timezone.now()
                campaign.save(update_fields=['is_match_finalized', 'status', 'started_at'])

        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS,
                  f"Admin {request.user.email} recorded client payment RM {amount} for '{campaign.title}' (Ref: {reference})")
        if started:
            log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS,
                      f"Match Finalized for '{campaign.title}': invoice paid in full by bank transfer")
            notifications.match_confirmed(campaign)
        notifications.payment_receipt(tx, outstanding=outstanding - amount)

        return Response({
            "message": f"Recorded RM {amount} from {campaign.company.company_name}.",
            "transaction": TransactionSerializer(tx).data,
            "escrow": escrow_summary(campaign),
            "outstanding": outstanding - amount,
            "project_started": started,
        }, status=status.HTTP_201_CREATED)


# ------------------------------------------------------------------
# ToyyibPay (FPX online banking) for client project fees
# ------------------------------------------------------------------

def _owned_campaign(request, campaign_id):
    company = getattr(request.user, 'company_profile', None) if request.user.role == User.Role.COMPANY else None
    if company is None:
        return None, Response({"error": "Only the client who owns this project can pay for it."}, status=status.HTTP_403_FORBIDDEN)
    return get_object_or_404(Campaign, pk=campaign_id, company=company), None


class ToyyibPayCreateBillView(APIView):
    """POST {campaign_id, phone}: open (or reuse) an FPX bill for what the client still owes on a project.
    The amount always comes from the server, never from the browser."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from campaigns.utils import paid_project_fees

        if not toyyibpay.is_available_to(request.user):
            return Response({"error": "Online payment isn't available yet. Request an invoice to pay by bank transfer.",
                             "code": "online_payments_unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        campaign, error = _owned_campaign(request, request.data.get('campaign_id'))
        if error:
            return error
        # Only take money for a project that can actually start once it's paid
        if campaign.status != Campaign.Status.MATCHED or campaign.is_match_finalized:
            return Response({"error": "This project isn't waiting for payment."}, status=status.HTTP_400_BAD_REQUEST)
        if campaign.has_pending_offers() or not campaign.assigned_students.exists():
            return Response({"error": "Your student team hasn't accepted yet. You can pay once they do."}, status=status.HTTP_400_BAD_REQUEST)
        if not campaign.milestones.exists():
            return Response({"error": "UniPact hasn't set up a milestone plan for this project yet. Contact your account manager."},
                            status=status.HTTP_400_BAD_REQUEST)
        if campaign.payment_structure != Campaign.PaymentStructure.UPFRONT:
            return Response({"error": "UniPact invoices this project separately."}, status=status.HTTP_400_BAD_REQUEST)

        phone = re.sub(r'[\s()+-]', '', str(request.data.get('phone') or ''))
        if not re.fullmatch(r'\d{9,15}', phone):
            return Response({"error": "Enter a phone number for your FPX receipt, e.g. 0123456789."}, status=status.HTTP_400_BAD_REQUEST)
        # ToyyibPay expects local digits only: +60 13-347 4009 becomes 0133474009
        if phone.startswith('60') and len(phone) >= 11:
            phone = '0' + phone[2:]

        open_bills = Transaction.objects.filter(
            related_campaign=campaign, provider=Transaction.Provider.TOYYIBPAY, status=Transaction.Status.PENDING,
        ).order_by('-created_at')
        # Settle earlier bills first so a payment that already went through is never charged twice
        for tx in open_bills:
            try:
                toyyibpay.settle(tx)
            except toyyibpay.ToyyibPayError:
                pass

        outstanding = campaign.budget - paid_project_fees(campaign)
        if outstanding <= 0:
            return Response({"status": "paid", "outstanding": "0.00"})

        # Reuse a recent unpaid bill for the same amount instead of opening a second one
        still_valid_after = timezone.now() - timedelta(days=settings.TOYYIBPAY_BILL_EXPIRY_DAYS) + timedelta(hours=2)
        reusable = open_bills.filter(
            amount=outstanding, created_at__gte=still_valid_after, is_test=toyyibpay.is_sandbox(),
        ).exclude(provider_bill_code='').first()
        if reusable:
            return Response({"payment_url": toyyibpay.payment_url(reusable.provider_bill_code, reusable.is_test), "transaction_id": reusable.id, "amount": reusable.amount})

        tx = Transaction.objects.create(
            company=campaign.company, related_campaign=campaign, amount=outstanding,
            transaction_type=Transaction.Type.PROJECT_FEE, status=Transaction.Status.PENDING,
            provider=Transaction.Provider.TOYYIBPAY, is_test=toyyibpay.is_sandbox(),
        )
        callback_path = reverse('toyyibpay_callback')
        callback_url = f'{settings.API_PUBLIC_URL}{callback_path}' if settings.API_PUBLIC_URL else request.build_absolute_uri(callback_path)
        try:
            bill_code = toyyibpay.create_bill(
                tx, payer_name=campaign.company.company_name, payer_email=request.user.email, payer_phone=phone,
                return_url=f'{settings.FRONTEND_URL}/payment/return', callback_url=callback_url,
            )
        except toyyibpay.ToyyibPayError as exc:
            tx.status = Transaction.Status.FAILED
            tx.save(update_fields=['status'])
            log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.WARNING, f"ToyyibPay bill for TX-{tx.id} failed: {exc}")
            return Response({"error": "We couldn't start the online payment. Please try again, or request an invoice to pay by bank transfer."},
                            status=status.HTTP_502_BAD_GATEWAY)

        tx.provider_bill_code = bill_code
        tx.save(update_fields=['provider_bill_code'])
        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.INFO, f"ToyyibPay bill {bill_code} opened: RM {outstanding} for '{campaign.title}'")
        return Response({"payment_url": toyyibpay.payment_url(bill_code, tx.is_test), "transaction_id": tx.id, "amount": tx.amount},
                        status=status.HTTP_201_CREATED)


class ToyyibPayCallbackView(APIView):
    """ToyyibPay's server-to-server notice that a bill changed. Treated only as a prompt: settle() asks
    ToyyibPay directly before recording anything, so a forged or replayed callback can't mark a bill paid."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    parser_classes = [FormParser, MultiPartParser, JSONParser]

    def post(self, request):
        bill_code = str(request.data.get('billcode') or '')[:40]
        tx = None
        if bill_code:
            tx = Transaction.objects.filter(provider=Transaction.Provider.TOYYIBPAY, provider_bill_code=bill_code).first()
        if tx is None:
            return HttpResponse('OK')
        if not toyyibpay.callback_signature_valid(request.data, test=tx.is_test):
            logger.warning('ToyyibPay callback for bill %s has an invalid signature; checking with ToyyibPay directly', bill_code)
        try:
            toyyibpay.settle(tx)
        except toyyibpay.ToyyibPayError:
            logger.warning('Could not confirm ToyyibPay bill %s; asking ToyyibPay to retry', bill_code)
            return HttpResponse('RETRY', status=503)
        return HttpResponse('OK')


class ToyyibPayVerifyView(APIView):
    """POST {billcode}: the client's return page asks whether their payment went through."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        tx = get_object_or_404(
            Transaction, provider=Transaction.Provider.TOYYIBPAY,
            provider_bill_code=str(request.data.get('billcode') or '')[:40],
            company=getattr(request.user, 'company_profile', None) if request.user.role == User.Role.COMPANY else None,
        )
        try:
            tx = toyyibpay.settle(tx)
        except toyyibpay.ToyyibPayError:
            pass  # reported as still pending; the callback or a later check will settle it
        return Response({"status": tx.status, "campaign_id": tx.related_campaign_id, "amount": tx.amount,
                         "reference": tx.reference, "test_mode": tx.is_test})


class RequestInvoiceView(APIView):
    """POST: the client prefers to pay the project fee by bank transfer; ask UniPact's admins to invoice them."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id):
        from campaigns.utils import paid_project_fees

        campaign, error = _owned_campaign(request, campaign_id)
        if error:
            return error
        outstanding = campaign.budget - paid_project_fees(campaign)
        if campaign.status != Campaign.Status.MATCHED or outstanding <= 0:
            return Response({"error": "There's nothing to invoice on this project."}, status=status.HTTP_400_BAD_REQUEST)
        invoice = request_bank_transfer(campaign, outstanding)
        log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.INFO,
                  f"Invoice requested: RM {outstanding} for '{campaign.title}' ({campaign.company.company_name})")
        return Response({"outstanding": outstanding, "invoice": InvoiceSerializer(invoice).data if invoice else None})



# ------------------------------------------------------------------
# Bank-transfer invoices
# ------------------------------------------------------------------

class InvoiceListView(APIView):
    """GET: the signed-in client's invoices, newest first (replaced ones are left out)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = getattr(request.user, 'company_profile', None) if request.user.role == User.Role.COMPANY else None
        if company is None:
            return Response({"error": "Only clients have invoices."}, status=status.HTTP_403_FORBIDDEN)
        invoices = Invoice.objects.filter(company=company).exclude(status=Invoice.Status.VOID)
        return Response(InvoiceSerializer(invoices, many=True).data)


class InvoicePdfView(APIView):
    """GET: the invoice as a PDF, for the client it was issued to or an admin."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, invoice_id):
        from django.http import HttpResponse

        invoice = get_object_or_404(Invoice.objects.select_related('company'), pk=invoice_id)
        is_owner = request.user.role == User.Role.COMPANY and invoice.company == getattr(request.user, 'company_profile', None)
        if not (is_owner or request.user.role == User.Role.ADMIN):
            # 404, not 403: don't confirm that another client's invoice exists
            return Response({"error": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)
        response = HttpResponse(render_invoice_pdf(invoice), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{invoice.number}.pdf"'
        return response
