import os
import sys
import django

sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from users.models import User, CompanyProfile
from payments.models import Transaction

def check_data():
    print("--- Pro Tier Companies ---")
    pro_companies = CompanyProfile.objects.filter(tier='PRO')
    for company in pro_companies:
        print(f"Company: {company.company_name} (ID: {company.id})")
        txs = Transaction.objects.filter(company=company)
        print(f"  Transactions: {txs.count()}")
        for tx in txs:
            print(f"    - {tx.transaction_type}: {tx.amount} ({tx.status})")
            
    print("\n--- All Successful Transactions ---")
    all_txs = Transaction.objects.filter(status='SUCCESS')
    total = 0
    for tx in all_txs:
        print(f"ID: {tx.id} | Amt: {tx.amount} | Co: {tx.company.company_name}")
        total += tx.amount
    print(f"Total Calculated: {total}")

if __name__ == '__main__':
    check_data()
