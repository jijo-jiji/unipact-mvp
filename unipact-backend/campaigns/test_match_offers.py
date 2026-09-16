from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign, ClientAsset, MatchOffer
from users.models import User, CompanyProfile, StudentProfile


def make_student(email, name):
    user = User.objects.create_user(username=email, email=email, password='Blue-Kettle-Run-88', role=User.Role.STUDENT)
    profile = StudentProfile.objects.create(user=user, full_name=name, university='UM', verification_status='VERIFIED')
    return user, profile


class MatchOfferFlowTests(APITestCase):
    """Wireframe §9: the admin's pick is an offer the student accepts before the company confirms."""

    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password='AdminPass123!', role=User.Role.ADMIN)
        self.company_user = User.objects.create_user(username='co@x.com', email='co@x.com', password='CoPass123!', role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='Co', tier=CompanyProfile.Tier.PRO, verification_status='VERIFIED')
        self.ali_user, self.ali = make_student('ali@x.my', 'Ali')
        self.mei_user, self.mei = make_student('mei@x.my', 'Mei')
        self.campaign = Campaign.objects.create(company=self.company, title='CRM', description='d', type='SOFTWARE_DEVELOPMENT', budget=2000, status=Campaign.Status.OPEN)
        ClientAsset.objects.create(campaign=self.campaign, title='brief.pdf', file='client_assets/brief.pdf')

    def match(self, *students, notes='Good fit'):
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('admin_matchmaking_assign', kwargs={'campaign_id': self.campaign.id}),
                                    {'student_ids': [s.id for s in students], 'match_notes': notes}, format='json')

    def respond(self, user, action, **extra):
        self.client.force_authenticate(user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('respond_match_offer', kwargs={'campaign_id': self.campaign.id}), {'action': action, **extra}, format='json')

    def finalize(self):
        self.client.force_authenticate(self.company_user)
        return self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')

    def test_team_must_all_accept_before_company_can_confirm(self):
        self.match(self.ali, self.mei)
        self.assertEqual(MatchOffer.objects.filter(status='PENDING').count(), 2)
        self.assertEqual(self.finalize().status_code, status.HTTP_400_BAD_REQUEST)

        mail.outbox.clear()
        self.respond(self.ali_user, 'accept')
        self.assertEqual(mail.outbox, [])  # Mei hasn't answered yet, so the company isn't told
        self.assertEqual(self.finalize().status_code, status.HTTP_400_BAD_REQUEST)

        self.respond(self.mei_user, 'accept')
        self.assertEqual([m.to for m in mail.outbox], [['co@x.com']])
        self.assertEqual(self.finalize().status_code, status.HTTP_200_OK)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.IN_PROGRESS)

    def test_pending_student_sees_brief_but_not_client_files_or_submissions(self):
        self.match(self.ali)
        self.client.force_authenticate(self.ali_user)
        assigned = self.client.get(reverse('student_assigned_jobs')).data
        self.assertEqual(assigned[0]['my_offer']['status'], 'PENDING')
        self.assertTrue(assigned[0]['awaiting_student_acceptance'])

        detail = self.client.get(reverse('campaign_detail', kwargs={'pk': self.campaign.id})).data
        self.assertNotIn('client_assets', detail)
        self.assertEqual(self.client.get(reverse('client_assets', kwargs={'campaign_id': self.campaign.id})).status_code, 403)
        self.assertEqual(self.client.post(reverse('student_submit_deliverable', kwargs={'campaign_id': self.campaign.id}),
                                          {'title': 'x', 'external_url': 'https://github.com/a/b'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(reverse('project_team_invite', kwargs={'campaign_id': self.campaign.id}),
                                          {'email': 'friend@x.my'}, format='json').status_code, 403)

        self.respond(self.ali_user, 'accept')
        self.assertEqual(len(self.client.get(reverse('campaign_detail', kwargs={'pk': self.campaign.id})).data['client_assets']), 1)

    def test_decline_returns_project_to_queue_and_emails_admins(self):
        self.match(self.ali)
        mail.outbox.clear()
        res = self.respond(self.ali_user, 'decline', reason='Exams that month')
        self.assertEqual(res.status_code, 200)

        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.OPEN)
        self.assertFalse(self.campaign.assigned_students.exists())
        self.assertEqual(mail.outbox[0].to, ['admin@x.my'])
        self.assertIn('Exams that month', mail.outbox[0].body)
        # The declined project disappears from the student's dashboard, and the offer can't be reused
        self.assertEqual(self.client.get(reverse('student_assigned_jobs')).data, [])
        self.assertEqual(self.respond(self.ali_user, 'accept').status_code, 400)

    def test_partial_decline_keeps_the_rest_of_the_team(self):
        self.match(self.ali, self.mei)
        self.respond(self.ali_user, 'accept')
        self.respond(self.mei_user, 'decline')
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.MATCHED)
        self.assertEqual(list(self.campaign.assigned_students.all()), [self.ali])

        # Company sees only who is still on the team, never the decline or its reason
        self.client.force_authenticate(self.company_user)
        offers = self.client.get(reverse('campaign_detail', kwargs={'pk': self.campaign.id})).data['match_offers']
        self.assertEqual([(o['student_name'], o['status']) for o in offers], [('Ali', 'ACCEPTED')])
        self.assertNotIn('decline_reason', offers[0])

    def test_rematching_keeps_acceptances_reoffers_decliners_and_withdraws_removed(self):
        self.match(self.ali, self.mei)
        self.respond(self.ali_user, 'accept')
        self.respond(self.mei_user, 'decline')

        mail.outbox.clear()
        self.match(self.mei)  # admin swaps Ali out and asks Mei again
        statuses = dict(MatchOffer.objects.values_list('student__full_name', 'status'))
        self.assertEqual(statuses, {'Ali': 'WITHDRAWN', 'Mei': 'PENDING'})
        self.assertEqual({tuple(m.to) for m in mail.outbox}, {('mei@x.my',), ('ali@x.my',)})

        self.match(self.ali, self.mei)  # re-adding Ali asks him again
        self.assertEqual(MatchOffer.objects.get(student=self.ali).status, 'PENDING')

    def test_only_the_offered_student_can_respond(self):
        self.match(self.ali)
        self.assertEqual(self.respond(self.mei_user, 'accept').status_code, 404)
        self.assertEqual(self.respond(self.company_user, 'accept').status_code, 403)
        self.assertEqual(self.respond(self.ali_user, 'maybe').status_code, 400)

    def test_admin_lock_also_waits_for_acceptance(self):
        self.match(self.ali)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json').status_code, 400)
