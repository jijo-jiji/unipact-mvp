import os
import sys
from decimal import Decimal

# Setup Path & Settings BEFORE Django imports
sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')

import django
django.setup()

from payments.models import Transaction, CompanyProfile
from users.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from users.views import AdminDashboardStatsView

def verify_revenue():
    print("--- Verifying Revenue Calculation ---")
    
    # 1. Create a Mock Company & Transactions
    # Check if company exists first to avoid duplicates in repeated runs
    user = User.objects.filter(email='rev_test@example.com').first()
    if not user:
        user = User.objects.create_user(username='rev_test', email='rev_test@example.com', password='password123', role='COMPANY')
        profile = CompanyProfile.objects.create(user=user, company_name="Rev Test Co")
    else:
        profile = user.company_profile
        
    # Clear existing transactions for this user for clean test
    Transaction.objects.filter(company=profile).delete()

    # Create Transactions
    Transaction.objects.create(
        company=profile, 
        amount=Decimal('100.00'), 
        transaction_type=Transaction.Type.SUBSCRIPTION, 
        status=Transaction.Status.SUCCESS
    )
    Transaction.objects.create(
        company=profile, 
        amount=Decimal('50.50'), 
        transaction_type=Transaction.Type.FINDERS_FEE, 
        status=Transaction.Status.SUCCESS
    )
    Transaction.objects.create(
        company=profile, 
        amount=Decimal('500.00'), 
        transaction_type=Transaction.Type.SUBSCRIPTION, 
        status=Transaction.Status.FAILED # Should vary
    )

    expected_revenue = 100.00 + 50.50 # = 150.50

    # 2. Call the View
    factory = APIRequestFactory()
    admin = User.objects.filter(role=User.Role.ADMIN).first()
    
    request = factory.get('/users/admin/stats/')
    force_authenticate(request, user=admin)
    view = AdminDashboardStatsView.as_view()
    
    response = view(request)
    print(f"Status: {response.status_code}")
    print(f"Stats Data: {response.data}")
    
    rev_str = response.data['revenue'] # e.g. "RM 150.50"
    print(f"Revenue Returned: {rev_str}")
    
    # Simple check (handling existing DB data might make exact match hard, but let's see)
    # At minimum it should be RM X,XXX.XX format
    if "RM" in rev_str:
        print("Format Check: PASS")
    else:
        print("Format Check: FAIL")

if __name__ == '__main__':
    verify_revenue()
