from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign
from users.models import ClubProfile, CompanyProfile, ShadowUser, StudentProfile, SystemLog, User

STRONG = 'Blue-Kettle-Run-88'


def make_user(email, role, **extra):
    return User.objects.create_user(username=email, email=email, password=STRONG, role=role, **extra)


class AdminUserDetailTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='ops@unipact.my', email='ops@unipact.my', password=STRONG, role=User.Role.ADMIN)
        self.student_user = make_user('aina@siswa.my', User.Role.STUDENT)
        self.student = StudentProfile.objects.create(
            user=self.student_user, full_name='AINA BINTI AHMAD', university='Other Institution', major='Computer Science',
            skills=['React', 'Django'], bio='Final-year student.', secondary_email='aina@gmail.com',
            bank_name='Maybank', bank_account_number='514012345678', bank_account_holder_name='Aina Binti Ahmad',
        )
        self.company_user = make_user('hr@megacorp.my', User.Role.COMPANY, email_verified=True)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='MegaCorp', company_details='202001012345')
        self.campaign = Campaign.objects.create(company=self.company, title='Data Pipeline', budget=8000, status=Campaign.Status.IN_PROGRESS)
        self.campaign.assigned_students.add(self.student)
        self.client.force_authenticate(self.admin)

    def url(self, user):
        return reverse('admin_user_detail', kwargs={'user_id': user.id})

    # --- reading -------------------------------------------------------
    def test_admin_sees_everything_a_student_entered(self):
        data = self.client.get(self.url(self.student_user)).data

        self.assertEqual((data['email'], data['role'], data['name']), ('aina@siswa.my', 'STUDENT', 'AINA BINTI AHMAD'))
        self.assertEqual((data['entity_type'], data['entity_id']), ('STUDENT', self.student.id))
        self.assertEqual(data['verification_status'], 'PENDING_VERIFICATION')
        self.assertFalse(data['email_verified'])
        self.assertTrue(data['is_active'])
        profile = data['profile']
        self.assertEqual((profile['major'], profile['skills'], profile['bio']), ('Computer Science', ['React', 'Django'], 'Final-year student.'))
        self.assertEqual((profile['secondary_email'], profile['bank_account_number']), ('aina@gmail.com', '514012345678'))
        self.assertEqual([p['title'] for p in data['projects']], ['Data Pipeline'])
        self.assertEqual(data['agreements'][0]['agreement'], 'TALENT')

    def test_admin_sees_a_company_with_its_projects(self):
        data = self.client.get(self.url(self.company_user)).data

        self.assertEqual((data['entity_type'], data['entity_id']), ('COMPANY', self.company.id))
        self.assertEqual((data['profile']['company_name'], data['profile']['company_details']), ('MegaCorp', '202001012345'))
        self.assertTrue(data['email_verified'])
        self.assertEqual(data['projects'][0]['status'], 'IN_PROGRESS')

    def test_club_accounts_still_open(self):
        club_user = make_user('club@um.my', User.Role.CLUB)
        club = ClubProfile.objects.create(user=club_user, club_name='Robotics Society', university='UM')
        member = make_user('member@um.my', User.Role.CLUB, first_name='Siti')
        ShadowUser.objects.create(email='member@um.my', role='Treasurer', invited_by=club, user=member, token='t' * 64, is_claimed=True)

        owner = self.client.get(self.url(club_user)).data
        self.assertEqual((owner['entity_type'], owner['profile']['club_name']), ('CLUB', 'Robotics Society'))

        # A committee member has no profile of their own: nothing to verify or edit
        joined = self.client.get(self.url(member)).data
        self.assertIsNone(joined['profile'])
        self.assertIsNone(joined['entity_type'])
        self.assertEqual(joined['club_membership']['club_name'], 'Robotics Society')
        self.assertEqual(self.client.patch(self.url(member), {'club_name': 'X'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_admins_can_open_or_edit_someone(self):
        for outsider in (self.company_user, self.student_user):
            self.client.force_authenticate(outsider)
            self.assertEqual(self.client.get(self.url(self.student_user)).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.client.patch(self.url(self.student_user), {'full_name': 'Hacked'}, format='json').status_code,
                             status.HTTP_403_FORBIDDEN)
        self.student.refresh_from_db()
        self.assertEqual(self.student.full_name, 'AINA BINTI AHMAD')

    def test_admin_accounts_are_not_reachable_here(self):
        self.assertEqual(self.client.get(self.url(self.admin)).status_code, status.HTTP_404_NOT_FOUND)

    # --- editing -------------------------------------------------------
    def test_admin_corrects_a_students_details(self):
        res = self.client.patch(self.url(self.student_user), {
            'full_name': 'Aina binti Ahmad', 'university': 'Universiti Malaya (UM)', 'major': 'Computer Science',
            'skills': ['React', 'Django', 'React'], 'secondary_email': 'aina@gmail.com',
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual((res.data['name'], res.data['profile']['university']), ('Aina binti Ahmad', 'Universiti Malaya (UM)'))
        self.student_user.refresh_from_db()
        self.assertEqual(self.student_user.first_name, 'Aina binti Ahmad')
        # Only what actually changed is recorded, and who changed it
        log = SystemLog.objects.filter(message__startswith='Admin ops@unipact.my edited aina@siswa.my').get()
        self.assertTrue(log.message.endswith(': full_name, university'))

    def test_saving_without_changes_records_nothing(self):
        res = self.client.patch(self.url(self.student_user), {'full_name': 'AINA BINTI AHMAD', 'club_affiliation_name': ''}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(SystemLog.objects.filter(message__contains='edited').exists())

    def test_admin_cannot_change_bank_details_email_or_verification(self):
        self.client.patch(self.url(self.student_user), {
            'bank_account_number': '999', 'bank_name': 'Other Bank', 'email': 'new@siswa.my',
            'verification_status': 'VERIFIED', 'rating': '1.0',
        }, format='json')

        self.student.refresh_from_db()
        self.student_user.refresh_from_db()
        self.assertEqual((self.student.bank_account_number, self.student.bank_name), ('514012345678', 'Maybank'))
        self.assertEqual(self.student_user.email, 'aina@siswa.my')
        self.assertEqual(self.student.verification_status, 'PENDING_VERIFICATION')

    def test_a_name_cannot_be_blanked(self):
        res = self.client.patch(self.url(self.company_user), {'company_name': ''}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.company.refresh_from_db()
        self.assertEqual(self.company.company_name, 'MegaCorp')

    def test_admin_corrects_a_companys_details(self):
        res = self.client.patch(self.url(self.company_user), {'company_name': 'MegaCorp Sdn Bhd', 'company_details': '202001012345'}, format='json')
        self.assertEqual(res.data['profile']['company_name'], 'MegaCorp Sdn Bhd')
        self.assertEqual(res.data['name'], 'MegaCorp Sdn Bhd')


class AdminQueueAndFeedTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='ops@unipact.my', email='ops@unipact.my', password=STRONG, role=User.Role.ADMIN)

    def test_every_queue_entry_says_which_account_to_open(self):
        student_user = make_user('aina@siswa.my', User.Role.STUDENT)
        StudentProfile.objects.create(user=student_user, full_name='Aina', university='UM')
        company_user = make_user('hr@megacorp.my', User.Role.COMPANY)
        CompanyProfile.objects.create(user=company_user, company_name='MegaCorp')
        club_user = make_user('club@um.my', User.Role.CLUB)
        ClubProfile.objects.create(user=club_user, club_name='Robotics Society', university='UM')

        self.client.force_authenticate(self.admin)
        queue = self.client.get(reverse('admin_queue')).data
        self.assertEqual({(q['type'], q['user_id']) for q in queue},
                         {('STUDENT', student_user.id), ('COMPANY', company_user.id), ('CLUB', club_user.id)})

    def test_activity_feed_leaves_out_successful_sign_ins(self):
        make_user('aina@siswa.my', User.Role.STUDENT)
        self.client.post(reverse('login'), {'email': 'aina@siswa.my', 'password': STRONG}, format='json')
        self.client.post(reverse('login'), {'email': 'aina@siswa.my', 'password': 'wrong'}, format='json')
        self.client.cookies.clear()
        # Still recorded, just not shown
        self.assertTrue(SystemLog.objects.filter(message='User Login: aina@siswa.my').exists())

        self.client.force_authenticate(self.admin)
        messages = [log['message'] for log in self.client.get(reverse('admin_logs')).data]
        self.assertNotIn('User Login: aina@siswa.my', messages)
        self.assertIn('Failed Login: aina@siswa.my', messages)
