from django.urls import path
from .views import (
    CreatePaymentIntentView, MockCheckoutView, ConfirmPaymentView, TransactionHistoryView, TreasurySummaryView,
    StudentPayoutListView, AdminPayoutListView, AdminRecordPayoutView, AdminRecordClientPaymentView,
    ToyyibPayCreateBillView, ToyyibPayCallbackView, ToyyibPayVerifyView, RequestInvoiceView,
    InvoiceListView, InvoicePdfView,
    AdminQuotationListCreateView, AdminQuotationDetailView, AdminQuotationSendView,
    QuotationAcceptView, QuotationRequestChangesView, QuotationPdfView,
)

urlpatterns = [
    path('create-intent/', CreatePaymentIntentView.as_view(), name='create_intent'),
    path('mock-checkout/<int:transaction_id>/', MockCheckoutView.as_view(), name='mock_checkout'),
    path('confirm/<int:transaction_id>/', ConfirmPaymentView.as_view(), name='confirm_payment'),
    path('history/', TransactionHistoryView.as_view(), name='transaction_history'),
    path('treasury/', TreasurySummaryView.as_view(), name='treasury_summary'),

    # ToyyibPay (FPX online banking) and the bank-transfer fallback
    path('toyyibpay/bill/', ToyyibPayCreateBillView.as_view(), name='toyyibpay_create_bill'),
    path('toyyibpay/callback/', ToyyibPayCallbackView.as_view(), name='toyyibpay_callback'),
    path('toyyibpay/verify/', ToyyibPayVerifyView.as_view(), name='toyyibpay_verify'),
    path('campaigns/<int:campaign_id>/request-invoice/', RequestInvoiceView.as_view(), name='request_invoice'),
    path('invoices/', InvoiceListView.as_view(), name='invoice_list'),
    path('invoices/<int:invoice_id>/pdf/', InvoicePdfView.as_view(), name='invoice_pdf'),

    # Quotations: written by an admin after meeting the client, accepted by the client before matching
    path('quotations/', AdminQuotationListCreateView.as_view(), name='quotation_create'),
    path('quotations/<int:quotation_id>/', AdminQuotationDetailView.as_view(), name='quotation_detail'),
    path('quotations/<int:quotation_id>/send/', AdminQuotationSendView.as_view(), name='quotation_send'),
    path('quotations/<int:quotation_id>/accept/', QuotationAcceptView.as_view(), name='quotation_accept'),
    path('quotations/<int:quotation_id>/request-changes/', QuotationRequestChangesView.as_view(), name='quotation_request_changes'),
    path('quotations/<int:quotation_id>/pdf/', QuotationPdfView.as_view(), name='quotation_pdf'),
    
    # Student Payout Registry & History
    path('payouts/me/', StudentPayoutListView.as_view(), name='student_payouts_me'),

    # Admin Payout Management
    path('admin/payouts/', AdminPayoutListView.as_view(), name='admin_payouts_list'),
    path('admin/payouts/<int:pk>/record/', AdminRecordPayoutView.as_view(), name='admin_record_payout'),
    path('admin/campaigns/<int:campaign_id>/record-payment/', AdminRecordClientPaymentView.as_view(), name='admin_record_client_payment'),
]

