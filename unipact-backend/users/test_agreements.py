from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign, MatchOffer
from users import agreements
from users.models import AgreementAcceptance, CompanyProfile, StudentProfile, User

STRONG = 'Blue-Kettle-Run-88'
TALENT_VERSION = agreements.CURRENT_VERSIONS[agreements.TALENT]
CLIENT_VERSION = agreements.CURRENT_VERSIONS[agreements.CLIENT]


@override_settings(AGREEMENTS_ENFORCED=True, MOCK_PAYMENTS_ENABLED=False)
class AgreementAcceptanceTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password=STRONG, role=User.Role.ADMIN)
        self.company_user = User.objects.create_user(username='co@x.com', email='co@x.com', password=STRONG, role=User.Role.COMPANY, email_verified=True)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='Co', verification_status='VERIFIED')
        self.student_user = User.objects.create_user(username='ali@x.my', email='ali@x.my', password=STRONG, role=User.Role.STUDENT, email_verified=True)
        self.student = StudentProfile.objects.create(user=self.student_user, full_name='Ali', university='UM', verification_status='VERIFIED')
        self.campaign = Campaign.objects.create(company=self.company, title='CRM', description='d', type='SOFTWARE_DEVELOPMENT',
                                                budget=1000, status=Campaign.Status.MATCHED)
        self.campaign.assigned_students.add(self.student)
        MatchOffer.objects.create(campaign=self.campaign, student=self.student)

    def accept(self, agreement, version):
        return self.client.post(reverse('agreement_accept'), {'agreement': agreement, 'version': version}, format='json')

    def test_student_must_accept_the_talent_agreement_before_taking_a_job(self):
        self.client.force_authenticate(self.student_user)
        offer_url = reverse('respond_match_offer', kwargs={'campaign_id': self.campaign.id})

        refused = self.client.post(offer_url, {'action': 'accept'}, format='json')
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual((refused.data['code'], refused.data['agreement'], refused.data['version']), ('agreement_required', 'TALENT', TALENT_VERSION))
        self.assertEqual(MatchOffer.objects.get(student=self.student).status, MatchOffer.Status.PENDING)

        me = self.client.get(reverse('me')).data['agreements']
        self.assertEqual((me[0]['agreement'], me[0]['accepted']), ('TALENT', False))

        # They can only accept the version they were shown, and only their own kind of agreement
        self.assertEqual(self.accept('TALENT', 'an-older-version').status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.accept('CLIENT', CLIENT_VERSION).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AgreementAcceptance.objects.exists())

        accepted = self.accept('TALENT', TALENT_VERSION)
        self.assertEqual((accepted.status_code, accepted.data[0]['accepted']), (status.HTTP_200_OK, True))
        self.assertEqual(self.accept('TALENT', TALENT_VERSION).status_code, status.HTTP_200_OK)  # accepting twice is harmless
        self.assertEqual(AgreementAcceptance.objects.filter(user=self.student_user, agreement='TALENT', version=TALENT_VERSION).count(), 1)

        self.assertEqual(self.client.post(offer_url, {'action': 'accept'}, format='json').status_code, status.HTTP_200_OK)

    def test_declining_an_offer_needs_no_agreement(self):
        self.client.force_authenticate(self.student_user)
        res = self.client.post(reverse('respond_match_offer', kwargs={'campaign_id': self.campaign.id}), {'action': 'decline', 'reason': 'Exams'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    @override_settings(TOYYIBPAY_MODE='sandbox', TOYYIBPAY_SANDBOX_SECRET_KEY='sk', TOYYIBPAY_SANDBOX_CATEGORY_CODE='cat')
    def test_client_must_accept_the_service_agreement_before_confirming_or_paying(self):
        MatchOffer.objects.update(status=MatchOffer.Status.ACCEPTED)
        self.client.force_authenticate(self.admin)
        self.client.post(reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id}), {'milestones': [{'title': 'Delivery', 'percentage': 100}]}, format='json')

        self.client.force_authenticate(self.company_user)
        finalize_url = reverse('finalize_match', kwargs={'campaign_id': self.campaign.id})
        for url, body in (
            (finalize_url, {}),
            (reverse('request_invoice', kwargs={'campaign_id': self.campaign.id}), {}),
            (reverse('toyyibpay_create_bill'), {'campaign_id': self.campaign.id, 'phone': '0123456789'}),
        ):
            refused = self.client.post(url, body, format='json')
            self.assertEqual((refused.status_code, refused.data.get('agreement')), (status.HTTP_403_FORBIDDEN, 'CLIENT'), url)

        self.assertEqual(self.accept('CLIENT', CLIENT_VERSION).status_code, status.HTTP_200_OK)
        # Past the agreement, the usual rule applies: the fee is still owed
        self.assertEqual(self.client.post(finalize_url, {}, format='json').status_code, status.HTTP_402_PAYMENT_REQUIRED)

    def test_admin_starting_a_project_is_not_asked_for_the_clients_agreement(self):
        MatchOffer.objects.update(status=MatchOffer.Status.ACCEPTED)
        self.client.force_authenticate(self.admin)
        self.client.post(reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id}), {'milestones': [{'title': 'Delivery', 'percentage': 100}]}, format='json')
        res = self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)

    def test_signing_up_through_the_current_form_records_the_talent_agreement(self):
        base = {'password': STRONG, 'full_name': 'New', 'university': 'UM', 'accept_terms': 'true'}
        self.client.post(reverse('register_student'), {**base, 'email': 'new@siswa.my', 'talent_agreement_version': TALENT_VERSION}, format='json')
        self.assertTrue(AgreementAcceptance.objects.filter(user__email='new@siswa.my', agreement='TALENT', version=TALENT_VERSION).exists())

        # A form that didn't show the current agreement records nothing; that student is asked before a first job
        self.client.post(reverse('register_student'), {**base, 'email': 'old@siswa.my'}, format='json')
        self.assertFalse(AgreementAcceptance.objects.filter(user__email='old@siswa.my').exists())

    def test_a_new_version_asks_everyone_again(self):
        agreements.record_acceptance(self.student_user, agreements.TALENT)
        self.assertTrue(agreements.has_accepted(self.student_user, agreements.TALENT))
        with self.settings():
            original = dict(agreements.CURRENT_VERSIONS)
            try:
                agreements.CURRENT_VERSIONS[agreements.TALENT] = '2026-11-01'
                self.assertFalse(agreements.has_accepted(self.student_user, agreements.TALENT))
            finally:
                agreements.CURRENT_VERSIONS.update(original)


class AgreementsOffTests(APITestCase):
    @override_settings(AGREEMENTS_ENFORCED=False)
    def test_nothing_is_blocked_when_enforcement_is_off(self):
        user = User.objects.create_user(username='s@x.my', email='s@x.my', password=STRONG, role=User.Role.STUDENT)
        agreements.require(user, agreements.TALENT)  # does not raise
