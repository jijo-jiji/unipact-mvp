from django.urls import reverse
from rest_framework import status

from users.models import User

from . import survey
from .models import Attendance, SurveyResponse
from .models import CampusRole as R
from .test_ghocs import GhocsTestBase
from .tests import appoint, make_user

ALL_AGREE = {q: 5 for q in survey.QUESTION_IDS}


class DashboardTests(GhocsTestBase):
    def setUp(self):
        super().setUp()
        self.sdcl = make_user('sdcl@unikl.edu.my', User.Role.STAFF, 'SDCL')
        appoint(self.sdcl, R.CAMPUS_ADMIN, self.miit)

    def dashboard(self, user, **params):
        self.client.force_authenticate(user)
        return self.client.get(reverse('campus_dashboard'), {'campus': self.miit.pk, **params})

    def test_only_campus_management_sees_it(self):
        self.assertEqual(self.dashboard(self.signers['dean']).status_code, status.HTTP_200_OK)
        self.assertEqual(self.dashboard(self.secretary).status_code, status.HTTP_200_OK)
        self.assertEqual(self.dashboard(self.signers['advisor']).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.dashboard(self.member).status_code, status.HTTP_403_FORBIDDEN)

    def test_the_figures_after_a_real_activity_and_claim(self):
        self.completed_activity([(self.member, Attendance.Role.PARTICIPANT), (self.outsider, Attendance.Role.PARTICIPANT)])
        claim = self.claim(self.member, kind='SKILL', subject='Arabic', date='2026-06-01')
        self.verify(claim.data['id'])
        data = self.dashboard(self.signers['dean'], start='2020-01-01', end='2030-12-31').data

        self.assertEqual((data['activities']['held'], data['activities']['attendance']), (1, 2))
        graduate = next(row for row in data['activities']['by_category'] if row['category'] == 'Graduate')
        self.assertEqual((graduate['activities'], graduate['attendance']), (1, 2))
        self.assertEqual(data['activities']['reports']['on_time'], 1)

        kinds = {row['kind']: row for row in data['approvals']}
        self.assertEqual((kinds['ACTIVITY']['approved'], kinds['GHOCS_CLAIM']['approved']), (1, 1))
        self.assertIsNotNone(kinds['ACTIVITY']['median_days'])
        self.assertEqual(len(data['step_times']), 7)  # every signature box on the SAF chain

        g = data['ghocs']
        self.assertEqual((g['automatic'], g['from_claims'], g['automatic_share']), (2, 1, 66.7))
        self.assertEqual((g['claims']['approved'], g['claims']['rejection_rate']), (1, 0.0))
        self.assertEqual(g['balanced_webs'], 0)  # Graduate alone doesn't reach SC1 or SC5
        self.assertEqual(data['clubs']['clubs'], 2)

    def test_csv_export(self):
        self.completed_activity([(self.member, Attendance.Role.PARTICIPANT)])
        res = self.dashboard(self.signers['dean'], start='2020-01-01', end='2030-12-31', export='activities')
        self.assertEqual(res['Content-Type'], 'text/csv; charset=utf-8')
        text = res.content.decode('utf-8-sig')
        self.assertTrue(text.startswith('Approval number,Club,Activity'))
        self.assertIn('Arduino Workshop', text)
        self.assertEqual(self.dashboard(self.signers['dean'], export='passwords').status_code, 400)


class SurveyTests(GhocsTestBase):
    def setUp(self):
        super().setUp()
        self.sdcl = make_user('sdcl@unikl.edu.my', User.Role.STAFF, 'SDCL')
        appoint(self.sdcl, R.CAMPUS_ADMIN, self.miit)

    def answer(self, user, answers=None, comment=''):
        self.client.force_authenticate(user)
        return self.client.post(reverse('campus_survey'), {'campus': self.miit.pk, 'answers': answers or ALL_AGREE,
                                                           'comment': comment}, format='json')

    def open_survey(self, user=None):
        self.client.force_authenticate(user or self.sdcl)
        return self.client.patch(reverse('campus_survey_settings'), {'campus': self.miit.pk, 'is_open': True},
                                 format='json')

    def test_answers_only_while_open_and_complete(self):
        self.assertEqual(self.answer(self.member).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.open_survey(self.signers['advisor']).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.open_survey().status_code, status.HTTP_200_OK)
        self.assertEqual(self.answer(self.member, {'f1': 5}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.answer(self.member, {**ALL_AGREE, 'f1': 9}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.answer(self.member).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.answer(self.member, {**ALL_AGREE, 'u1': 3}).status_code, status.HTTP_200_OK)  # replaces
        self.assertEqual(SurveyResponse.objects.count(), 1)
        self.client.force_authenticate(self.member)
        mine = self.client.get(reverse('campus_survey'), {'campus': self.miit.pk}).data
        self.assertEqual((mine['is_open'], mine['my_response']['answers']['u1']), (True, 3))

    def test_results_sit_next_to_the_uniklskill_baseline(self):
        self.open_survey()
        self.answer(self.member, comment='Check-in by QR was quick')
        self.answer(self.president, {q: 4 for q in survey.QUESTION_IDS})
        self.answer(self.signers['advisor'], {**ALL_AGREE, 'u4': 3})
        self.client.force_authenticate(self.signers['dean'])
        data = self.client.get(reverse('campus_dashboard'), {'campus': self.miit.pk}).data['survey']
        self.assertEqual(data['n'], 3)
        self.assertEqual(data['by_type'], {'STUDENT': 1, 'COMMITTEE': 1, 'STAFF': 1})
        functionality = data['categories'][0]
        self.assertEqual((functionality['shares'][5], functionality['shares'][4]), (66.7, 33.3))
        usability = data['categories'][1]
        self.assertEqual(usability['shares'][3], 6.7)  # 1 neutral answer out of 15
        self.assertEqual(data['baseline']['functionality'][5], 61.3)
        self.assertEqual(data['comments'], ['Check-in by QR was quick'])
