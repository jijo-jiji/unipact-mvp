import os
import sys
from decimal import Decimal

sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')

import django
django.setup()

from users.models import CompanyProfile
from payments.models import Transaction

def backfill():
    print("--- Backfilling Pro Subscriptions ---")
    pro_companies = CompanyProfile.objects.filter(tier='PRO')
    
    for company in pro_companies:
        # Check if they have a 'real' subscription payment
        # Assuming > 100 is a real payment for this MVP
        has_sub = Transaction.objects.filter(
            company=company, 
            transaction_type=Transaction.Type.SUBSCRIPTION,
            amount__gt=100
        ).exists()
        
        if not has_sub:
            print(f"Creating backfill for {company.company_name}...")
            Transaction.objects.create(
                company=company,
                amount=Decimal('499.00'),
                transaction_type=Transaction.Type.SUBSCRIPTION,
                status=Transaction.Status.SUCCESS,
                stripe_payment_id='backfill_manual'
            )
            print("Done.")
        else:
            print(f"{company.company_name} already has subscription record.")

if __name__ == '__main__':
    backfill()
