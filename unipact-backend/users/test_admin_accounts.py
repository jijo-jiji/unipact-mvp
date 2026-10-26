from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users import agreements
from users.models import CompanyProfile, StudentProfile, SystemLog, User
from users.utils import make_invitation_token

STRONG = 'Blue-Kettle-Run-88'


def invite_token(message):
    """The token in the "Set your password" link of an invitation email."""
    link = next(word for word in message.body.split() if '/welcome?token=' in word)
    return parse_qs(urlparse(link).query)['token'][0]


class AdminCreateAccountTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='ops@unipact.my', email='ops@unipact.my', password=STRONG, role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)
        self.url = reverse('admin_create_account')

    def create(self, **data):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.url, data, format='json')

    def test_admin_creates_a_student_who_is_emailed_a_link_to_set_a_password(self):
        res = self.create(role='STUDENT', email='Aina@Siswa.my', full_name='Aina Sofea', university='Universiti Kuala Lumpur (UniKL)',
                          major='Software Engineering', domain_focus='BOTH', skills='React, Django')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        user = User.objects.get(email='aina@siswa.my')
        self.assertEqual((user.role, user.first_name), ('STUDENT', 'Aina Sofea'))
        self.assertFalse(user.has_usable_password(), 'the admin must never know the password')
        self.assertFalse(user.email_verified)
        self.assertIsNone(user.terms_accepted_at, 'they accept the terms themselves, from the link')
        profile = user.student_profile
        self.assertEqual((profile.university, profile.major, profile.domain_focus, profile.skills),
                         ('Universiti Kuala Lumpur (UniKL)', 'Software Engineering', 'BOTH', ['React', 'Django']))
        self.assertEqual(profile.verification_status, 'VERIFIED')
        self.assertTrue(user.is_verified)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['aina@siswa.my'])
        self.assertIn('Your UniPact account is ready', mail.outbox[0].subject)
        self.assertIn('/welcome?token=', mail.outbox[0].body)
        self.assertTrue(SystemLog.objects.filter(message__contains='created a student account: Aina Sofea').exists())

    def test_admin_creates_a_company(self):
        res = self.create(role='COMPANY', email='ops@kedai.my', company_name='Kedai Kopi Sdn Bhd', company_details='202401099999')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        company = CompanyProfile.objects.get(user__email='ops@kedai.my')
        self.assertEqual((company.company_name, company.company_details, company.verification_status),
                         ('Kedai Kopi Sdn Bhd', '202401099999', 'VERIFIED'))
        self.assertEqual(len(mail.outbox), 1)

    def test_unverified_accounts_go_to_the_review_queue_as_sign_up_would(self):
        self.create(role='STUDENT', email='hakim@utm.my', full_name='Hakim', university='UTM', verified=False)
        self.create(role='COMPANY', email='boss@gmail.com', company_name='Gmail Co', verified=False)
        self.create(role='COMPANY', email='boss@firm.my', company_name='Firm', verified=False)

        self.assertEqual(StudentProfile.objects.get(user__email='hakim@utm.my').verification_status, 'PENDING_VERIFICATION')
        self.assertFalse(User.objects.get(email='hakim@utm.my').is_verified)
        self.assertEqual(CompanyProfile.objects.get(company_name='Gmail Co').verification_status, 'HIGH_RISK')
        self.assertEqual(CompanyProfile.objects.get(company_name='Firm').verification_status, 'PENDING_REVIEW')

    def test_each_type_needs_its_own_details(self):
        res = self.create(role='STUDENT', email='a@b.my', full_name='  ')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(res.data), {'full_name', 'university'})

        res = self.create(role='COMPANY', email='c@d.my')
        self.assertEqual(set(res.data), {'company_name'})
        self.assertFalse(User.objects.filter(email__in=['a@b.my', 'c@d.my']).exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_an_email_that_already_has_an_account_is_refused(self):
        User.objects.create_user(username='taken@siswa.my', email='taken@siswa.my', password=STRONG, role=User.Role.STUDENT)
        res = self.create(role='COMPANY', email='TAKEN@siswa.my', company_name='Dup')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', res.data)

    def test_only_students_and_companies(self):
        for role in ('CLUB', 'ADMIN'):
            res = self.create(role=role, email=f'{role.lower()}@x.my', company_name='X', full_name='X', university='X')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, role)
        self.assertEqual(User.objects.count(), 1)

    def test_only_admins_can_create_accounts(self):
        company = User.objects.create_user(username='hr@firm.my', email='hr@firm.my', password=STRONG, role=User.Role.COMPANY)
        self.client.force_authenticate(company)
        res = self.create(role='STUDENT', email='x@y.my', full_name='X', university='UM')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        res = self.create(role='STUDENT', email='x@y.my', full_name='X', university='UM')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(User.objects.filter(email='x@y.my').exists())


class AccountInvitationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='ops@unipact.my', email='ops@unipact.my', password=STRONG, role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('admin_create_account'), {
                'role': 'STUDENT', 'email': 'aina@siswa.my', 'full_name': 'Aina Sofea', 'university': 'UM',
            }, format='json')
        self.user = User.objects.get(email='aina@siswa.my')
        self.token = invite_token(mail.outbox[0])
        self.client.force_authenticate(None)

    def accept(self, **data):
        body = {'token': self.token, 'password': STRONG, 'accept_terms': True,
                'talent_agreement_version': agreements.CURRENT_VERSIONS[agreements.TALENT]}
        body.update(data)
        return self.client.post(reverse('account_invitation_accept'), body, format='json')

    def test_the_link_greets_them_by_name(self):
        res = self.client.post(reverse('account_invitation_preview'), {'token': self.token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual((res.data['name'], res.data['email'], res.data['role']), ('Aina Sofea', 'aina@siswa.my', 'STUDENT'))

    def test_setting_a_password_finishes_the_account_and_signs_them_in(self):
        res = self.accept()

        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertIn('access_token', res.cookies)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(STRONG))
        self.assertTrue(self.user.email_verified, 'the link reached their inbox')
        self.assertIsNotNone(self.user.terms_accepted_at)
        self.assertTrue(agreements.has_accepted(self.user, agreements.TALENT))
        login = self.client.post(reverse('login'), {'email': 'aina@siswa.my', 'password': STRONG}, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_the_link_works_once(self):
        self.assertEqual(self.accept().status_code, status.HTTP_200_OK)
        res = self.accept(password='Another-Kettle-Run-99')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(STRONG))
        preview = self.client.post(reverse('account_invitation_preview'), {'token': self.token}, format='json')
        self.assertEqual(preview.status_code, status.HTTP_400_BAD_REQUEST)

    def test_terms_and_a_strong_password_are_required(self):
        self.assertIn('accept_terms', self.accept(accept_terms=False).data)
        self.assertIn('password', self.accept(password='password1').data)
        self.user.refresh_from_db()
        self.assertFalse(self.user.has_usable_password())

    @override_settings(ACCOUNT_INVITE_TIMEOUT=-1)
    def test_an_expired_link_is_refused(self):
        res = self.accept()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Forgot password', res.data['error'])

    def test_a_tampered_or_blocked_link_is_refused(self):
        self.assertEqual(self.accept(token=self.token[:-2] + 'xx').status_code, status.HTTP_400_BAD_REQUEST)
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.assertEqual(self.accept().status_code, status.HTTP_400_BAD_REQUEST)

    def test_forgot_password_sends_a_fresh_invitation_until_a_password_is_set(self):
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse('password_reset_request'), {'email': 'aina@siswa.my'}, format='json')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Your UniPact account is ready', mail.outbox[0].subject)
        self.assertEqual(self.client.post(reverse('account_invitation_accept'), {
            'token': invite_token(mail.outbox[0]), 'password': STRONG, 'accept_terms': True}, format='json').status_code, status.HTTP_200_OK)

    def test_admin_can_resend_until_the_password_is_set(self):
        self.client.force_authenticate(self.admin)
        url = reverse('admin_resend_invitation', kwargs={'user_id': self.user.id})
        detail = self.client.get(reverse('admin_user_detail', kwargs={'user_id': self.user.id})).data
        self.assertTrue(detail['invitation_pending'])

        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        self.client.force_authenticate(None)
        self.accept()
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(url).status_code, status.HTTP_400_BAD_REQUEST)
        detail = self.client.get(reverse('admin_user_detail', kwargs={'user_id': self.user.id})).data
        self.assertFalse(detail['invitation_pending'])

    def test_a_token_made_for_an_account_with_a_password_is_refused(self):
        company = User.objects.create_user(username='hr@firm.my', email='hr@firm.my', password=STRONG, role=User.Role.COMPANY)
        res = self.client.post(reverse('account_invitation_accept'), {
            'token': make_invitation_token(company), 'password': 'Taken-Over-Pass-77', 'accept_terms': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        company.refresh_from_db()
        self.assertTrue(company.check_password(STRONG))


class AdminUserListByTypeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='ops@unipact.my', email='ops@unipact.my', password=STRONG, role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)
        for i, role in enumerate(['STUDENT', 'STUDENT', 'COMPANY', 'CLUB']):
            User.objects.create_user(username=f'u{i}@x.my', email=f'u{i}@x.my', password=STRONG, role=role)
        User.objects.create_user(username='aina@x.my', email='aina@x.my', password=None, role='STUDENT')

    def test_counts_for_each_type_follow_the_search(self):
        data = self.client.get(reverse('admin_entities'), {'role': 'STUDENT'}).data
        self.assertEqual(data['counts'], {'STUDENT': 3, 'COMPANY': 1, 'CLUB': 1})
        self.assertEqual(data['count'], 3)
        self.assertEqual(self.client.get(reverse('admin_entities'), {'search': 'aina'}).data['counts'],
                         {'STUDENT': 1, 'COMPANY': 0, 'CLUB': 0})

    def test_accounts_still_waiting_for_a_password_are_marked(self):
        rows = {r['email']: r['invited'] for r in self.client.get(reverse('admin_entities'), {'role': 'STUDENT'}).data['results']}
        self.assertEqual(rows, {'u0@x.my': False, 'u1@x.my': False, 'aina@x.my': True})
