from django.urls import path
from .views import CreatePaymentIntentView, MockCheckoutView, ConfirmPaymentView, TransactionHistoryView, TreasurySummaryView

urlpatterns = [
    path('create-intent/', CreatePaymentIntentView.as_view(), name='create_intent'),
    path('mock-checkout/<int:transaction_id>/', MockCheckoutView.as_view(), name='mock_checkout'),
    path('confirm/<int:transaction_id>/', ConfirmPaymentView.as_view(), name='confirm_payment'),
    path('history/', TransactionHistoryView.as_view(), name='transaction_history'),
    path('treasury/', TreasurySummaryView.as_view(), name='treasury_summary'),
]
