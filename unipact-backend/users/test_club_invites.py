import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User, ClubProfile, ShadowUser

STRONG = 'Blue-Kettle-Run-88'


def token_from(message):
    return re.search(r'/join-club\?token=([\w-]+)', message.body).group(1)


class ClubInviteFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.president = User.objects.create_user(username='pres@club.my', email='pres@club.my', password=STRONG, role=User.Role.CLUB)
        self.club = ClubProfile.objects.create(user=self.president, club_name='Robotics Society', university='UTM', verification_status='VERIFIED')

    def invite(self, email='aina@siswa.my', role='Treasurer'):
        self.client.force_authenticate(self.president)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(reverse('club_invite'), {'email': email, 'role': role}, format='json')
        self.client.force_authenticate(None)
        return response

    def claim(self, token, **overrides):
        data = {'token': token, 'password': STRONG, 'first_name': 'Aina', 'last_name': 'Rahman', 'accept_terms': True, **overrides}
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('user_claim_profile'), data, format='json')

    def test_full_flow_invite_email_preview_claim_and_membership(self):
        res = self.invite(email='  Aina@Siswa.my ')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('token', res.data)
        self.assertEqual(res.data['status'], 'PENDING')
        self.assertEqual(res.data['email'], 'aina@siswa.my')

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['aina@siswa.my'])
        token = token_from(mail.outbox[0])

        preview = self.client.post(reverse('user_claim_preview'), {'token': token}, format='json')
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data['club_name'], 'Robotics Society')
        self.assertEqual(preview.data['role'], 'Treasurer')

        res = self.claim(token)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertIn('access_token', res.cookies)
        membership = res.data['user']['club_membership']
        self.assertEqual(membership['club_name'], 'Robotics Society')
        self.assertEqual(membership['role'], 'Treasurer')

        member = User.objects.get(email='aina@siswa.my')
        self.assertIsNotNone(member.terms_accepted_at)
        self.assertEqual(member.get_full_name(), 'Aina Rahman')
        # The president hears about it
        self.assertEqual(mail.outbox[-1].to, ['pres@club.my'])

        # The link works once
        self.assertEqual(self.claim(token).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.post(reverse('user_claim_preview'), {'token': token}, format='json').status_code, 400)

    def test_claim_requires_consent_and_name(self):
        self.invite()
        token = token_from(mail.outbox[0])
        self.assertIn('accept_terms', self.claim(token, accept_terms=False).data)
        self.assertIn('first_name', self.claim(token, first_name='').data)
        self.assertFalse(User.objects.filter(email='aina@siswa.my').exists())

    def test_expired_invitation_is_rejected_and_resend_restores_it(self):
        self.invite()
        old_token = token_from(mail.outbox[0])
        shadow = ShadowUser.objects.get()
        ShadowUser.objects.filter(pk=shadow.pk).update(created_at=timezone.now() - timedelta(days=30))

        self.assertEqual(self.claim(old_token).status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.president)
        listed = self.client.get(reverse('club_invite'))
        self.assertEqual(listed.data[0]['status'], 'EXPIRED')
        with self.captureOnCommitCallbacks(execute=True):
            resent = self.client.post(reverse('club_invite_resend', kwargs={'pk': shadow.pk}))
        self.client.force_authenticate(None)
        self.assertEqual(resent.data['status'], 'PENDING')

        new_token = token_from(mail.outbox[-1])
        self.assertNotEqual(old_token, new_token)
        self.assertEqual(self.claim(old_token).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.claim(new_token).status_code, status.HTTP_201_CREATED)

    def test_cancel_pending_invitation(self):
        self.invite()
        shadow = ShadowUser.objects.get()
        self.client.force_authenticate(self.president)
        self.assertEqual(self.client.delete(reverse('club_invite_detail', kwargs={'pk': shadow.pk})).status_code, 204)
        self.assertFalse(ShadowUser.objects.exists())

    def test_duplicate_invites_give_clear_errors_instead_of_crashing(self):
        self.invite()
        self.assertIn('already on your committee', str(self.invite().data))

        other_user = User.objects.create_user(username='other@club.my', email='other@club.my', password=STRONG, role=User.Role.CLUB)
        ClubProfile.objects.create(user=other_user, club_name='Chess Club', university='UM')
        self.client.force_authenticate(other_user)
        res = self.client.post(reverse('club_invite'), {'email': 'aina@siswa.my', 'role': 'Member'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('another club', str(res.data))

    def test_only_the_president_manages_invitations(self):
        self.invite()
        token = token_from(mail.outbox[0])
        self.claim(token)
        member = User.objects.get(email='aina@siswa.my')
        shadow = ShadowUser.objects.get()

        other_user = User.objects.create_user(username='other@club.my', email='other@club.my', password=STRONG, role=User.Role.CLUB)
        ClubProfile.objects.create(user=other_user, club_name='Chess Club', university='UM')

        for outsider in (member, other_user):
            self.client.force_authenticate(outsider)
            if outsider is member:
                self.assertEqual(self.client.get(reverse('club_invite')).status_code, 403)
                self.assertEqual(self.client.post(reverse('club_invite'), {'email': 'x@y.my', 'role': 'Member'}, format='json').status_code, 403)
            else:
                self.assertEqual(self.client.get(reverse('club_invite')).data, [])
            self.assertIn(self.client.delete(reverse('club_invite_detail', kwargs={'pk': shadow.pk})).status_code, (403, 404))

    def test_public_roster_hides_emails_and_pending_invitations(self):
        self.invite(email='joined@siswa.my', role='Secretary')
        self.claim(token_from(mail.outbox[0]))
        self.invite(email='pending@siswa.my', role='Treasurer')
        url = reverse('club_roster', args=[self.president.id])

        outsider = User.objects.create_user(username='co@corp.my', email='co@corp.my', password=STRONG, role=User.Role.COMPANY)
        self.client.force_authenticate(outsider)
        public = self.client.get(url).data
        self.assertEqual([m['role'] for m in public], ['President', 'Secretary'])
        self.assertTrue(all(m['email'] is None for m in public))

        self.client.force_authenticate(self.president)
        private = self.client.get(url).data
        self.assertEqual(len(private), 3)
        self.assertIn('pending@siswa.my', [m['email'] for m in private])

    def test_committee_member_cannot_use_club_president_endpoints(self):
        self.invite()
        self.claim(token_from(mail.outbox[0]))
        self.client.force_authenticate(User.objects.get(email='aina@siswa.my'))
        # Used to crash with a server error because the member has no ClubProfile
        self.assertEqual(self.client.get(reverse('my_applications')).status_code, 403)
