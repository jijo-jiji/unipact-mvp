import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import CompanyProfile, ClubProfile

User = get_user_model()

def create_users():
    # 1. Create Admin User
    admin_email = "admin@unipact.com"
    if not User.objects.filter(email=admin_email).exists():
        admin = User.objects.create_superuser(
            username="admin",
            email=admin_email,
            password="adminpass123",
            role=User.Role.ADMIN,
            is_verified=True
        )
        print(f"✅ Admin created: {admin_email} / adminpass123")
    else:
        print(f"ℹ️ Admin already exists: {admin_email}")

    # 2. Create Company User
    company_email = "company@unipact.com"
    if not User.objects.filter(email=company_email).exists():
        company_user = User.objects.create_user(
            username="testcompany",
            email=company_email,
            password="companypass123",
            role=User.Role.COMPANY,
            is_verified=True
        )
        CompanyProfile.objects.create(
            user=company_user,
            company_name="TechNova Innovations",
            tier=CompanyProfile.Tier.PRO,
            verification_status=CompanyProfile.VerificationStatus.VERIFIED
        )
        print(f"✅ Company created: {company_email} / companypass123")
    else:
        print(f"ℹ️ Company already exists: {company_email}")

    # 3. Create Club User
    club_email = "club@unipact.com"
    if not User.objects.filter(email=club_email).exists():
        club_user = User.objects.create_user(
            username="codingclub",
            email=club_email,
            password="clubpass123",
            role=User.Role.CLUB,
            is_verified=True
        )
        ClubProfile.objects.create(
            user=club_user,
            club_name="University Coding Club",
            university="Tech University",
            verification_status=ClubProfile.VerificationStatus.VERIFIED
        )
        print(f"✅ Club created: {club_email} / clubpass123")
    else:
        print(f"ℹ️ Club already exists: {club_email}")

if __name__ == "__main__":
    try:
        create_users()
    except Exception as e:
        print(f"❌ Error creating users: {e}")
