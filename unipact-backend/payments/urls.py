from django.urls import path
from .views import (
    CreatePaymentIntentView, MockCheckoutView, ConfirmPaymentView, TransactionHistoryView, TreasurySummaryView,
    StudentPayoutListView, AdminPayoutListView, AdminRecordPayoutView, AdminRecordClientPaymentView
)

urlpatterns = [
    path('create-intent/', CreatePaymentIntentView.as_view(), name='create_intent'),
    path('mock-checkout/<int:transaction_id>/', MockCheckoutView.as_view(), name='mock_checkout'),
    path('confirm/<int:transaction_id>/', ConfirmPaymentView.as_view(), name='confirm_payment'),
    path('history/', TransactionHistoryView.as_view(), name='transaction_history'),
    path('treasury/', TreasurySummaryView.as_view(), name='treasury_summary'),
    
    # Student Payout Registry & History
    path('payouts/me/', StudentPayoutListView.as_view(), name='student_payouts_me'),

    # Admin Payout Management
    path('admin/payouts/', AdminPayoutListView.as_view(), name='admin_payouts_list'),
    path('admin/payouts/<int:pk>/record/', AdminRecordPayoutView.as_view(), name='admin_record_payout'),
    path('admin/campaigns/<int:campaign_id>/record-payment/', AdminRecordClientPaymentView.as_view(), name='admin_record_client_payment'),
]

