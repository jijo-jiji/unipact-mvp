import re
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign, ImpactLedger, ProjectImpactReport
from payments.models import Payout
from users.models import User, CompanyProfile, StudentProfile

PNG = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\n\x00\x00\x00\n\x08\x02\x00\x00\x00\x02PX\xea\x00\x00\x00'
       b'\x13IDATx\x9cc\xfc\xcf\x80\x0f0\xe1\x95e\x18\xa9\xd2\x00A,\x01\x13y\xed\xba&\x00\x00\x00\x00IEND\xaeB`\x82')

SIGNED_STATEMENT = {
    'business_pain_point': '44 agents typed WhatsApp scripts by hand and sorted broken numbers in Excel.',
    'client_industry': 'Financial & Credit',
    'metrics': [{'value': '14 Hrs', 'label': 'Saved per agent / week'}, {'value': 'RM 2,500', 'label': 'Annual CRM subscription saved'}],
    'verified_skills': ['Frontend Web Development', 'Database Management'],
    'testimonial': 'The system filters bad data before agents even make a call.',
    'signer_name': 'Mohd Faizal bin Mohd Zahari',
    'signer_title': 'Loan Consultant',
    'sign': True,
    'signature': 'mohd faizal  bin mohd zahari',  # case/spacing differences still count as the same name
}


def make_student(email, name):
    user = User.objects.create_user(username=email, email=email, password='StudentPass123!', role=User.Role.STUDENT, is_verified=True)
    return user, StudentProfile.objects.create(user=user, full_name=name, university='UM', major='BSc. Computer Science', verification_status='VERIFIED')


class ImpactLedgerTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password='AdminPass123!', role=User.Role.ADMIN)
        self.company_user = User.objects.create_user(username='co@x.com', email='co@x.com', password='CoPass123!', role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='FZS Success', verification_status='VERIFIED')
        self.other_co_user = User.objects.create_user(username='other@x.com', email='other@x.com', password='CoPass123!', role=User.Role.COMPANY)
        CompanyProfile.objects.create(user=self.other_co_user, company_name='Other Co', verification_status='VERIFIED')
        self.adam_user, self.adam = make_student('adam@x.my', 'Adam Haikal')
        self.outsider_user, _ = make_student('out@x.my', 'Outsider')
        self.campaign = self.make_project('Loan Manager')

    def make_project(self, title):
        campaign = Campaign.objects.create(
            company=self.company, title=title, description='d', type='SOFTWARE_DEVELOPMENT', budget=Decimal('555.56'),
            status=Campaign.Status.IN_PROGRESS, is_match_finalized=True, required_skills=['React', 'Django'],
        )
        campaign.assigned_students.add(self.adam)
        return campaign

    def complete(self, campaign, rating, feedback=''):
        self.client.force_authenticate(self.company_user)
        return self.client.post(reverse('campaign_complete', kwargs={'campaign_id': campaign.id}), {'rating': rating, 'feedback': feedback}, format='json')

    def ledger(self):
        return ImpactLedger.objects.get(campaign=self.campaign, student=self.adam)

    def sign_statement(self):
        self.client.force_authenticate(self.company_user)
        return self.client.put(reverse('impact_report', kwargs={'campaign_id': self.campaign.id}), SIGNED_STATEMENT, format='json')

    def submit_student_part(self):
        self.client.force_authenticate(self.adam_user)
        return self.client.put(reverse('my_impact_ledger', kwargs={'campaign_id': self.campaign.id}), {
            'role': 'Solo Full-Stack Developer',
            'technical_solution': 'Built a dashboard that scrubs broken numbers and sends 1-click WhatsApp pitches.',
            'proof_url': 'https://github.com/DwZukii/Loan-Manager',
            'after_image': SimpleUploadedFile('after.png', PNG, content_type='image/png'),
            'after_caption': '1-Click Clean CRM Dashboard',
            'submit': 'true',
        }, format='multipart')

    def pay_out(self):
        return Payout.objects.create(campaign=self.campaign, student=self.adam, amount=Decimal('500.00'), status=Payout.Status.PAID)

    def publish(self):
        self.client.force_authenticate(self.admin)
        return self.client.post(reverse('admin_impact_ledger_action', kwargs={'slug': self.ledger().slug, 'action': 'publish'}))

    def test_completion_keeps_feedback_creates_ledgers_and_averages_rating(self):
        self.assertEqual(self.complete(self.campaign, 4, 'Great work').status_code, status.HTTP_200_OK)
        self.campaign.refresh_from_db()
        self.assertIsNotNone(self.campaign.completed_at)
        report = ProjectImpactReport.objects.get(campaign=self.campaign)
        self.assertEqual((report.client_rating, report.testimonial), (4, 'Great work'))
        self.assertRegex(self.ledger().slug, r'^UP-\d{3}-[a-z2-9]{6}$')

        self.complete(self.make_project('Second'), 2)
        self.adam.refresh_from_db()
        self.assertEqual(self.adam.rating, Decimal('3.00'))  # averaged across projects, not overwritten by the latest

    def test_only_the_owning_company_writes_the_statement_and_signing_needs_consent(self):
        self.complete(self.campaign, 5)
        url = reverse('impact_report', kwargs={'campaign_id': self.campaign.id})
        for user in (self.adam_user, self.other_co_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.put(url, SIGNED_STATEMENT, format='json').status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.company_user)
        self.assertEqual(self.client.put(url, {'sign': True, 'signature': 'x'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.put(url, {**SIGNED_STATEMENT, 'signature': 'Someone Else'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.put(url, {**SIGNED_STATEMENT, 'metrics': [{'value': '14 Hrs'}]}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        signed = self.sign_statement()
        self.assertEqual(signed.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(signed.data['signed_at'])
        # Changing the words afterwards without re-signing leaves an unsigned draft
        edited = self.client.put(url, {'testimonial': 'Changed my mind'}, format='json')
        self.assertIsNone(edited.data['signed_at'])

    def test_student_part_validates_images_and_is_limited_to_the_team(self):
        self.complete(self.campaign, 5)
        url = reverse('my_impact_ledger', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(self.outsider_user)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.adam_user)
        self.assertEqual(self.client.get(url).data['prefill']['role'], 'Solo Contributor')
        bad = self.client.put(url, {'before_image': SimpleUploadedFile('x.txt', b'hi', content_type='text/plain')}, format='multipart')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.put(url, {'submit': 'true'}, format='multipart').status_code, status.HTTP_400_BAD_REQUEST)

        ok = self.submit_student_part()
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(self.ledger().student_submitted_at)
        self.assertTrue(ok.data['after_image'])

    def test_publish_requires_signature_submission_and_released_escrow(self):
        self.complete(self.campaign, 5)
        self.client.force_authenticate(self.company_user)
        forbidden = self.client.post(reverse('admin_impact_ledger_action', kwargs={'slug': self.ledger().slug, 'action': 'publish'}))
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.assertEqual(self.publish().status_code, status.HTTP_400_BAD_REQUEST)
        self.sign_statement()
        self.submit_student_part()
        not_paid = self.publish()
        self.assertEqual(not_paid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(not_paid.data['readiness']['escrow_released'])

        self.pay_out()
        self.assertEqual(self.publish().status_code, status.HTTP_200_OK)
        self.assertEqual(self.ledger().status, ImpactLedger.Status.PUBLISHED)

        # Published words are locked for both the client and the student
        self.assertEqual(self.sign_statement().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.submit_student_part().status_code, status.HTTP_400_BAD_REQUEST)

    def test_drafts_are_private_and_published_ledgers_are_public(self):
        self.complete(self.campaign, 5)
        url = reverse('impact_ledger_detail', kwargs={'slug': self.ledger().slug})
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        for user in (self.adam_user, self.company_user, self.admin):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)
        self.client.force_authenticate(self.outsider_user)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

        self.sign_statement()
        self.submit_student_part()
        self.pay_out()
        self.publish()
        self.client.force_authenticate(None)
        public = self.client.get(url)
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(public.data['bounty_value'])), Decimal('500.00'))
        self.assertEqual(public.data['testimonial']['signer_name'], 'Mohd Faizal bin Mohd Zahari')
        self.assertEqual(public.data['student']['role'], 'Solo Full-Stack Developer')
        self.assertEqual(self.client.get(reverse('impact_ledger_detail', kwargs={'slug': 'UP-001-aaaaaa'})).status_code, status.HTTP_404_NOT_FOUND)

    def test_portfolio_links_only_published_ledgers(self):
        self.complete(self.campaign, 5)
        portfolio_url = reverse('student_public_profile', kwargs={'user_id': self.adam_user.id})
        self.assertIsNone(self.client.get(portfolio_url).data['completed_projects'][0]['ledger_slug'])

        self.sign_statement()
        self.submit_student_part()
        self.pay_out()
        self.publish()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(portfolio_url).data['completed_projects'][0]['ledger_slug'], self.ledger().slug)
