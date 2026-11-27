from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import CompanyProfile, User

from .models import CampusRole as R
from .models import PilotAccess
from .tests import MiitTreeMixin, appoint, make_user


@override_settings(CAMPUS_ENABLED=True, CAMPUS_PILOT_ONLY=True)
class PilotModeTests(MiitTreeMixin, APITestCase):
    """A closed pilot: Campus exists only for admins, staff, role holders and listed students."""

    def setUp(self):
        self.build_tree()
        self.sdcl = make_user('sdcl@unikl.edu.my', User.Role.STAFF, 'SDCL Officer')
        appoint(self.sdcl, R.CAMPUS_ADMIN, self.miit)
        self.listed = make_user('listed@s.unikl.edu.my', User.Role.STUDENT, 'Listed Student')
        PilotAccess.objects.create(campus=self.miit, email='LISTED@s.unikl.edu.my')
        self.stranger = make_user('stranger@gmail.com', User.Role.STUDENT, 'Other Student')
        self.company = User.objects.create_user(username='hr@firm.my', email='hr@firm.my', password='x-Pass-2026',
                                                role=User.Role.COMPANY)
        CompanyProfile.objects.create(user=self.company, company_name='Firm')

    def status_for(self, user, name='campus_clubs'):
        self.client.force_authenticate(user)
        return self.client.get(reverse(name)).status_code

    def test_only_pilot_people_see_campus_at_all(self):
        self.assertEqual(self.status_for(self.listed), status.HTTP_200_OK)
        self.assertEqual(self.status_for(self.sdcl), status.HTTP_200_OK)
        for outsider in (self.stranger, self.company, None):
            self.assertEqual(self.status_for(outsider), status.HTTP_404_NOT_FOUND)
            self.assertEqual(self.status_for(outsider, 'campus_news'), status.HTTP_404_NOT_FOUND)
            self.assertEqual(self.status_for(outsider, 'campus_campuses'), status.HTTP_404_NOT_FOUND)

    def test_holding_a_role_lets_a_student_in(self):
        appoint(self.stranger, R.MEMBER, self.robotics)
        self.assertEqual(self.status_for(self.stranger), status.HTTP_200_OK)

    def test_the_menu_flag_follows_access(self):
        self.client.force_authenticate(self.listed)
        self.assertTrue(self.client.get(reverse('me')).data['campus_enabled'])
        self.client.force_authenticate(self.stranger)
        self.assertFalse(self.client.get(reverse('me')).data['campus_enabled'])
        self.client.force_authenticate(self.company)
        self.assertFalse(self.client.get(reverse('me')).data['campus_enabled'])

    @override_settings(CAMPUS_PILOT_ONLY=False)
    def test_turning_pilot_mode_off_opens_campus(self):
        self.assertEqual(self.status_for(self.stranger), status.HTTP_200_OK)
        self.assertEqual(self.status_for(None), status.HTTP_200_OK)  # the directory is public again

    def test_sdcl_adds_students_and_they_are_emailed(self):
        self.client.force_authenticate(self.sdcl)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('campus_pilot'), {
                'campus': self.miit.pk,
                'emails': 'Stranger@gmail.com, new.student@s.unikl.edu.my\nlisted@s.unikl.edu.my  hr@firm.my'},
                format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['added'], ['stranger@gmail.com', 'new.student@s.unikl.edu.my'])
        self.assertEqual(res.data['already_listed'], ['listed@s.unikl.edu.my'])
        self.assertEqual(res.data['not_student_accounts'], ['hr@firm.my'])
        sent = {m.to[0]: m.body for m in mail.outbox}
        self.assertIn('Sign in to UniPact', sent['stranger@gmail.com'])
        self.assertIn('Sign up as a student', sent['new.student@s.unikl.edu.my'])
        self.assertEqual(self.status_for(self.stranger), status.HTTP_200_OK)

        self.client.force_authenticate(self.sdcl)
        listed = self.client.get(reverse('campus_pilot'), {'campus': self.miit.pk}).data
        self.assertEqual({r['email']: r['signed_up'] for r in listed},
                         {'listed@s.unikl.edu.my': True, 'stranger@gmail.com': True,
                          'new.student@s.unikl.edu.my': False})

        row = next(r for r in listed if r['email'] == 'stranger@gmail.com')
        self.assertEqual(self.client.delete(reverse('campus_pilot_detail', args=[row['id']])).status_code,
                         status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.status_for(self.stranger), status.HTTP_404_NOT_FOUND)

    def test_bad_emails_are_refused_and_only_campus_admins_manage_the_list(self):
        self.client.force_authenticate(self.sdcl)
        res = self.client.post(reverse('campus_pilot'), {'campus': self.miit.pk, 'emails': 'not-an-email'},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        advisor = make_user('adv@unikl.edu.my', User.Role.STAFF)
        appoint(advisor, R.ADVISOR, self.robotics)
        self.client.force_authenticate(advisor)
        self.assertEqual(self.client.get(reverse('campus_pilot'), {'campus': self.miit.pk}).status_code,
                         status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.listed)
        self.assertEqual(self.client.post(reverse('campus_pilot'), {'campus': self.miit.pk, 'emails': 'a@b.my'},
                                          format='json').status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(CAMPUS_ENABLED=False)
    def test_the_main_switch_still_wins(self):
        self.assertEqual(self.status_for(self.sdcl), status.HTTP_404_NOT_FOUND)
