from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from users.models import User

from .models import CampusRole as R
from .models import (
    Activity, ActivityReport, Attendance, GhocsClaim, GhocsEntry, GhocsSettings, NewsPost, RoleAssignment,
)
from .points import record
from .test_activities import ActivityTestBase
from .tests import appoint, make_user


def evidence(name='cert.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4\n% certificate\n' + b'0' * 64, content_type='application/pdf')


class GhocsTestBase(ActivityTestBase):
    def setUp(self):
        super().setUp()
        self.secretary = make_user('ghocs.secretary@unikl.edu.my', User.Role.STAFF, 'GHOCS Secretary')
        appoint(self.secretary, R.GHOCS_SECRETARY, self.sd)

    def completed_activity(self, attendees, **overrides):
        """An approved, published, attended activity whose report the advisor accepted."""
        activity = self.approve_all(self.propose(**overrides).data['approval_id'])
        self.as_user(self.president).post(reverse('campus_activity_publish', args=[activity.pk]))
        for student, role in attendees:
            Attendance.objects.create(activity=activity, student=student, role=role)
        Activity.objects.filter(pk=activity.pk).update(starts_at=timezone.now() - timedelta(days=2),
                                                       ends_at=timezone.now() - timedelta(days=2, hours=-3))
        ActivityReport.objects.create(activity=activity, summary='Done', submitted_by=self.president)
        res = self.as_user(self.signers['advisor']).post(reverse('campus_report_review', args=[activity.pk]),
                                                         {'accept': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        activity.refresh_from_db()
        return activity

    def claim(self, user, **body):
        body.setdefault('evidence', evidence())
        with self.captureOnCommitCallbacks(execute=True):
            return self.as_user(user).post(reverse('campus_ghocs_claims'), body, format='multipart')

    def verify(self, claim_id, approve=True, comment=''):
        approval = GhocsClaim.objects.get(pk=claim_id).approval
        with self.captureOnCommitCallbacks(execute=True):
            return self.as_user(self.secretary).post(reverse('campus_approval_decide', args=[approval.pk]),
                                                     {'approve': approve, 'comment': comment}, format='json')


class ActivityPointsTests(GhocsTestBase):
    def test_accepting_the_report_gives_attendees_their_dna_points(self):
        self.completed_activity([(self.member, Attendance.Role.PARTICIPANT), (self.outsider, Attendance.Role.PARTICIPANT)])
        for student in (self.member, self.outsider):
            entry = GhocsEntry.objects.get(student=student)
            self.assertEqual((entry.component, entry.dna_category, entry.points), ('DNA', 'GRADUATE', Decimal('1.00')))
        data = record(self.member)
        # Graduate feeds SC2, SC3 and SC4
        self.assertEqual({row['code']: row['points'] for row in data['web']},
                         {'SC1': 0, 'SC2': Decimal('1.00'), 'SC3': Decimal('1.00'), 'SC4': Decimal('1.00'), 'SC5': 0})
        self.assertEqual(data['web'][1]['percent'], 5.0)  # 1 of the default target 20

    def test_no_points_before_the_report_is_accepted(self):
        activity = self.approve_all(self.propose().data['approval_id'])
        Attendance.objects.create(activity=activity, student=self.member)
        self.assertFalse(GhocsEntry.objects.exists())

    def test_level_and_role_weights_and_recalculating(self):
        GhocsSettings.objects.update_or_create(campus=self.miit, defaults={'tables': {
            'level_weights': {'NATIONAL': 3}, 'role_weights': {'ORGANISER': 2}}})
        self.completed_activity([(self.member, Attendance.Role.ORGANISER)], activity_level='NATIONAL')
        self.assertEqual(GhocsEntry.objects.get(student=self.member).points, Decimal('6.00'))
        admin = make_user('sdcl@unikl.edu.my', User.Role.STAFF)
        appoint(admin, R.CAMPUS_ADMIN, self.miit)
        url = reverse('campus_ghocs_settings') + f'?campus={self.miit.pk}'
        res = self.as_user(admin).patch(url, {'tables': {'dna_points': 2}, 'apply_to_existing': True}, format='json')
        self.assertEqual((res.status_code, res.data['recalculated']), (200, 1))
        self.assertEqual(GhocsEntry.objects.get(student=self.member).points, Decimal('12.00'))
        self.assertEqual(self.as_user(self.signers['advisor']).patch(url, {'label': 'x'}, format='json').status_code, 403)

    def test_attendance_changed_after_completion_updates_points(self):
        activity = self.completed_activity([(self.member, Attendance.Role.PARTICIPANT)])
        res = self.as_user(self.president).post(reverse('campus_attendance', args=[activity.pk]),
                                                {'email': self.outsider.email}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(GhocsEntry.objects.filter(student=self.outsider).exists())


class ManagementTests(GhocsTestBase):
    def test_management_skills_count_once_per_club_per_semester(self):
        RoleAssignment.objects.filter(user=self.president).update(session='2026/2027 Sem 1')
        appoint(self.president, R.MEMBER, self.badminton, session='2026/2027 Sem 1')
        old = appoint(self.president, R.MEMBER, self.robotics, session='2025/2026 Sem 2')
        old.end('Semester over')
        data = record(self.president)
        self.assertEqual(data['components']['management'], Decimal('20'))  # 10 + 5 + 5
        self.assertEqual(len(data['management_terms']), 3)


class ClaimTests(GhocsTestBase):
    def setUp(self):
        super().setUp()
        self.post = NewsPost.objects.create(
            campus=self.miit, title='Game of Hackers', body='National CTF', ghocs_claimable=True,
            activity_level='NATIONAL', dna_category='LEADERSHIP', merit_elements=['INTELLECTUAL'],
            starts_on=timezone.localdate(), status=NewsPost.Status.PUBLISHED, published_at=timezone.now())

    def test_an_event_claim_takes_its_category_from_the_event(self):
        res = self.claim(self.member, kind='EVENT', news_post=self.post.pk, dna_category='ENTREPRENEUR')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual((res.data['dna_category'], res.data['activity_level']), ('LEADERSHIP', 'NATIONAL'))
        self.assertIn('ghocs.secretary@unikl.edu.my', [m.to[0] for m in mail.outbox])
        self.assertEqual(self.claim(self.member, kind='EVENT', news_post=self.post.pk).status_code, 400)  # twice
        # Only a GHOCS secretary verifies
        approval = GhocsClaim.objects.get(pk=res.data['id']).approval
        self.assertEqual(self.as_user(self.signers['advisor']).post(
            reverse('campus_approval_decide', args=[approval.pk]), {'approve': True}, format='json').status_code, 403)
        self.verify(res.data['id'])
        entry = GhocsEntry.objects.get(student=self.member)
        self.assertEqual((entry.component, entry.dna_category, entry.points), ('DNA', 'LEADERSHIP', Decimal('1.00')))
        self.assertIn('points were added', mail.outbox[-1].body)

    def test_excellence_and_skill_claims(self):
        ex = self.claim(self.member, kind='EXCELLENCE', title='Hackathon finalist', achievement='REPRESENTATIVE',
                        activity_level='NATIONAL', rank='Finalist', date='2026-10-10')
        self.assertEqual(ex.status_code, status.HTTP_201_CREATED, ex.data)
        self.verify(ex.data['id'])
        skill = self.claim(self.member, kind='SKILL', subject='Mandarin', date='2026-06-01')
        self.verify(skill.data['id'])
        components = record(self.member)['components']
        self.assertEqual((components['excellence'], components['skill_development']), (Decimal('10.00'), Decimal('5.00')))
        self.assertEqual(self.claim(self.member, kind='SKILL', subject='Klingon', date='2026-06-01').status_code, 400)
        self.assertEqual(self.claim(self.member, kind='EXCELLENCE', title='x').status_code, 400)

    def test_a_rejected_claim_gives_nothing_and_says_why(self):
        res = self.claim(self.member, kind='SKILL', subject='French', date='2026-06-01')
        self.assertEqual(self.verify(res.data['id'], approve=False).status_code, 400)  # a reason is needed
        self.verify(res.data['id'], approve=False, comment='The slip shows a fail grade')
        self.assertEqual(GhocsClaim.objects.get(pk=res.data['id']).status, GhocsClaim.Status.REJECTED)
        self.assertFalse(GhocsEntry.objects.exists())
        self.assertIn('fail grade', mail.outbox[-1].body)

    def test_staff_cannot_claim_and_evidence_is_required(self):
        self.assertEqual(self.claim(self.signers['advisor'], kind='SKILL', subject='French', date='2026-06-01')
                         .status_code, 403)
        res = self.as_user(self.member).post(reverse('campus_ghocs_claims'),
                                             {'kind': 'SKILL', 'subject': 'French', 'date': '2026-06-01'},
                                             format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_secretaries_are_reminded_at_3_and_7_days(self):
        res = self.claim(self.member, kind='SKILL', subject='Arabic', date='2026-06-01')
        GhocsClaim.objects.filter(pk=res.data['id']).update(created_at=timezone.now() - timedelta(days=4))
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            call_command('campus_reminders', stdout=StringIO())
            call_command('campus_reminders', stdout=StringIO())
        self.assertEqual([m.to for m in mail.outbox], [['ghocs.secretary@unikl.edu.my']])
        GhocsClaim.objects.filter(pk=res.data['id']).update(created_at=timezone.now() - timedelta(days=8))
        with self.captureOnCommitCallbacks(execute=True):
            call_command('campus_reminders', stdout=StringIO())
        self.assertEqual(len(mail.outbox), 2)


class RecordApiTests(GhocsTestBase):
    def test_my_record_the_transcript_and_who_else_can_see_it(self):
        self.completed_activity([(self.member, Attendance.Role.PARTICIPANT)])
        data = self.as_user(self.member).get(reverse('campus_ghocs_me')).data
        self.assertEqual(data['components']['dna'], Decimal('1.00'))
        self.assertEqual(data['hint']['code'], 'SC1')
        self.assertIn('Mandarin', data['skill_subjects'])
        self.assertFalse(data['official'])
        pdf = self.client.get(reverse('campus_ghocs_transcript'))
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        url = reverse('campus_ghocs_student', args=[self.member.pk])
        self.assertEqual(self.as_user(self.secretary).get(url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.as_user(self.outsider).get(url).status_code, status.HTTP_403_FORBIDDEN)
