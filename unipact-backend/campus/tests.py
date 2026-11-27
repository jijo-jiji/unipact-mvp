from datetime import timedelta

from django.core import mail
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import StudentProfile, User

from .models import CampusRole as R
from .models import OrgUnit, RoleAssignment, StaffProfile
from .permissions import Action, can, visible_units

STRONG = 'Campus-Pilot-Pass-2026'


def make_user(email, role, name=None):
    user = User.objects.create_user(username=email, email=email, password=STRONG, role=role)
    if role == User.Role.STAFF:
        StaffProfile.objects.create(user=user, full_name=name or email.split('@')[0])
    elif role == User.Role.STUDENT:
        StudentProfile.objects.create(user=user, full_name=name or email.split('@')[0], university='UniKL MIIT')
    return user


def appoint(user, role, unit, **extra):
    assignment = RoleAssignment(user=user, role=role, unit=unit, **extra)
    assignment.full_clean()
    assignment.save()
    return assignment


class MiitTreeMixin:
    """UniKL → MIIT (offices, SD and CL sections, SRC) from the seed command, plus one club in each sector."""

    def build_tree(self):
        call_command('seed_campus_miit', stdout=open('/dev/null', 'w'))
        self.uni = OrgUnit.objects.get(kind=OrgUnit.Kind.UNIVERSITY)
        self.miit = OrgUnit.objects.get(short_name='MIIT')
        self.dd_sdcl = OrgUnit.objects.get(short_name='DD SDCL')
        self.finance = OrgUnit.objects.get(short_name='HOMF')
        self.sd = OrgUnit.objects.get(short_name='SD')
        self.cl = OrgUnit.objects.get(short_name='CL')
        self.src = OrgUnit.objects.get(short_name='SRC')
        self.robotics = OrgUnit.objects.create(parent=self.sd, kind=OrgUnit.Kind.CLUB, name='Robotics Club')
        self.badminton = OrgUnit.objects.create(parent=self.cl, kind=OrgUnit.Kind.CLUB, name='Badminton Club')


class TreeTests(MiitTreeMixin, TestCase):
    def setUp(self):
        self.build_tree()

    def test_seed_builds_miit_and_can_run_twice(self):
        count = OrgUnit.objects.count()
        call_command('seed_campus_miit', stdout=open('/dev/null', 'w'))
        self.assertEqual(OrgUnit.objects.count(), count)
        self.assertEqual(self.sd.parent, self.dd_sdcl)
        self.assertEqual(self.sd.campus, self.miit)

    def test_a_club_takes_its_sections_sector(self):
        self.assertEqual(self.robotics.sector, 'SD')
        self.assertEqual(self.badminton.sector, 'CL')

    def test_lineage_runs_from_the_club_up_to_the_university(self):
        self.assertEqual(self.robotics.lineage(), [self.robotics, self.sd, self.dd_sdcl, self.miit, self.uni])

    def test_a_club_cannot_hang_directly_off_a_campus(self):
        with self.assertRaises(ValidationError):
            OrgUnit(parent=self.miit, kind=OrgUnit.Kind.CLUB, name='Loose Club').full_clean()

    def test_only_a_university_has_no_parent(self):
        with self.assertRaises(ValidationError):
            OrgUnit(kind=OrgUnit.Kind.CAMPUS, name='Orphan Campus').full_clean()


class AssignmentRuleTests(MiitTreeMixin, TestCase):
    def setUp(self):
        self.build_tree()
        self.lecturer = make_user('lecturer@unikl.edu.my', User.Role.STAFF)
        self.student = make_user('aina@s.unikl.edu.my', User.Role.STUDENT)

    def test_a_student_cannot_hold_a_staff_role(self):
        with self.assertRaises(ValidationError):
            appoint(self.student, R.ADVISOR, self.robotics)

    def test_staff_cannot_hold_a_student_role(self):
        with self.assertRaises(ValidationError):
            appoint(self.lecturer, R.COMMITTEE, self.robotics)

    def test_a_role_is_held_at_the_right_kind_of_unit(self):
        with self.assertRaises(ValidationError):
            appoint(self.lecturer, R.ADVISOR, self.sd)  # advisors advise clubs, not sections
        appoint(self.lecturer, R.ADVISOR, self.robotics)

    def test_one_person_can_hold_several_roles(self):
        appoint(self.lecturer, R.ADVISOR, self.robotics)
        appoint(self.lecturer, R.CO_ADVISOR, self.badminton)
        appoint(self.lecturer, R.GHOCS_SECRETARY, self.sd)
        self.assertEqual(RoleAssignment.objects.current().filter(user=self.lecturer).count(), 3)

    def test_ended_and_future_terms_are_not_current(self):
        today = timezone.localdate()
        appoint(self.student, R.COMMITTEE, self.robotics, position='President',
                starts_on=today - timedelta(days=200), ends_on=today - timedelta(days=1))
        appoint(self.student, R.MEMBER, self.badminton, starts_on=today + timedelta(days=10))
        ended = appoint(self.student, R.MEMBER, self.robotics)
        ended.end('Left the club')
        self.assertFalse(RoleAssignment.objects.current().filter(user=self.student).exists())
        self.assertEqual(RoleAssignment.objects.filter(user=self.student).count(), 3)  # history kept


class PermissionTests(MiitTreeMixin, TestCase):
    def setUp(self):
        self.build_tree()

    def staff(self, email, role, unit):
        user = make_user(email, User.Role.STAFF)
        appoint(user, role, unit)
        return user

    def test_an_advisor_manages_their_own_club_only(self):
        advisor = self.staff('adv@unikl.edu.my', R.ADVISOR, self.robotics)
        self.assertTrue(can(advisor, Action.ASSIGN_STUDENT_ROLES, self.robotics))
        self.assertFalse(can(advisor, Action.ASSIGN_STUDENT_ROLES, self.badminton))
        self.assertFalse(can(advisor, Action.MANAGE_UNITS, self.robotics))

    def test_a_head_of_section_covers_their_sectors_clubs(self):
        head_sd = self.staff('hos.sd@unikl.edu.my', R.HEAD_OF_SECTION, self.sd)
        self.assertTrue(can(head_sd, Action.MANAGE_UNITS, self.robotics))
        self.assertFalse(can(head_sd, Action.MANAGE_UNITS, self.badminton))

    def test_campus_wide_roles_reach_beyond_their_office(self):
        finance = self.staff('homf@unikl.edu.my', R.HEAD_FINANCE, self.finance)
        dd = self.staff('dd@unikl.edu.my', R.DEPUTY_DEAN, self.dd_sdcl)
        for user in (finance, dd):
            self.assertTrue(can(user, Action.VIEW_STRUCTURE, self.robotics))
            self.assertTrue(can(user, Action.VIEW_STRUCTURE, self.badminton))
            self.assertFalse(can(user, Action.MANAGE_UNITS, self.robotics))

    def test_a_campus_admin_does_not_reach_another_campus(self):
        admin = self.staff('sdcl@unikl.edu.my', R.CAMPUS_ADMIN, self.miit)
        msi = OrgUnit.objects.create(parent=self.uni, kind=OrgUnit.Kind.CAMPUS, name='UniKL MSI', short_name='MSI')
        self.assertTrue(can(admin, Action.MANAGE_STAFF, self.sd))
        self.assertFalse(can(admin, Action.MANAGE_STAFF, msi))

    def test_an_ended_role_gives_no_power(self):
        advisor = make_user('old.adv@unikl.edu.my', User.Role.STAFF)
        appoint(advisor, R.ADVISOR, self.robotics).end('Handed over')
        self.assertFalse(can(advisor, Action.ASSIGN_STUDENT_ROLES, self.robotics))

    def test_a_platform_admin_can_do_anything(self):
        admin = User.objects.create_user(username='ops@unipact.my', email='ops@unipact.my', password=STRONG,
                                         role=User.Role.ADMIN)
        self.assertTrue(can(admin, Action.MANAGE_UNITS, self.uni))

    def test_visible_units_are_the_subtree_of_each_scope(self):
        head_cl = self.staff('hos.cl@unikl.edu.my', R.HEAD_OF_SECTION, self.cl)
        self.assertEqual(set(visible_units(head_cl)), {self.cl, self.badminton})


@override_settings(CAMPUS_ENABLED=True, CAMPUS_PILOT_ONLY=False)
class CampusApiTests(MiitTreeMixin, APITestCase):
    def setUp(self):
        self.build_tree()
        self.sdcl = make_user('sdcl.officer@unikl.edu.my', User.Role.STAFF, 'SDCL Officer')
        appoint(self.sdcl, R.CAMPUS_ADMIN, self.miit)
        self.student = make_user('aina@s.unikl.edu.my', User.Role.STUDENT, 'Aina')

    @override_settings(CAMPUS_ENABLED=False)
    def test_everything_is_hidden_while_switched_off(self):
        self.client.force_authenticate(self.sdcl)
        self.assertEqual(self.client.get(reverse('campus_me')).status_code, status.HTTP_404_NOT_FOUND)

    def test_sign_in_is_required(self):
        self.assertIn(self.client.get(reverse('campus_me')).status_code,
                      (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_me_lists_my_current_roles_with_their_campus(self):
        appoint(self.student, R.COMMITTEE, self.robotics, position='President', session='2026/2027 Sem 1')
        self.client.force_authenticate(self.student)
        data = self.client.get(reverse('campus_me')).data
        self.assertEqual(len(data['assignments']), 1)
        role = data['assignments'][0]
        self.assertEqual((role['role'], role['position'], role['unit']['name'], role['campus']['short_name']),
                         ('COMMITTEE', 'President', 'Robotics Club', 'MIIT'))
        self.assertFalse(data['can_manage_structure'])

    def test_a_campus_admin_sees_and_extends_the_tree(self):
        self.client.force_authenticate(self.sdcl)
        names = {unit['name'] for unit in self.client.get(reverse('campus_units')).data}
        self.assertIn('Robotics Club', names)
        self.assertNotIn('Universiti Kuala Lumpur', names)  # above their campus
        res = self.client.post(reverse('campus_units'), {'parent': self.sd.pk, 'kind': 'CLUB',
                                                         'name': 'Software Engineering Club'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['sector'], 'SD')

    def test_a_student_cannot_add_units(self):
        self.client.force_authenticate(self.student)
        res = self.client.post(reverse('campus_units'), {'parent': self.sd.pk, 'kind': 'CLUB', 'name': 'X Club'},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_inviting_staff_creates_an_account_and_emails_a_set_password_link(self):
        self.client.force_authenticate(self.sdcl)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse('campus_staff'), {
                'email': 'New.Advisor@unikl.edu.my', 'full_name': 'New Advisor', 'title': 'Lecturer',
                'home_unit': self.sd.pk}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertFalse(res.data['account_ready'])
        user = User.objects.get(email='new.advisor@unikl.edu.my')
        self.assertEqual(user.role, User.Role.STAFF)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('UniPact Campus', mail.outbox[0].body)

        # The link works with the existing accept endpoint, and greets them by name
        token = mail.outbox[0].body.split('token=')[1].split()[0].strip('">\'')
        from urllib.parse import unquote
        token = unquote(token)
        self.client.force_authenticate(None)
        preview = self.client.post(reverse('account_invitation_preview'), {'token': token}, format='json')
        self.assertEqual(preview.data['name'], 'New Advisor')
        accept = self.client.post(reverse('account_invitation_accept'),
                                  {'token': token, 'password': STRONG, 'accept_terms': True}, format='json')
        self.assertEqual(accept.status_code, status.HTTP_200_OK, accept.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password(STRONG))

    def test_staff_cannot_be_invited_twice_or_outside_your_campus(self):
        self.client.force_authenticate(self.sdcl)
        dupe = self.client.post(reverse('campus_staff'), {'email': self.student.email, 'full_name': 'X',
                                                          'home_unit': self.sd.pk}, format='json')
        self.assertEqual(dupe.status_code, status.HTTP_400_BAD_REQUEST)
        msi = OrgUnit.objects.create(parent=self.uni, kind=OrgUnit.Kind.CAMPUS, name='UniKL MSI')
        other = self.client.post(reverse('campus_staff'), {'email': 'x@unikl.edu.my', 'full_name': 'X',
                                                           'home_unit': msi.pk}, format='json')
        self.assertEqual(other.status_code, status.HTTP_403_FORBIDDEN)

    def test_appointing_and_ending_a_role(self):
        lecturer = make_user('lecturer@unikl.edu.my', User.Role.STAFF, 'Lecturer')
        self.client.force_authenticate(self.sdcl)
        res = self.client.post(reverse('campus_assignments'), {
            'email': 'LECTURER@unikl.edu.my', 'role': 'ADVISOR', 'unit': self.robotics.pk,
            'session': '2026/2027 Sem 1'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['person']['name'], 'Lecturer')
        again = self.client.post(reverse('campus_assignments'), {
            'email': lecturer.email, 'role': 'ADVISOR', 'unit': self.robotics.pk}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        listed = self.client.get(reverse('campus_assignments'), {'unit': self.robotics.pk}).data
        self.assertEqual([a['role'] for a in listed], ['ADVISOR'])

        end = self.client.post(reverse('campus_assignment_end', args=[res.data['id']]), {'reason': 'Transferred'},
                               format='json')
        self.assertEqual(end.status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('campus_assignments'), {'unit': self.robotics.pk}).data, [])
        history = self.client.get(reverse('campus_assignments'), {'unit': self.robotics.pk, 'history': 1}).data
        self.assertEqual(history[0]['ended_reason'], 'Transferred')

    def test_an_advisor_can_appoint_their_committee_but_not_staff(self):
        advisor = make_user('adv@unikl.edu.my', User.Role.STAFF, 'Advisor')
        appoint(advisor, R.ADVISOR, self.robotics)
        make_user('other.lecturer@unikl.edu.my', User.Role.STAFF)
        self.client.force_authenticate(advisor)
        ok = self.client.post(reverse('campus_assignments'), {
            'email': self.student.email, 'role': 'COMMITTEE', 'unit': self.robotics.pk, 'position': 'President'},
            format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)
        staff_role = self.client.post(reverse('campus_assignments'), {
            'email': 'other.lecturer@unikl.edu.my', 'role': 'CO_ADVISOR', 'unit': self.robotics.pk}, format='json')
        self.assertEqual(staff_role.status_code, status.HTTP_403_FORBIDDEN)
        other_club = self.client.post(reverse('campus_assignments'), {
            'email': self.student.email, 'role': 'MEMBER', 'unit': self.badminton.pk}, format='json')
        self.assertEqual(other_club.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_account_payload_names_staff(self):
        self.client.force_authenticate(self.sdcl)
        res = self.client.get(reverse('me'))
        self.assertEqual(res.data['name'], 'SDCL Officer')
        self.assertEqual(res.data['role'], 'STAFF')
