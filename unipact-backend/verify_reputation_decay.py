import os
import django
from datetime import timedelta
from django.utils import timezone

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from users.models import User, ClubProfile, CompanyProfile
from reviews.models import Review
from campaigns.models import Campaign

def run_verification():
    print("--- Verifying Reputation Engine (Rank Decay) ---")
    
    # 1. Setup Data
    print("1. Setting up test data...")
    # Clean up previous run
    User.objects.filter(email='verify_club@test.com').delete()
    User.objects.filter(email='verify_comp@test.com').delete()
    
    club_user = User.objects.create_user(username='verify_club', email='verify_club@test.com', role='CLUB')
    club = ClubProfile.objects.create(user=club_user, club_name='Verify Club', university='Test Uni')
    
    comp_user = User.objects.create_user(username='verify_comp', email='verify_comp@test.com', role='COMPANY')
    company = CompanyProfile.objects.create(user=comp_user, company_name='Verify Corp')
    
    campaign = Campaign.objects.create(
        title='Verify Campaign', company=company, budget=100.00, type='TALENT_BOUNTY'
    )
    
    # 2. Test Inactive Case (Old Reviews)
    print("\n2. Testing Inactive Club (Reviews > 1 year old)...")
    old_review = Review.objects.create(
        reviewer=company, reviewee=club, campaign=campaign, rating=5, comment="Old Good Job"
    )
    # Hack: Force created_at to past
    old_review.created_at = timezone.now() - timedelta(days=700)
    old_review.save()
    
    club.calculate_rank()
    club.refresh_from_db()
    
    print(f"   - Rank after old 5-star review: {club.rank}")
    if club.rank == 'C':
        print("   ✅ PASS: Old review ignored. Rank decayed to C.")
    else:
        print(f"   ❌ FAIL: Rank is {club.rank} (Expected C).")

    # 3. Test Active Case (New Reviews)
    print("\n3. Testing Active Club (New Reviews)...")
    # Need new campaign for unique constraint
    campaign2 = Campaign.objects.create(
        title='Verify Campaign 2', company=company, budget=100.00, type='TALENT_BOUNTY'
    )
    
    new_review = Review.objects.create(
        reviewer=company, reviewee=club, campaign=campaign2, rating=5, comment="New Good Job"
    )
    # created_at is Now by default
    
    club.calculate_rank()
    club.refresh_from_db()
    
    print(f"   - Rank after new 5-star review: {club.rank}")
    if club.rank == 'S':
         print("   ✅ PASS: New review counted. Rank rose to S.")
    else:
         print(f"   ❌ FAIL: Rank is {club.rank} (Expected S).")

if __name__ == '__main__':
    run_verification()
