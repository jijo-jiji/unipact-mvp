from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User, ClubProfile, ShadowUser
import uuid

class AuditWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create Club
        self.club_user = User.objects.create_user(username='club@test.com', email='club@test.com', password='password', role=User.Role.CLUB)
        self.club = ClubProfile.objects.create(user=self.club_user, club_name='Test Club', university='UM')
        
        # Create Shadow User
        self.token = str(uuid.uuid4())
        self.shadow = ShadowUser.objects.create(
            email='student@test.com', 
            role='Member', 
            invited_by=self.club,
            token=self.token
        )

    def test_claim_profile_success(self):
        """ Test that a shadow user can claim their profile """
        url = reverse('user_claim_profile')
        data = {
            'token': self.token,
            'password': 'newpassword123',
            'first_name': 'Ali',
            'last_name': 'Baba'
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify ShadowUser is updated
        self.shadow.refresh_from_db()
        self.assertTrue(self.shadow.is_claimed)
        self.assertIsNotNone(self.shadow.user)
        self.assertEqual(self.shadow.user.email, 'student@test.com')
        
        # Verify User created
        self.assertTrue(User.objects.filter(email='student@test.com').exists())

    def test_club_roster_mixed_status(self):
        """ Test that roster shows both pending and claimed members """
        # Login as Club
        self.client.force_authenticate(user=self.club_user)
        
        # Verify Initial Roster (Pending)
        url = reverse('club_roster', args=[self.club_user.id])
        response = self.client.get(url)
        self.assertEqual(len(response.data), 2) # President + 1 Shadow
        self.assertEqual(response.data[1]['status'], 'Pending')
        
        # Claim
        self.test_claim_profile_success()
        
        # Verify Post-Claim Roster (Active Member)
        response = self.client.get(url)
        self.assertEqual(response.data[1]['status'], 'Active Member')
        self.assertEqual(response.data[1]['name'], 'Ali Baba')

    def test_transfer_ownership_success(self):
        """ Test transferring club ownership """
        # Claim the student profile first
        self.test_claim_profile_success()
        new_owner_email = 'student@test.com'
        
        # Login as President
        self.client.force_authenticate(user=self.club_user)
        
        url = reverse('club_transfer_ownership')
        data = {'new_owner_email': new_owner_email}
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assertEqual(self.club.user, new_owner_user)

    def test_invite_member_regression(self):
        """ Regression check for InviteMemberView """
        url = reverse('club_invite')
        self.client.force_authenticate(user=self.club_user)
        data = {'email': 'new@member.com', 'role': 'Treasurer'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ShadowUser.objects.filter(email='new@member.com').count(), 1)

