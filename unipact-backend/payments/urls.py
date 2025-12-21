from django.urls import path
from .views import CreateTransactionView

urlpatterns = [
    path('transaction/create/', CreateTransactionView.as_view(), name='create_transaction'),
]
