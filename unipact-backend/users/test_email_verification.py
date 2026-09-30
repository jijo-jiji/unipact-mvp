import re
from urllib.parse import unquote

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign, MatchOffer
from users.models import User, CompanyProfile, StudentProfile
from users.utils import make_email_verification_token, read_email_verification_token

STRONG = 'Blue-Kettle-Run-88'


class EmailVerificationTokenTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='sam@siswa.my', email='sam@siswa.my', password=STRONG, role=User.Role.STUDENT)

    def test_a_fresh_token_names_its_owner(self):
        self.assertEqual(read_email_verification_token(make_email_verification_token(self.user)), self.user)

    def test_a_tampered_token_is_refused(self):
        self.assertIsNone(read_email_verification_token(make_email_verification_token(self.user) + 'x'))
        self.assertIsNone(read_email_verification_token('not-a-token'))

    def test_an_expired_token_is_refused(self):
        token = make_email_verification_token(self.user)
        self.assertIsNone(read_email_verification_token(token, max_age=-1))

    def test_changing_the_address_kills_old_links(self):
        """A link proves someone reads a particular inbox, so it must not survive a change of address."""
        token = make_email_verification_token(self.user)
        self.user.email = 'someone.else@siswa.my'
        self.user.save(update_fields=['email'])
        self.assertIsNone(read_email_verification_token(token))

    def test_a_blocked_account_cannot_confirm(self):
        token = make_email_verification_token(self.user)
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.assertIsNone(read_email_verification_token(token))


class EmailVerificationEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='sam@siswa.my', email='sam@siswa.my', password=STRONG, role=User.Role.STUDENT)
        self.verify_url = reverse('verify_email')
        self.resend_url = reverse('resend_verify_email')

    def test_signing_up_emails_a_confirmation_link(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('register_student'), {
                'email': 'newbie@siswa.my', 'password': STRONG, 'full_name': 'Newbie',
                'university': 'UM', 'accept_terms': 'true',
            }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        created = User.objects.get(email='newbie@siswa.my')
        self.assertFalse(created.email_verified)

        welcome = next(m for m in mail.outbox if m.to == ['newbie@siswa.my'])
        self.assertIn('/verify-email?token=', welcome.body)

    def test_a_valid_link_confirms_the_address(self):
        res = self.client.post(self.verify_url, {'token': make_email_verification_token(self.user)}, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_clicking_the_same_link_twice_still_reads_as_confirmed(self):
        token = make_email_verification_token(self.user)
        self.client.post(self.verify_url, {'token': token}, format='json')
        again = self.client.post(self.verify_url, {'token': token}, format='json')

        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_a_bad_link_says_so_without_confirming_anything(self):
        res = self.client.post(self.verify_url, {'token': 'rubbish'}, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    def test_resend_sends_a_working_link(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(self.resend_url, {'email': 'sam@siswa.my'}, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        sent = next(m for m in mail.outbox if m.to == ['sam@siswa.my'])
        # The link carries the token percent-encoded; a browser hands the decoded value to the page.
        token = unquote(re.search(r'/verify-email\?token=(\S+)', sent.body).group(1).rstrip('.,)'))
        self.assertEqual(read_email_verification_token(token), self.user)

        confirmed = self.client.post(self.verify_url, {'token': token}, format='json')
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_resend_says_the_same_thing_for_an_unknown_address(self):
        """Otherwise the reply tells a stranger which addresses have accounts."""
        with self.captureOnCommitCallbacks(execute=True):
            known = self.client.post(self.resend_url, {'email': 'sam@siswa.my'}, format='json')
        mail.outbox.clear()

        with self.captureOnCommitCallbacks(execute=True):
            unknown = self.client.post(self.resend_url, {'email': 'nobody@siswa.my'}, format='json')

        self.assertEqual(known.data, unknown.data)
        self.assertEqual(mail.outbox, [])

    def test_resend_does_nothing_once_the_address_is_confirmed(self):
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified'])

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(self.resend_url, {'email': 'sam@siswa.my'}, format='json')

        self.assertEqual(mail.outbox, [])


@override_settings(REST_FRAMEWORK={'DEFAULT_THROTTLE_RATES': {}})
class UnconfirmedAccountTests(APITestCase):
    def setUp(self):
        self.company_user = User.objects.create_user(
            username='boss@corp.com', email='boss@corp.com', password=STRONG, role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(
            user=self.company_user, company_name='Corp', verification_status='VERIFIED')

        self.student_user = User.objects.create_user(
            username='sam@siswa.my', email='sam@siswa.my', password=STRONG, role=User.Role.STUDENT)
        self.student = StudentProfile.objects.create(
            user=self.student_user, full_name='Sam', university='UM', verification_status='VERIFIED')

    def post_project(self):
        return self.client.post(reverse('campaign_list_create'), {
            'title': 'Site rebuild', 'description': 'A new marketing site.',
            'type': Campaign.Type.TALENT_BOUNTY, 'budget': '3000.00',
        }, format='json')

    def test_an_unconfirmed_client_cannot_post_a_project(self):
        self.client.force_authenticate(user=self.company_user)
        blocked = self.post_project()

        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('confirm your email', str(blocked.data).lower())
        self.assertEqual(Campaign.objects.count(), 0)

    def test_confirming_lets_the_client_post(self):
        self.company_user.email_verified = True
        self.company_user.save(update_fields=['email_verified'])

        self.client.force_authenticate(user=self.company_user)
        self.assertEqual(self.post_project().status_code, status.HTTP_201_CREATED)

    def test_an_unconfirmed_student_cannot_accept_an_offer(self):
        campaign = Campaign.objects.create(
            company=self.company, title='Pipeline', budget=2000, status=Campaign.Status.MATCHED)
        campaign.assigned_students.add(self.student)
        offer = MatchOffer.objects.create(campaign=campaign, student=self.student)

        self.client.force_authenticate(user=self.student_user)
        blocked = self.client.post(reverse('respond_match_offer', kwargs={'campaign_id': campaign.id}),
                                   {'action': 'accept'}, format='json')

        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        offer.refresh_from_db()
        self.assertEqual(offer.status, MatchOffer.Status.PENDING)

    def test_an_unconfirmed_student_may_still_decline(self):
        """Declining frees the project for someone else, so there is no reason to hold it up."""
        campaign = Campaign.objects.create(
            company=self.company, title='Pipeline', budget=2000, status=Campaign.Status.MATCHED)
        campaign.assigned_students.add(self.student)
        offer = MatchOffer.objects.create(campaign=campaign, student=self.student)

        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(reverse('respond_match_offer', kwargs={'campaign_id': campaign.id}),
                               {'action': 'decline'}, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        offer.refresh_from_db()
        self.assertEqual(offer.status, MatchOffer.Status.DECLINED)

    def test_the_account_endpoint_reports_the_state(self):
        self.client.force_authenticate(user=self.student_user)
        self.assertFalse(self.client.get(reverse('me')).data['email_verified'])

        self.student_user.email_verified = True
        self.student_user.save(update_fields=['email_verified'])
        self.assertTrue(self.client.get(reverse('me')).data['email_verified'])
