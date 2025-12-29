import os
import django
import sys

# Setup Django
sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from users.models import User

def test_filters():
    print("--- Testing Filters ---")
    
    # Check all companies
    all_companies = User.objects.filter(role='COMPANY')
    print(f"Total Companies: {all_companies.count()}")
    for c in all_companies:
        print(f" - {c.email} Tier: {c.company_profile.tier}")

    # Test Filter
    pro_companies = User.objects.filter(role='COMPANY', company_profile__tier='PRO')
    print(f"\nCompanies with Tier='PRO': {pro_companies.count()}")
    for c in pro_companies:
        print(f" - {c.email}")

if __name__ == '__main__':
    test_filters()
