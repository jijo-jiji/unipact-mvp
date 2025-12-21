from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from .models import CompanyProfile, ClubProfile

User = get_user_model()

class LoginTests(APITestCase):
    def setUp(self):
        self.url = reverse('login')
        self.user = User.objects.create_user(
            username='test@example.com', 
            email='test@example.com', 
            password='password123',
            role=User.Role.COMPANY
        )
        self.profile = CompanyProfile.objects.create(
            user=self.user,
            company_name='Test Co',
            verification_status=CompanyProfile.VerificationStatus.VERIFIED
        )

    def test_login_returns_status(self):
        """
        Test that login returns the user's role and verification status.
        """
        data = {
            'email': 'test@example.com',
            'password': 'password123'
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'COMPANY')
        self.assertEqual(response.data['verification_status'], 'VERIFIED')

    def test_invalid_login(self):
        data = {
            'email': 'test@example.com',
            'password': 'wrongpassword'
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

from .models import ShadowUser

class ShadowUserTests(APITestCase):
    def setUp(self):
        self.club_user = User.objects.create_user(username='club@uni.edu', email='club@uni.edu', password='pw', role=User.Role.CLUB)
        self.club_profile = ClubProfile.objects.create(
            user=self.club_user, 
            club_name="Club A", 
            university="Uni A",
            verification_status=ClubProfile.VerificationStatus.VERIFIED
        )
        self.url = reverse('invite_member')

    def test_invite_member(self):
        self.client.force_authenticate(user=self.club_user)
        data = {'email': 'new@member.com', 'role': 'Treasurer'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ShadowUser.objects.count(), 1)
        self.assertEqual(ShadowUser.objects.get().invited_by, self.club_profile)

    def test_invite_existing_user_fails(self):
        User.objects.create_user(username='existing@user.com', email='existing@user.com', password='pw')
        self.client.force_authenticate(user=self.club_user)
        data = {'email': 'existing@user.com', 'role': 'Member'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class RegistrationTests(APITestCase):
    def test_company_registration_corporate_email(self):
        """
        Test that registering with a corporate email (not in public list) 
        sets status to PENDING_REVIEW (Silent Verification).
        """
        url = reverse('register_company')
        data = {
            'email': 'jane@acme.corp',
            'password': 'securepassword123',
            'company_name': 'Acme Corp',
            'company_details': 'Best tech in town'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(CompanyProfile.objects.get().verification_status, CompanyProfile.VerificationStatus.PENDING_REVIEW)

    def test_company_registration_public_email(self):
        """
        Test that registering with a public email (e.g. gmail.com)
        sets status to HIGH_RISK.
        """
        url = reverse('register_company')
        data = {
            'email': 'jane@gmail.com',
            'password': 'securepassword123',
            'company_name': 'Jane Startup',
            'company_details': 'My cool startup'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CompanyProfile.objects.get().verification_status, CompanyProfile.VerificationStatus.HIGH_RISK)

    def test_club_registration(self):
        """
        Test that club registration sets default status to PENDING_VERIFICATION.
        """
        url = reverse('register_club')
        data = {
            'email': 'club@uni.edu',
            'password': 'password123',
            'club_name': 'Robotics Club',
            'university': 'Tech University'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ClubProfile.objects.get().verification_status, ClubProfile.VerificationStatus.PENDING_VERIFICATION)
