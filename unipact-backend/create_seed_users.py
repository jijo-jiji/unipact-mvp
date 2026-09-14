import os
import django
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import CompanyProfile, ClubProfile, StudentProfile
from campaigns.models import Campaign, ProjectTeamInvitation

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
        print(f"[OK] Admin created: {admin_email} / adminpass123")
    else:
        admin = User.objects.get(email=admin_email)
        print(f"[INFO] Admin already exists: {admin_email}")

    # 2. Create Company User
    company_email = "company@unipact.com"
    company_user, c_created = User.objects.get_or_create(
        email=company_email,
        defaults={
            'username': 'testcompany',
            'role': User.Role.COMPANY,
            'is_verified': True
        }
    )
    if c_created:
        company_user.set_password("companypass123")
        company_user.save()
    company_profile, _ = CompanyProfile.objects.get_or_create(
        user=company_user,
        defaults={
            'company_name': 'TechNova Innovations Sdn Bhd',
            'tier': CompanyProfile.Tier.PRO,
            'verification_status': CompanyProfile.VerificationStatus.VERIFIED
        }
    )
    print(f"[OK] Company ready: {company_email} / companypass123")

    # 3. Create Student User 1 (Software Dev)
    student1_email = "student@unipact.com"
    s1_user, s1_created = User.objects.get_or_create(
        email=student1_email,
        defaults={
            'username': 'student_talent',
            'role': User.Role.STUDENT,
            'is_verified': True
        }
    )
    if s1_created:
        s1_user.set_password("studentpass123")
        s1_user.save()
    s1_profile, _ = StudentProfile.objects.get_or_create(
        user=s1_user,
        defaults={
            'full_name': 'Ahmad Zaki',
            'university': 'Universiti Malaya (UM)',
            'major': 'Computer Science (Software Engineering)',
            'domain_focus': StudentProfile.DomainFocus.SOFTWARE_DEV,
            'skills': ['React', 'Django', 'PostgreSQL', 'Tailwind CSS', 'Docker'],
            'bio': 'Lead full-stack developer passionate about enterprise systems and clean cloud architecture.',
            'rating': Decimal('4.9'),
            'verification_status': StudentProfile.VerificationStatus.VERIFIED
        }
    )
    print(f"[OK] Student 1 (Dev) ready: {student1_email} / studentpass123")

    # 4. Create Student User 2 (Digital Marketing)
    student2_email = "student2@unipact.com"
    s2_user, s2_created = User.objects.get_or_create(
        email=student2_email,
        defaults={
            'username': 'marketing_talent',
            'role': User.Role.STUDENT,
            'is_verified': True
        }
    )
    if s2_created:
        s2_user.set_password("studentpass123")
        s2_user.save()
    s2_profile, _ = StudentProfile.objects.get_or_create(
        user=s2_user,
        defaults={
            'full_name': 'Sarah Tan',
            'university': "Taylor's University",
            'major': 'Digital Media & Marketing Communications',
            'domain_focus': StudentProfile.DomainFocus.MARKETING,
            'skills': ['Content Strategy', 'TikTok Video Production', 'Copywriting', 'SEO', 'Canva Pro'],
            'bio': 'Creative digital marketer specialized in short-form video campaigns and Gen-Z brand engagement.',
            'rating': Decimal('4.85'),
            'verification_status': StudentProfile.VerificationStatus.VERIFIED
        }
    )
    print(f"[OK] Student 2 (Marketing) ready: {student2_email} / studentpass123")

    # 5. Create Student User 3 (Peer Collaborator)
    student3_email = "student3@unipact.com"
    s3_user, s3_created = User.objects.get_or_create(
        email=student3_email,
        defaults={
            'username': 'peer_collaborator',
            'role': User.Role.STUDENT,
            'is_verified': True
        }
    )
    if s3_created:
        s3_user.set_password("studentpass123")
        s3_user.save()
    s3_profile, _ = StudentProfile.objects.get_or_create(
        user=s3_user,
        defaults={
            'full_name': 'Farhan Daniel',
            'university': 'Sunway University',
            'major': 'Information Technology',
            'domain_focus': StudentProfile.DomainFocus.SOFTWARE_DEV,
            'skills': ['UI/UX Design', 'Figma', 'Frontend Architecture', 'Next.js'],
            'bio': 'UI/UX developer bridging wireframes and production React components.',
            'rating': Decimal('5.0'),
            'verification_status': StudentProfile.VerificationStatus.VERIFIED
        }
    )
    print(f"[OK] Student 3 (Peer) ready: {student3_email} / studentpass123")

    # 6. Create Club User (V2.2.1 Coexistence)
    club_email = "club@unipact.com"
    club_user, club_created = User.objects.get_or_create(
        email=club_email,
        defaults={
            'username': 'codingclub',
            'role': User.Role.CLUB,
            'is_verified': True
        }
    )
    if club_created:
        club_user.set_password("clubpass123")
        club_user.save()
    ClubProfile.objects.get_or_create(
        user=club_user,
        defaults={
            'club_name': 'University Coding Club',
            'university': 'Tech University',
            'verification_status': ClubProfile.VerificationStatus.VERIFIED
        }
    )
    print(f"[OK] Club ready: {club_email} / clubpass123")

    # 7. Seed Sample V3.0 Projects
    camp_title = "Enterprise ESG Compliance Portal MVP"
    c1, camp_created = Campaign.objects.get_or_create(
        title=camp_title,
        defaults={
            'company': company_profile,
            'description': 'Build a full-stack React and Django ESG monitoring dashboard for enterprise carbon audits.',
            'type': Campaign.Type.SOFTWARE_DEVELOPMENT,
            'budget': Decimal('4500.00'),
            'requirements': ['Responsive React Dashboard', 'JWT Authentication', 'CSV Report Generator', 'Clean Git Repository'],
            'status': 'IN_PROGRESS',
            'is_match_finalized': True,
            'match_notes': 'Curated matching: Ahmad Zaki (Lead Full-Stack Architect) assigned by UniPact Admin.'
        }
    )
    if camp_created:
        c1.assigned_students.add(s1_profile)
        ProjectTeamInvitation.objects.create(
            campaign=c1,
            invited_by=s1_profile,
            invitee_email=student3_email,
            invitee_student=s3_profile,
            role_in_project="UI/UX Specialist",
            payout_share_percentage=30,
            status=ProjectTeamInvitation.Status.PENDING,
            notes="Please assist in creating high-fidelity Tailwind components for the reporting dashboard."
        )
        print(f"[OK] Created Sample Project: {camp_title}")
    else:
        print(f"[INFO] Sample Project already exists: {camp_title}")

if __name__ == "__main__":
    try:
        create_users()
        print("\n[SUCCESS] All UniPact V3.0 seed users and sample campaigns successfully provisioned!")
    except Exception as e:
        print(f"[ERROR] Error creating users: {e}")
