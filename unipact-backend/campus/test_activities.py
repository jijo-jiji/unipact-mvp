from datetime import timedelta
from io import StringIO

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User

from .models import CampusRole as R
from .models import Activity, ActivityPolicy, ApprovalRequest, Attendance, OrgUnit
from .tests import MiitTreeMixin, appoint, make_user


@override_settings(CAMPUS_ENABLED=True, CAMPUS_PILOT_ONLY=False)
class ActivityTestBase(MiitTreeMixin, APITestCase):
    """MIIT with every signer on the SAF 2026 form appointed."""

    def setUp(self):
        self.build_tree()
        self.president = make_user('president@s.unikl.edu.my', User.Role.STUDENT, 'Hakim President')
        appoint(self.president, R.COMMITTEE, self.robotics, position='President')
        self.member = make_user('member@s.unikl.edu.my', User.Role.STUDENT, 'Mira Member')
        appoint(self.member, R.MEMBER, self.robotics)
        self.outsider = make_user('outsider@s.unikl.edu.my', User.Role.STUDENT, 'Omar Outsider')
        self.src_exco = make_user('exco@s.unikl.edu.my', User.Role.STUDENT, 'SRC Exco')
        appoint(self.src_exco, R.SRC_EXCO, self.src, position='Academic & Spiritual')
        self.src_president = make_user('src.president@s.unikl.edu.my', User.Role.STUDENT, 'SRC President')
        appoint(self.src_president, R.SRC_PRESIDENT, self.src)
        self.signers = {}
        for key, role, unit in (('advisor', R.ADVISOR, self.robotics), ('executive', R.SECTION_EXECUTIVE, self.sd),
                                ('head', R.HEAD_OF_SECTION, self.sd), ('finance', R.HEAD_FINANCE, self.finance),
                                ('dd', R.DEPUTY_DEAN, self.dd_sdcl), ('dean', R.DEAN, self.miit)):
            person = make_user(f'{key}@unikl.edu.my', User.Role.STAFF, key.title())
            appoint(person, role, unit)
            self.signers[key] = person
        self.dd_at = make_user('dd.at@unikl.edu.my', User.Role.STAFF, 'DD AT')
        appoint(self.dd_at, R.DEPUTY_DEAN, OrgUnit.objects.get(short_name='DD A&T'))

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def body(self, **overrides):
        start = timezone.now() + timedelta(days=14)
        data = {
            'title': 'Arduino Workshop', 'background': 'Hands-on basics for first-year students.',
            'objectives': ['Train 40 students in Arduino basics', 'Recruit 10 new members'],
            'activity_level': 'CAMPUS', 'dna_category': 'GRADUATE', 'merit_elements': ['INTELLECTUAL', 'SOCIAL'],
            'venue': 'Lab 3', 'starts_at': start.isoformat(), 'ends_at': (start + timedelta(hours=3)).isoformat(),
            'expected_participants': 40, 'justification': 'Builds practical skills.',
            'budget_items': [{'item': 'Arduino kits', 'price': '45.00', 'quantity': 20},
                             {'item': 'Refreshments', 'price': '100.00', 'quantity': 1}],
            'funding_saf': '800.00', 'funding_campus': '200.00', 'funding_other': '0',
            'extra': {'logistics': '20 laptops', 'person_in_charge': 'Hakim'},
        }
        data.update(overrides)
        return data

    def propose(self, user=None, **overrides):
        with self.captureOnCommitCallbacks(execute=True):
            return self.as_user(user or self.president).post(
                reverse('campus_club_activities', args=[self.robotics.pk]), self.body(**overrides), format='json')

    def sign(self, user, approval_id, approve=True, comment=''):
        with self.captureOnCommitCallbacks(execute=True):
            return self.as_user(user).post(reverse('campus_approval_decide', args=[approval_id]),
                                           {'approve': approve, 'comment': comment}, format='json')

    def approve_all(self, approval_id):
        request = ApprovalRequest.objects.get(pk=approval_id)
        people = {R.SRC_EXCO: self.src_exco, R.ADVISOR: self.signers['advisor'],
                  R.SECTION_EXECUTIVE: self.signers['executive'], R.SRC_PRESIDENT: self.src_president,
                  R.HEAD_OF_SECTION: self.signers['head'], R.HEAD_FINANCE: self.signers['finance'],
                  R.DEPUTY_DEAN: self.signers['dd'], R.DEAN: self.signers['dean']}
        for step in request.steps.order_by('order'):
            res = self.sign(people[step.roles[0]], approval_id)
            self.assertEqual(res.status_code, status.HTTP_200_OK, (step.label, res.data))
        return Activity.objects.get(approval__pk=approval_id)

    def labels(self, approval_id):
        return [s.label for s in ApprovalRequest.objects.get(pk=approval_id).steps.order_by('order')]


class ChainTests(ActivityTestBase):
    def test_under_rm5k_the_deputy_dean_has_the_last_word(self):
        res = self.propose()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['total_budget'], '1000.00')
        self.assertEqual(self.labels(res.data['approval_id']), [
            'Acknowledged by the SRC Exco (Academic & Spiritual)', 'Supported by the club advisor',
            'Reviewed by the section executive', 'Budget endorsed by the SRC President',
            'Verified by the Head of Section', 'Recommended by the Head of Management & Finance',
            'Approved by the Deputy Dean'])
        activity = self.approve_all(res.data['approval_id'])
        self.assertEqual(activity.status, Activity.Status.APPROVED)
        yy = f'{timezone.localtime(activity.starts_at).year % 100:02d}'
        self.assertEqual(activity.approval_number, f'10101{yy}')  # SD, club 01, activity 01
        self.assertIn(activity.approval_number, mail.outbox[-1].body)

    def test_over_rm5k_the_dean_approves_after_the_deputy_dean_recommends(self):
        res = self.propose(budget_items=[{'item': 'Competition entry', 'price': '6000.00', 'quantity': 1}],
                           funding_saf='3000.00', funding_campus='3000.00')
        self.assertTrue(res.data['needs_dean'])
        self.assertEqual(self.labels(res.data['approval_id'])[-2:],
                         ['Recommended by the Deputy Dean', 'Approved by the Dean / Head of Campus'])
        self.assertEqual(self.approve_all(res.data['approval_id']).status, Activity.Status.APPROVED)

    def test_no_budget_skips_the_srcs_endorsement_and_finance(self):
        res = self.propose(budget_items=[], funding_saf='0', funding_campus='0')
        self.assertEqual(self.labels(res.data['approval_id']), [
            'Acknowledged by the SRC Exco (Academic & Spiritual)', 'Supported by the club advisor',
            'Reviewed by the section executive', 'Verified by the Head of Section', 'Approved by the Deputy Dean'])

    def test_a_campus_can_leave_out_the_src_and_finance_steps_and_move_the_threshold(self):
        ActivityPolicy.objects.update_or_create(campus=self.miit, defaults={
            'src_steps': False, 'finance_step': False, 'dean_threshold': 500})
        res = self.propose()
        self.assertEqual(self.labels(res.data['approval_id']), [
            'Supported by the club advisor', 'Reviewed by the section executive', 'Verified by the Head of Section',
            'Recommended by the Deputy Dean', 'Approved by the Dean / Head of Campus'])

    def test_only_the_right_people_sign_and_in_order(self):
        approval_id = self.propose().data['approval_id']
        self.assertEqual(self.sign(self.signers['advisor'], approval_id).status_code, status.HTTP_403_FORBIDDEN)
        self.sign(self.src_exco, approval_id)
        other_advisor = make_user('badminton.adv@unikl.edu.my', User.Role.STAFF)
        appoint(other_advisor, R.ADVISOR, self.badminton)
        self.assertEqual(self.sign(other_advisor, approval_id).status_code, status.HTTP_403_FORBIDDEN)
        for key in ('advisor', 'executive'):
            self.sign(self.signers[key], approval_id)
        self.sign(self.src_president, approval_id)
        self.sign(self.signers['head'], approval_id)
        self.sign(self.signers['finance'], approval_id)
        self.assertEqual(self.sign(self.dd_at, approval_id).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.sign(self.signers['dd'], approval_id).data['status'], 'APPROVED')

    def test_numbers_count_up_per_club_and_carry_the_sector(self):
        first = self.approve_all(self.propose().data['approval_id'])
        second = self.approve_all(self.propose(title='Robot Race').data['approval_id'])
        self.assertEqual(second.approval_number[:5], '10102')
        cl_president = make_user('cl.pres@s.unikl.edu.my', User.Role.STUDENT)
        appoint(cl_president, R.COMMITTEE, self.badminton, position='President')
        appoint(make_user('cl.adv@unikl.edu.my', User.Role.STAFF), R.ADVISOR, self.badminton)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.as_user(cl_president).post(reverse('campus_club_activities', args=[self.badminton.pk]),
                                                  self.body(title='Friendly match'), format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(self.labels(res.data['approval_id'])[0],
                         'Acknowledged by the SRC Exco (Sports, Recreational & Cultural)')
        self.assertTrue(first.approval_number.startswith('101'))


    def test_the_year_in_the_number_is_malaysias(self):
        # 04:00 on 1 Jan 2027 in Malaysia is still 31 Dec 2026 in UTC
        res = self.propose(starts_at='2026-12-31T20:00:00Z', ends_at='2026-12-31T23:00:00Z')
        self.assertTrue(self.approve_all(res.data['approval_id']).approval_number.endswith('27'))


class ProposalRuleTests(ActivityTestBase):
    def test_the_funding_must_add_up_to_the_budget(self):
        res = self.propose(funding_saf='100.00', funding_campus='0')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must add up', str(res.data))

    def test_dates_ghocs_details_and_objectives_are_required(self):
        start = timezone.now() + timedelta(days=3)
        self.assertEqual(self.propose(ends_at=start.isoformat(), starts_at=start.isoformat()).status_code, 400)
        self.assertEqual(self.propose(merit_elements=[]).status_code, 400)
        self.assertEqual(self.propose(dna_category='COOKING').status_code, 400)
        self.assertEqual(self.propose(objectives=[]).status_code, 400)

    def test_ordinary_members_cannot_propose(self):
        self.assertEqual(self.propose(user=self.member).status_code, status.HTTP_403_FORBIDDEN)

    def test_a_proposal_is_only_visible_to_the_club_and_its_signers(self):
        res = self.propose()
        url = reverse('campus_activity', args=[res.data['id']])
        self.assertEqual(self.as_user(self.member).get(url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.as_user(self.signers['finance']).get(url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.as_user(self.outsider).get(url).status_code, status.HTTP_404_NOT_FOUND)
        club_list = self.as_user(self.outsider).get(reverse('campus_club_activities', args=[self.robotics.pk])).data
        self.assertEqual(club_list, [])

    def test_the_saf_form_pdf(self):
        res = self.propose()
        pdf = self.as_user(self.member).get(reverse('campus_activity_pdf', args=[res.data['id']]))
        self.assertEqual(pdf.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf['Content-Type'], 'application/pdf')
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        self.assertEqual(self.as_user(self.outsider).get(reverse('campus_activity_pdf', args=[res.data['id']]))
                         .status_code, status.HTTP_404_NOT_FOUND)


class PublishedActivityTests(ActivityTestBase):
    def setUp(self):
        super().setUp()
        self.activity = self.approve_all(self.propose().data['approval_id'])
        self.url = lambda name, *extra: reverse(name, args=[self.activity.pk, *extra])

    def publish(self):
        res = self.as_user(self.president).post(self.url('campus_activity_publish'))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.activity.refresh_from_db()
        return self.activity

    def test_publishing_then_qr_check_in(self):
        self.assertEqual(self.as_user(self.member).post(self.url('campus_activity_publish')).status_code, 403)
        activity = self.publish()
        self.assertEqual(self.as_user(self.outsider).get(self.url('campus_activity')).status_code, 200)
        checkin = reverse('campus_checkin', args=[activity.checkin_code])
        self.assertEqual(self.as_user(self.outsider).post(checkin).status_code, status.HTTP_400_BAD_REQUEST)
        self.as_user(self.president).post(self.url('campus_activity_checkin'), {'open': True}, format='json')
        self.assertEqual(self.as_user(self.outsider).post(checkin).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.as_user(self.outsider).post(checkin).status_code, status.HTTP_200_OK)  # once only
        self.assertEqual(self.as_user(self.president).post(checkin).data['role'], 'COMMITTEE')
        self.assertEqual(self.as_user(self.signers['advisor']).post(checkin).status_code, 403)
        listed = self.as_user(self.president).get(self.url('campus_attendance')).data['attendance']
        self.assertEqual({a['person']['name']: a['role'] for a in listed},
                         {'Omar Outsider': 'PARTICIPANT', 'Hakim President': 'COMMITTEE'})

    def test_a_new_code_stops_the_old_qr(self):
        activity = self.publish()
        old = activity.checkin_code
        self.as_user(self.president).post(self.url('campus_activity_checkin'), {'open': True, 'new_code': True},
                                          format='json')
        self.assertEqual(self.as_user(self.member).post(reverse('campus_checkin', args=[old])).status_code, 404)

    def test_the_committee_adds_and_corrects_attendance(self):
        self.publish()
        res = self.as_user(self.president).post(self.url('campus_attendance'),
                                                {'email': self.member.email, 'role': 'ORGANISER'}, format='json')
        self.assertEqual((res.status_code, res.data['method']), (201, 'MANUAL'))
        fixed = self.client.patch(self.url('campus_attendance_detail', res.data['id']), {'role': 'COMMITTEE'},
                                  format='json')
        self.assertEqual(fixed.data['role'], 'COMMITTEE')
        self.assertEqual(self.as_user(self.member).get(self.url('campus_attendance')).status_code, 403)

    def test_participants_join_the_discussion_but_strangers_cannot(self):
        self.publish()
        Attendance.objects.create(activity=self.activity, student=self.outsider)
        url = self.url('campus_activity_comments')
        self.assertEqual(self.as_user(self.outsider).post(url, {'body': 'Great session'}, format='json').status_code, 201)
        stranger = make_user('stranger@s.unikl.edu.my', User.Role.STUDENT)
        self.assertEqual(self.as_user(stranger).get(url).status_code, status.HTTP_403_FORBIDDEN)

    def test_report_after_the_activity_then_the_advisor_reviews_it(self):
        self.publish()
        report_url = self.url('campus_activity_report')
        early = self.as_user(self.president).put(report_url, {'summary': 'Went well'}, format='multipart')
        self.assertEqual(early.status_code, status.HTTP_400_BAD_REQUEST)

        Activity.objects.filter(pk=self.activity.pk).update(
            starts_at=timezone.now() - timedelta(days=2), ends_at=timezone.now() - timedelta(days=2) + timedelta(hours=3))
        photo = SimpleUploadedFile('photo.png', b'\x89PNG\r\n\x1a\n' + b'0' * 64, content_type='image/png')
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            res = self.as_user(self.president).put(report_url, {
                'summary': '38 students attended.', 'budget_used': '950.00', 'merit_elements': '["SOCIAL"]',
                'files': [photo]}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(len(res.data['report']['files']), 1)
        self.assertEqual(mail.outbox[0].to, ['advisor@unikl.edu.my'])

        review = self.url('campus_report_review')
        self.assertEqual(self.as_user(self.president).post(review, {'accept': True}, format='json').status_code, 403)
        self.assertEqual(self.as_user(self.signers['advisor']).post(review, {'accept': False}, format='json')
                         .status_code, 400)
        self.client.post(review, {'accept': False, 'remarks': 'Add the attendance photos'}, format='json')
        self.as_user(self.president).put(report_url, {'summary': '38 students attended. Photos added.'},
                                         format='multipart')
        done = self.as_user(self.signers['advisor']).post(review, {'accept': True}, format='json')
        self.assertEqual(done.data['report']['status'], 'ACCEPTED')
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.status, Activity.Status.COMPLETED)

    def test_report_reminders_go_out_on_schedule_and_not_twice_a_day(self):
        self.publish()
        Activity.objects.filter(pk=self.activity.pk).update(
            starts_at=timezone.now() - timedelta(days=3), ends_at=timezone.now() - timedelta(days=2))
        mail.outbox.clear()
        out = StringIO()
        with self.captureOnCommitCallbacks(execute=True):
            call_command('campus_reminders', stdout=out)
            call_command('campus_reminders', stdout=out)
        self.assertEqual([m.to for m in mail.outbox], [['president@s.unikl.edu.my']])
        self.assertIn('Activity report due', mail.outbox[0].subject)
        # Two weeks after the end it's due: one more
        Activity.objects.filter(pk=self.activity.pk).update(ends_at=timezone.now() - timedelta(days=15))
        with self.captureOnCommitCallbacks(execute=True):
            call_command('campus_reminders', stdout=out)
        self.assertEqual(len(mail.outbox), 2)

    def test_campus_activity_lists(self):
        self.publish()
        mine = self.as_user(self.member).get(reverse('campus_activities')).data
        self.assertEqual([a['title'] for a in mine], ['Arduino Workshop'])
        self.assertEqual(self.as_user(self.outsider).get(reverse('campus_activities')).data, [])
        everywhere = self.client.get(reverse('campus_activities'), {'scope': 'campus'}).data
        self.assertEqual(len(everywhere), 1)


class PolicyTests(ActivityTestBase):
    def test_only_campus_managers_change_the_chain(self):
        admin = make_user('sdcl@unikl.edu.my', User.Role.STAFF)
        appoint(admin, R.CAMPUS_ADMIN, self.miit)
        url = reverse('campus_policy') + f'?campus={self.miit.pk}'
        self.assertEqual(self.as_user(admin).patch(url, {'src_steps': False, 'dean_threshold': '3000.00'},
                                                   format='json').status_code, 200)
        self.assertFalse(ActivityPolicy.objects.get(campus=self.miit).src_steps)
        self.assertEqual(self.as_user(self.signers['advisor']).patch(url, {'src_steps': True}, format='json')
                         .status_code, status.HTTP_403_FORBIDDEN)
