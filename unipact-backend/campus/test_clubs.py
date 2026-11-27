from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User

from .models import CampusRole as R
from .models import (
    AcademicSession, ApprovalRequest, CampusClub, ClubProposal, JoinRequest, NewsPost, OrgUnit, RoleAssignment,
)
from .tests import MiitTreeMixin, appoint, make_user


@override_settings(CAMPUS_ENABLED=True, CAMPUS_PILOT_ONLY=False)
class ClubTestBase(MiitTreeMixin, APITestCase):
    def setUp(self):
        self.build_tree()
        today = timezone.localdate()
        self.session = AcademicSession.objects.create(campus=self.miit, label='2026/2027 Sem 1',
                                                      starts_on=today - timedelta(days=30),
                                                      ends_on=today + timedelta(days=90))
        self.advisor = make_user('advisor@unikl.edu.my', User.Role.STAFF, 'Dr Advisor')
        appoint(self.advisor, R.ADVISOR, self.robotics)
        self.president = make_user('president@s.unikl.edu.my', User.Role.STUDENT, 'Hakim President')
        appoint(self.president, R.COMMITTEE, self.robotics, position='President')
        self.member = make_user('member@s.unikl.edu.my', User.Role.STUDENT, 'Mira Member')
        appoint(self.member, R.MEMBER, self.robotics)
        self.student = make_user('aina@s.unikl.edu.my', User.Role.STUDENT, 'Aina Student')
        self.outsider = make_user('outsider@s.unikl.edu.my', User.Role.STUDENT, 'Omar Outsider')

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client


class DirectoryTests(ClubTestBase):
    def test_anyone_can_browse_clubs_and_filter_by_sector(self):
        res = self.client.get(reverse('campus_clubs'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([c['name'] for c in res.data], ['Badminton Club', 'Robotics Club'])
        sd = self.client.get(reverse('campus_clubs'), {'sector': 'SD'}).data
        self.assertEqual([c['name'] for c in sd], ['Robotics Club'])
        self.assertEqual(sd[0]['member_count'], 2)

    def test_the_club_page_shows_its_leaders_and_what_i_can_do(self):
        data = self.as_user(self.student).get(reverse('campus_club', args=[self.robotics.pk])).data
        self.assertEqual([a['name'] for a in data['advisors']], ['Dr Advisor'])
        self.assertEqual(data['committee'], [{'id': data['committee'][0]['id'], 'name': 'Hakim President',
                                              'position': 'President'}])
        self.assertTrue(data['me']['can_join'])
        self.assertFalse(data['me']['can_manage'])
        manager_view = self.as_user(self.president).get(reverse('campus_club', args=[self.robotics.pk])).data
        self.assertTrue(manager_view['me']['can_manage'])

    def test_the_committee_edits_the_club_page_but_a_member_cannot(self):
        url = reverse('campus_club', args=[self.robotics.pk])
        res = self.as_user(self.president).patch(url, {'description': 'We build robots.', 'dna_category': 'GRADUATE',
                                                       'merit_elements': ['SOCIAL', 'INTELLECTUAL']}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['merit_elements'], ['INTELLECTUAL', 'SOCIAL'])  # S.P.I.C.E.S order
        self.assertEqual(self.as_user(self.member).patch(url, {'description': 'x'}, format='json').status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_the_full_member_list_is_for_members(self):
        url = reverse('campus_club_members', args=[self.robotics.pk])
        self.assertEqual({m['person']['name'] for m in self.as_user(self.member).get(url).data},
                         {'Dr Advisor', 'Hakim President', 'Mira Member'})
        self.assertEqual({m['person']['name'] for m in self.as_user(self.outsider).get(url).data},
                         {'Dr Advisor', 'Hakim President'})


class JoinTests(ClubTestBase):
    def test_a_student_asks_to_join_and_the_committee_approves(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.as_user(self.student).post(reverse('campus_club_join', args=[self.robotics.pk]),
                                                  {'message': 'I love robots'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        # The committee and the advisor are told
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['advisor@unikl.edu.my', 'president@s.unikl.edu.my'])

        again = self.client.post(reverse('campus_club_join', args=[self.robotics.pk]), {}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        pending = self.as_user(self.president).get(reverse('campus_club_requests', args=[self.robotics.pk])).data
        self.assertEqual([r['person']['name'] for r in pending], ['Aina Student'])
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            decided = self.client.post(reverse('campus_club_request_decide', args=[self.robotics.pk, pending[0]['id']]),
                                       {'approve': True}, format='json')
        self.assertEqual(decided.data['status'], 'APPROVED')
        membership = RoleAssignment.objects.current().get(user=self.student, unit=self.robotics)
        self.assertEqual((membership.role, membership.session, membership.ends_on),
                         (R.MEMBER, '2026/2027 Sem 1', self.session.ends_on))
        self.assertEqual(mail.outbox[0].to, ['aina@s.unikl.edu.my'])
        self.assertIn('Welcome', mail.outbox[0].subject)

    def test_a_rejection_carries_its_reason(self):
        join = JoinRequest.objects.create(club=self.robotics, student=self.student)
        with self.captureOnCommitCallbacks(execute=True):
            self.as_user(self.advisor).post(reverse('campus_club_request_decide', args=[self.robotics.pk, join.pk]),
                                            {'approve': False, 'reason': 'Full this semester'}, format='json')
        self.assertFalse(RoleAssignment.objects.filter(user=self.student, unit=self.robotics).exists())
        self.assertIn('Full this semester', mail.outbox[0].body)

    def test_only_managers_of_that_club_decide(self):
        join = JoinRequest.objects.create(club=self.robotics, student=self.student)
        url = reverse('campus_club_request_decide', args=[self.robotics.pk, join.pk])
        self.assertEqual(self.as_user(self.member).post(url, {'approve': True}, format='json').status_code,
                         status.HTTP_403_FORBIDDEN)
        badminton_advisor = make_user('badminton.adv@unikl.edu.my', User.Role.STAFF)
        appoint(badminton_advisor, R.ADVISOR, self.badminton)
        self.assertEqual(self.as_user(badminton_advisor).post(url, {'approve': True}, format='json').status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_staff_cannot_join_and_a_closed_club_takes_no_requests(self):
        self.assertEqual(self.as_user(self.advisor).post(reverse('campus_club_join', args=[self.badminton.pk]),
                                                         {}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        CampusClub.objects.update_or_create(unit=self.badminton, defaults={'joining_open': False})
        self.assertEqual(self.as_user(self.student).post(reverse('campus_club_join', args=[self.badminton.pk]),
                                                         {}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

    def test_my_clubs_lists_current_terms_history_and_pending_requests(self):
        old = appoint(self.student, R.MEMBER, self.badminton)
        old.end('Left the club')
        JoinRequest.objects.create(club=self.robotics, student=self.student)
        data = self.as_user(self.student).get(reverse('campus_my_clubs')).data
        self.assertEqual((len(data['current']), len(data['history']), len(data['pending_requests'])), (0, 1, 1))


class MemberManagementTests(ClubTestBase):
    def test_the_advisor_adds_a_committee_member_by_email_and_they_are_told(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.as_user(self.advisor).post(reverse('campus_club_members', args=[self.robotics.pk]), {
                'email': 'AINA@s.unikl.edu.my', 'role': 'COMMITTEE', 'position': 'Secretary'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['position'], 'Secretary')
        self.assertIn('Secretary', mail.outbox[0].subject)

    def test_promoting_closes_the_old_term_and_keeps_it(self):
        membership = RoleAssignment.objects.current().get(user=self.member, unit=self.robotics)
        res = self.as_user(self.president).patch(
            reverse('campus_club_member', args=[self.robotics.pk, membership.pk]),
            {'role': 'COMMITTEE', 'position': 'Treasurer'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(RoleAssignment.objects.current().get(user=self.member, unit=self.robotics).position,
                         'Treasurer')
        self.assertEqual(RoleAssignment.objects.filter(user=self.member, unit=self.robotics).count(), 2)

    def test_a_committee_role_needs_a_position(self):
        res = self.as_user(self.advisor).post(reverse('campus_club_members', args=[self.robotics.pk]), {
            'email': self.student.email, 'role': 'COMMITTEE'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_members_cannot_manage_members_and_staff_roles_are_not_touched_here(self):
        membership = RoleAssignment.objects.current().get(user=self.president, unit=self.robotics)
        url = reverse('campus_club_member', args=[self.robotics.pk, membership.pk])
        self.assertEqual(self.as_user(self.member).delete(url).status_code, status.HTTP_403_FORBIDDEN)
        advisor_role = RoleAssignment.objects.current().get(user=self.advisor, unit=self.robotics)
        self.assertEqual(self.as_user(self.president).delete(
            reverse('campus_club_member', args=[self.robotics.pk, advisor_role.pk])).status_code,
            status.HTTP_404_NOT_FOUND)

    def test_removing_and_leaving(self):
        membership = RoleAssignment.objects.current().get(user=self.member, unit=self.robotics)
        self.assertEqual(self.as_user(self.president).delete(
            reverse('campus_club_member', args=[self.robotics.pk, membership.pk])).status_code,
            status.HTTP_204_NO_CONTENT)
        self.assertFalse(RoleAssignment.objects.current().filter(user=self.member, unit=self.robotics).exists())
        self.assertEqual(self.as_user(self.president).post(reverse('campus_club_leave', args=[self.robotics.pk]))
                         .status_code, status.HTTP_204_NO_CONTENT)


class AnnouncementTests(ClubTestBase):
    def test_the_committee_posts_and_members_read_and_comment(self):
        url = reverse('campus_announcements', args=[self.robotics.pk])
        res = self.as_user(self.president).post(url, {'title': 'Meeting Friday', 'body': 'Lab 3, 8pm'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(self.as_user(self.member).post(url, {'title': 'x', 'body': 'y'}, format='json').status_code,
                         status.HTTP_403_FORBIDDEN)
        self.assertEqual([a['title'] for a in self.client.get(url).data], ['Meeting Friday'])
        self.assertEqual(self.as_user(self.outsider).get(url).status_code, status.HTTP_403_FORBIDDEN)

        comments = reverse('campus_comments', args=[self.robotics.pk, res.data['id']])
        comment = self.as_user(self.member).post(comments, {'body': 'See you there'}, format='json').data
        self.as_user(self.advisor).post(reverse('campus_comment_hide', args=[self.robotics.pk, comment['id']]),
                                        {'hidden': True}, format='json')
        # Hidden from other members, still visible to its author and to the managers
        other = make_user('other.member@s.unikl.edu.my', User.Role.STUDENT)
        appoint(other, R.MEMBER, self.robotics)
        self.assertEqual(self.as_user(other).get(comments).data, [])
        self.assertEqual(len(self.as_user(self.member).get(comments).data), 1)
        self.assertEqual(len(self.as_user(self.president).get(comments).data), 1)


class ClubProposalTests(ClubTestBase):
    def setUp(self):
        super().setUp()
        self.head_sd = make_user('hos.sd@unikl.edu.my', User.Role.STAFF, 'Head SD')
        appoint(self.head_sd, R.HEAD_OF_SECTION, self.sd)
        self.dd_sdcl_person = make_user('dd.sdcl@unikl.edu.my', User.Role.STAFF, 'DD SDCL')
        appoint(self.dd_sdcl_person, R.DEPUTY_DEAN, self.dd_sdcl)
        self.dd_at_person = make_user('dd.at@unikl.edu.my', User.Role.STAFF, 'DD AT')
        appoint(self.dd_at_person, R.DEPUTY_DEAN, OrgUnit.objects.get(short_name='DD A&T'))
        self.founder = make_user('founder@s.unikl.edu.my', User.Role.STUDENT, 'Fauzi Founder')

    def propose(self, **overrides):
        body = {'section': self.sd.pk, 'name': 'Photography Club', 'club_type': 'CULTURAL',
                'dna_category': 'ACTIVE_PROGRAMME', 'merit_elements': ['SOCIAL'],
                'description': 'Workshops and exhibitions.', 'objectives': ['Teach photography', 'Run an exhibition'],
                'proposed_activities': [{'name': 'Photo walk', 'cost': '50.00'}],
                'budget_items': [{'item': 'Printing', 'cost': '120.00'}],
                'proposed_advisor_email': 'advisor@unikl.edu.my',
                'founding_members': ['Founder@s.unikl.edu.my', 'not.yet.signed.up@s.unikl.edu.my']}
        body.update(overrides)
        with self.captureOnCommitCallbacks(execute=True):
            return self.as_user(self.student).post(reverse('campus_club_proposals'), body, format='json')

    def decide(self, user, approval_id, approve=True, comment=''):
        with self.captureOnCommitCallbacks(execute=True):
            return self.as_user(user).post(reverse('campus_approval_decide', args=[approval_id]),
                                           {'approve': approve, 'comment': comment}, format='json')

    def test_three_signatures_create_the_club_with_its_people(self):
        res = self.propose()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        approval_id = res.data['approval_id']
        self.assertEqual(mail.outbox[-1].to, ['advisor@unikl.edu.my'])  # step 1 is the named advisor

        # Out of order or the wrong office: refused
        self.assertEqual(self.decide(self.head_sd, approval_id).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.decide(self.advisor, approval_id).status_code, status.HTTP_200_OK)
        self.assertEqual(self.decide(self.head_sd, approval_id).status_code, status.HTTP_200_OK)
        self.assertEqual(self.decide(self.dd_at_person, approval_id).status_code, status.HTTP_403_FORBIDDEN)
        inbox = self.as_user(self.dd_sdcl_person).get(reverse('campus_approvals')).data
        self.assertEqual([i['id'] for i in inbox], [approval_id])
        final = self.decide(self.dd_sdcl_person, approval_id)
        self.assertEqual(final.data['status'], 'APPROVED')

        proposal = ClubProposal.objects.get(pk=res.data['id'])
        club = proposal.created_club
        self.assertEqual((club.parent, club.sector, club.club.dna_category), (self.sd, 'SD', 'ACTIVE_PROGRAMME'))
        current = {(a.user.email, a.role, a.position) for a in RoleAssignment.objects.current().filter(unit=club)}
        self.assertEqual(current, {('advisor@unikl.edu.my', R.ADVISOR, ''),
                                   ('aina@s.unikl.edu.my', R.COMMITTEE, 'President'),
                                   ('founder@s.unikl.edu.my', R.MEMBER, '')})
        self.assertIn(f'/campus/clubs/{club.pk}', mail.outbox[-1].body)

    def test_a_rejection_needs_a_reason_and_stops_the_chain(self):
        approval_id = self.propose().data['approval_id']
        self.decide(self.advisor, approval_id)
        self.assertEqual(self.decide(self.head_sd, approval_id, approve=False).status_code,
                         status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.decide(self.head_sd, approval_id, False, 'Too close to the Camera Club').data['status'],
                         'REJECTED')
        request = ApprovalRequest.objects.get(pk=approval_id)
        self.assertEqual([s.decision for s in request.steps.all()], ['APPROVED', 'REJECTED', 'SKIPPED'])
        self.assertEqual(ClubProposal.objects.get().status, ClubProposal.Status.REJECTED)
        self.assertIn('Too close to the Camera Club', mail.outbox[-1].body)

    def test_the_advisor_must_be_a_staff_account_and_names_must_be_new(self):
        self.assertEqual(self.propose(proposed_advisor_email='member@s.unikl.edu.my').status_code,
                         status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.propose(name='robotics club').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.propose(objectives=[]).status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_students_propose_and_the_proposer_can_withdraw(self):
        self.client.force_authenticate(self.advisor)
        self.assertEqual(self.client.post(reverse('campus_club_proposals'), {}, format='json').status_code,
                         status.HTTP_403_FORBIDDEN)
        approval_id = self.propose().data['approval_id']
        self.assertEqual(self.as_user(self.outsider).post(reverse('campus_approval_withdraw', args=[approval_id]))
                         .status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.as_user(self.student).post(reverse('campus_approval_withdraw', args=[approval_id]))
                         .data['status'], 'WITHDRAWN')
        self.assertEqual(ClubProposal.objects.get().status, ClubProposal.Status.WITHDRAWN)

    def test_who_can_open_a_request(self):
        approval_id = self.propose().data['approval_id']
        url = reverse('campus_approval', args=[approval_id])
        self.assertEqual(self.as_user(self.outsider).get(url).status_code, status.HTTP_403_FORBIDDEN)
        # The Deputy Dean can open it before their step is reached
        data = self.as_user(self.dd_sdcl_person).get(url).data
        self.assertFalse(data['can_sign'])
        self.assertEqual(data['target']['name'], 'Photography Club')
        self.assertEqual(self.as_user(self.dd_sdcl_person).get(reverse('campus_me')).data['pending_approvals'], 0)
        self.assertEqual(self.as_user(self.advisor).get(reverse('campus_me')).data['pending_approvals'], 1)


class NewsTests(ClubTestBase):
    def setUp(self):
        super().setUp()
        self.executive = make_user('exec.cl@unikl.edu.my', User.Role.STAFF, 'CL Executive')
        appoint(self.executive, R.SECTION_EXECUTIVE, self.cl)

    def test_a_student_post_waits_for_sdcl(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.as_user(self.student).post(reverse('campus_news'), {
                'campus': self.miit.pk, 'title': 'Game of Hackers', 'body': 'Register now', 'ghocs_claimable': True,
                'activity_level': 'NATIONAL', 'dna_category': 'GRADUATE', 'merit_elements': ['INTELLECTUAL'],
                'starts_on': '2026-12-04'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['status'], 'PENDING')
        self.assertEqual(self.client.get(reverse('campus_news')).data, [])
        self.assertIn('exec.cl@unikl.edu.my', [m.to[0] for m in mail.outbox])  # any section executive may approve
        with self.captureOnCommitCallbacks(execute=True):
            self.as_user(self.executive).post(reverse('campus_approval_decide', args=[res.data['approval_id']]),
                                              {'approve': True}, format='json')
        published = self.client.get(reverse('campus_news')).data
        self.assertEqual([p['title'] for p in published], ['Game of Hackers'])
        self.assertTrue(published[0]['ghocs_claimable'])

    def test_a_ghocs_claimable_post_needs_its_ghocs_details(self):
        res = self.as_user(self.student).post(reverse('campus_news'), {
            'campus': self.miit.pk, 'title': 'Hike', 'body': 'Saturday', 'ghocs_claimable': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('dna_category', res.data)

    def test_sdcl_staff_publish_straight_away(self):
        res = self.as_user(self.executive).post(reverse('campus_news'), {
            'campus': self.miit.pk, 'title': 'Library hours', 'body': 'Open late'}, format='json')
        self.assertEqual(res.data['status'], 'PUBLISHED')
        self.assertFalse(ApprovalRequest.objects.exists())
        self.assertEqual(NewsPost.objects.get().status, NewsPost.Status.PUBLISHED)


class SessionTests(ClubTestBase):
    def test_sessions_cannot_overlap(self):
        admin = make_user('sdcl@unikl.edu.my', User.Role.STAFF)
        appoint(admin, R.CAMPUS_ADMIN, self.miit)
        res = self.as_user(admin).post(reverse('campus_sessions'), {
            'campus': self.miit.pk, 'label': 'Overlap', 'starts_on': str(self.session.ends_on - timedelta(days=5)),
            'ends_on': str(self.session.ends_on + timedelta(days=100))}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        ok = self.client.post(reverse('campus_sessions'), {
            'campus': self.miit.pk, 'label': '2026/2027 Sem 2', 'starts_on': str(self.session.ends_on + timedelta(days=1)),
            'ends_on': str(self.session.ends_on + timedelta(days=120))}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)
        self.assertEqual(self.as_user(self.student).post(reverse('campus_sessions'), {}, format='json').status_code,
                         status.HTTP_400_BAD_REQUEST)
