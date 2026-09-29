"""ToyyibPay (FPX online banking) for client project fees. API: https://toyyibpay.com/apireference/

A payment only counts once UniPact has asked ToyyibPay itself (getBillTransactions) and the bill shows
a successful payment of the exact amount for our reference. The callback and return URLs are just
prompts to go and check, so a forged or replayed request can never mark a bill as paid.
"""
import hashlib
import hmac
import logging
import re
from decimal import Decimal, InvalidOperation

import requests
from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 20
PAID, PENDING, FAILED, PENDING_ALT = '1', '2', '3', '4'


class ToyyibPayError(Exception):
    """ToyyibPay couldn't be reached or refused the request. The message is safe to show to staff."""


def is_enabled():
    return bool(settings.TOYYIBPAY_SECRET_KEY and settings.TOYYIBPAY_CATEGORY_CODE)


def payment_url(bill_code):
    return f'{settings.TOYYIBPAY_BASE_URL}/{bill_code}'


def order_reference(transaction_obj):
    """Our reference on the bill (billExternalReferenceNo); ToyyibPay echoes it back as order_id."""
    return f'UNIPACT-TX-{transaction_obj.id}'


def _clean(text, limit):
    # billName and billDescription accept only letters, digits, spaces and underscores
    cleaned = re.sub(r'\s+', ' ', re.sub(r'[^A-Za-z0-9 _]', ' ', str(text))).strip()
    return cleaned[:limit].strip() or 'UniPact'


def _post(endpoint, data):
    try:
        response = requests.post(f'{settings.TOYYIBPAY_BASE_URL}/index.php/api/{endpoint}', data=data, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise ToyyibPayError('Could not reach ToyyibPay. Please try again in a moment.') from exc
    try:
        return response.json()
    except ValueError:
        # Account and category problems come back as plain text codes, e.g. [KEY-DID-NOT-EXIST]
        raise ToyyibPayError(f'ToyyibPay refused the request: {response.text.strip()[:200]}')


def create_bill(transaction_obj, *, payer_name, payer_email, payer_phone, return_url, callback_url):
    """Open a fixed-amount FPX bill for a pending transaction and return its BillCode."""
    campaign = transaction_obj.related_campaign
    data = {
        'userSecretKey': settings.TOYYIBPAY_SECRET_KEY,
        'categoryCode': settings.TOYYIBPAY_CATEGORY_CODE,
        'billName': _clean('UniPact project fee', 30),
        'billDescription': _clean(f'Project fee for {campaign.title}' if campaign else 'UniPact project fee', 100),
        'billPriceSetting': 1,  # fixed amount
        'billPayorInfo': 1,
        'billAmount': int((transaction_obj.amount * 100).to_integral_value()),  # in sen
        'billReturnUrl': return_url,
        'billCallbackUrl': callback_url,
        'billExternalReferenceNo': order_reference(transaction_obj),
        'billTo': payer_name[:100],
        'billEmail': payer_email,
        'billPhone': payer_phone,
        'billPaymentChannel': 0,  # FPX
        'billChargeToCustomer': '',  # blank = UniPact pays the gateway fee
        'billExpiryDays': settings.TOYYIBPAY_BILL_EXPIRY_DAYS,
    }
    if settings.TOYYIBPAY_ENABLE_FPX_B2B:
        data.update({'enableFPXB2B': 1, 'chargeFPXB2B': 1})

    body = _post('createBill', data)
    if isinstance(body, list) and body and isinstance(body[0], dict) and body[0].get('BillCode'):
        return body[0]['BillCode']
    message = body.get('msg') if isinstance(body, dict) else body
    raise ToyyibPayError(f'ToyyibPay refused the bill: {str(message)[:200]}')


def get_bill_transactions(bill_code):
    body = _post('getBillTransactions', {'billCode': bill_code})
    return body if isinstance(body, list) else []


def callback_signature_valid(data):
    """ToyyibPay signs callbacks with MD5(secret + status + order_id + refno + 'ok'). Only used to spot
    forged callbacks in the logs: settle() always re-checks with ToyyibPay before recording anything."""
    expected = hashlib.md5(
        f"{settings.TOYYIBPAY_SECRET_KEY}{data.get('status', '')}{data.get('order_id', '')}{data.get('refno', '')}ok".encode()
    ).hexdigest()
    return hmac.compare_digest(expected, str(data.get('hash', '')))


def settle(transaction_obj):
    """Ask ToyyibPay what happened to this transaction's bill and record the outcome. Idempotent: safe to
    call from the callback, the return page and a retry at the same time. Returns the fresh transaction."""
    from users.models import SystemLog
    from users.utils import log_event
    from unipact_backend import notifications
    from .models import Transaction

    if transaction_obj.status != Transaction.Status.PENDING or not transaction_obj.provider_bill_code:
        return transaction_obj

    # The HTTP call happens before taking the row lock so a slow gateway never holds up the database
    rows = [r for r in get_bill_transactions(transaction_obj.provider_bill_code)
            if str(r.get('billExternalReferenceNo', '')) == order_reference(transaction_obj)]

    with db_transaction.atomic():
        tx = Transaction.objects.select_for_update().select_related('company__user', 'related_campaign').get(pk=transaction_obj.pk)
        if tx.status != Transaction.Status.PENDING:
            return tx

        paid = next((r for r in rows if str(r.get('billpaymentStatus')) == PAID), None)
        if paid:
            try:
                amount_paid = Decimal(str(paid.get('billpaymentAmount')).replace(',', ''))
            except (InvalidOperation, TypeError):
                amount_paid = None
            if amount_paid != tx.amount:
                logger.error('ToyyibPay bill %s paid %s but TX-%s expects %s; left pending for review',
                             tx.provider_bill_code, paid.get('billpaymentAmount'), tx.id, tx.amount)
                problem = f"ToyyibPay reports RM {paid.get('billpaymentAmount')} paid on TX-{tx.id}, but RM {tx.amount} was billed. It was not counted towards escrow; check the payment in ToyyibPay and record the right amount by hand."
                log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.CRITICAL, problem)
                notifications.payment_needs_attention(problem, tx)
                return tx

            tx.status = Transaction.Status.SUCCESS
            tx.paid_at = timezone.now()
            tx.reference = f"FPX {paid.get('billpaymentInvoiceNo') or tx.provider_bill_code}"[:100]
            tx.save(update_fields=['status', 'paid_at', 'reference'])

            from campaigns.utils import paid_project_fees
            campaign = tx.related_campaign
            outstanding = campaign.budget - paid_project_fees(campaign) if campaign else None
            log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.SUCCESS,
                      f"ToyyibPay payment received: RM {tx.amount} from {tx.company.company_name} ({tx.reference})")
            if outstanding is not None and outstanding < 0:
                # Two bills paid for the same project, e.g. from two browser tabs: the money arrived, so keep it,
                # but make sure someone refunds the difference
                problem = f"{tx.company.company_name} has paid RM {-outstanding} more than the project fee for '{campaign.title}' (probably two payments). Refund the difference."
                log_event(SystemLog.Category.FINANCIAL, SystemLog.Level.CRITICAL, problem)
                notifications.payment_needs_attention(problem, tx)
            notifications.payment_receipt(tx, outstanding=max(outstanding, Decimal('0')) if outstanding is not None else None)
        elif rows and all(str(r.get('billpaymentStatus')) == FAILED for r in rows):
            tx.status = Transaction.Status.FAILED
            tx.save(update_fields=['status'])
        return tx
