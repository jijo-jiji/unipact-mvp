from django.test import TestCase
from users.models import User, ClubProfile, CompanyProfile
from reviews.models import Review
from campaigns.models import Campaign
from django.utils import timezone
from datetime import timedelta

class ReputationDecayTests(TestCase):
    def setUp(self):
        self.club_user = User.objects.create_user(username='club', email='club@test.com', role=User.Role.CLUB)
        self.club = ClubProfile.objects.create(user=self.club_user, club_name='Club A', university='Uni A')
        
        self.company_user = User.objects.create_user(username='comp', email='comp@test.com', role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='Comp A')
        
        self.campaign = Campaign.objects.create(
            title='Test Campaign', 
            company=self.company, 
            budget=100.00,
            type='TALENT_BOUNTY',
            description='Test'
        )

    def test_rank_decay_inactive(self):
        """ Test that a club with only old reviews decays to C-Rank """
        # 1. Create Old S-Rank Review (2 years ago)
        # Note: We must create first, then update created_at because auto_now_add=True
        old_review = Review.objects.create(
            reviewer=self.company,
            reviewee=self.club,
            campaign=self.campaign,
            rating=5,
            comment="Amazing"
        )
        old_review.created_at = timezone.now() - timedelta(days=730)
        old_review.save()
        
        # Force calculate
        self.club.calculate_rank()
        self.club.refresh_from_db()
        
        # Should be 'C' because filtered out
        self.assertEqual(self.club.rank, 'C')
        
    def test_rank_active(self):
        """ Test that recent reviews count """
        Review.objects.create(
            reviewer=self.company,
            reviewee=self.club,
            campaign=self.campaign,
            rating=5,
            comment="Amazing"
        )
        
        self.club.calculate_rank()
        self.club.refresh_from_db()
        
        self.assertEqual(self.club.rank, 'S')
