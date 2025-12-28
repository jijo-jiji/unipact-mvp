from django.urls import path
from .views import CreatePaymentIntentView, ConfirmPaymentView, TransactionHistoryView, TreasurySummaryView

urlpatterns = [
    path('create-intent/', CreatePaymentIntentView.as_view(), name='create_intent'),
    path('confirm/<int:transaction_id>/', ConfirmPaymentView.as_view(), name='confirm_payment'),
    path('history/', TransactionHistoryView.as_view(), name='transaction_history'),
    path('treasury/', TreasurySummaryView.as_view(), name='treasury_summary'),
]
