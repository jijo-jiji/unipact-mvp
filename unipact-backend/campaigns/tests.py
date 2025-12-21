from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from users.models import CompanyProfile, ClubProfile
from payments.models import Transaction
from .models import Campaign, Application, Report

User = get_user_model()

class CampaignTests(APITestCase):
    def setUp(self):
        # Create Company
        self.company_user = User.objects.create_user(username='comp@corp.com', email='comp@corp.com', password='pw', role=User.Role.COMPANY)
        self.company_profile = CompanyProfile.objects.create(
            user=self.company_user, 
            company_name="Comp A",
            verification_status=CompanyProfile.VerificationStatus.VERIFIED,
            tier=CompanyProfile.Tier.PRO
        )
        self.company_user.force_authenticate = lambda: self.client.force_authenticate(user=self.company_user)

        # Create Club
        self.club_user = User.objects.create_user(username='club@uni.edu', email='club@uni.edu', password='pw', role=User.Role.CLUB)
        self.club_profile = ClubProfile.objects.create(
            user=self.club_user, 
            club_name="Club A", 
            university="Uni A",
            verification_status=ClubProfile.VerificationStatus.VERIFIED
        )

        # Create High Risk Company
        self.risk_user = User.objects.create_user(username='risk@gmail.com', email='risk@gmail.com', password='pw', role=User.Role.COMPANY)
        self.risk_profile = CompanyProfile.objects.create(
            user=self.risk_user,
            company_name="Risk Co",
            verification_status=CompanyProfile.VerificationStatus.HIGH_RISK
        )

    def test_create_campaign(self):
        self.client.force_authenticate(user=self.company_user)
        url = reverse('campaign_list_create')
        data = {
            'title': 'Test Campaign',
            'description': 'Desc',
            'type': Campaign.Type.TALENT_BOUNTY,
            'budget': '1000.00'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Campaign.objects.count(), 1)
        self.assertEqual(Campaign.objects.get().status, Campaign.Status.OPEN)

    def test_high_risk_create_forbidden(self):
        self.client.force_authenticate(user=self.risk_user)
        url = reverse('campaign_list_create')
        data = {
            'title': 'Risk Campaign',
            'description': 'Desc',
            'type': Campaign.Type.TALENT_BOUNTY,
            'budget': '1000.00'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_application_workflow(self):
        # 1. Company creates campaign
        campaign = Campaign.objects.create(
            company=self.company_profile,
            title="Campaign 1",
            type=Campaign.Type.TALENT_BOUNTY,
            budget=500,
            status=Campaign.Status.OPEN
        )

        # 2. Club applies
        self.client.force_authenticate(user=self.club_user)
        url = reverse('application_create', kwargs={'campaign_id': campaign.id})
        data = {'message': 'Pick us!'}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        app_id = response.data['id']

        # 3. Company awards
        self.client.force_authenticate(user=self.company_user)
        award_url = reverse('award_application', kwargs={'application_id': app_id})
        response = self.client.post(award_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify statuses
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, Campaign.Status.IN_PROGRESS)
        
        application = Application.objects.get(pk=app_id)
        self.assertEqual(application.status, Application.Status.AWARDED)

    def test_deliverable_upload(self):
        # Setup awarded application
        campaign = Campaign.objects.create(
            company=self.company_profile,
            title="Campaign 2",
            type=Campaign.Type.TALENT_BOUNTY,
            budget=500,
            status=Campaign.Status.OPEN
        )
        application = Application.objects.create(
            campaign=campaign,
            club=self.club_profile,
            message="Msg",
            status=Application.Status.AWARDED
        )

        self.client.force_authenticate(user=self.club_user)
        url = reverse('deliverable_create', kwargs={'application_id': application.id})
        
        # Mock file upload
        from django.core.files.uploadedfile import SimpleUploadedFile
        file = SimpleUploadedFile("file.txt", b"file_content")
        
        data = {'file': file}
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_free_tier_blocked_and_pay(self):
        # 1. Setup Free Tier Company
        free_user = User.objects.create_user(username='free@corp.com', email='free@corp.com', password='pw', role=User.Role.COMPANY)
        free_profile = CompanyProfile.objects.create(
            user=free_user,
            company_name="Free Corp",
            verification_status=CompanyProfile.VerificationStatus.VERIFIED,
            tier=CompanyProfile.Tier.FREE
        ) # Explicitly Free

        # 2. Campaign & App
        campaign = Campaign.objects.create(company=free_profile, title="Free Camp", budget=100, status=Campaign.Status.OPEN)
        app = Application.objects.create(campaign=campaign, club=self.club_profile, message="Msg")

        # 3. Try to award (Should Fail)
        self.client.force_authenticate(user=free_user)
        award_url = reverse('award_application', kwargs={'application_id': app.id})
        response = self.client.post(award_url)
        self.assertEqual(response.status_code, status.HTTP_402_PAYMENT_REQUIRED)

        # 4. Pay logic (Simulate Transaction)
        Transaction.objects.create(
            company=free_profile,
            related_campaign=campaign,
            transaction_type=Transaction.Type.FINDERS_FEE,
            status=Transaction.Status.SUCCESS,
            amount=100.00
        )

        # 5. Try to award again (Should Success)
        response = self.client.post(award_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_complete_campaign(self):
        # Setup awarded campaign
        campaign = Campaign.objects.create(
            company=self.company_profile,
            title="Completed Camp",
            budget=500,
            status=Campaign.Status.IN_PROGRESS
        )
        Application.objects.create(
            campaign=campaign,
            club=self.club_profile,
            status=Application.Status.AWARDED,
            message="Winning msg"
        )
        
        self.client.force_authenticate(user=self.club_user)
        url = reverse('campaign_complete', kwargs={'campaign_id': campaign.id})
        
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('report_url', response.data)
        
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, Campaign.Status.COMPLETED)
        self.assertTrue(Report.objects.filter(campaign=campaign).exists())
