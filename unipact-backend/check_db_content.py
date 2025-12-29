import os
import django
import sys

# Setup Django
sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from users.models import User, CompanyProfile, ClubProfile

def list_users():
    print(f"{'ID':<4} {'Email':<30} {'Role':<10} {'Active':<8} {'Details'}")
    print("-" * 70)
    for u in User.objects.all():
        details = ""
        if u.role == 'COMPANY' and hasattr(u, 'company_profile'):
            details = f"Tier: {u.company_profile.tier}, Status: {u.company_profile.verification_status}"
        elif u.role == 'CLUB' and hasattr(u, 'club_profile'):
            details = f"Rank: {u.club_profile.rank}, Status: {u.club_profile.verification_status}"
        
        print(f"{u.id:<4} {u.email:<30} {u.role:<10} {str(u.is_active):<8} {details}")

if __name__ == '__main__':
    list_users()
