from decimal import Decimal
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import User, CompanyProfile, StudentProfile
from campaigns.models import Campaign, ClientAsset, ProjectTeamInvitation
from payments.models import Transaction


def make_student(email, name, **extra):
    user = User.objects.create_user(username=email, email=email, password='StudentPass123!', role=User.Role.STUDENT, is_verified=True)
    profile = StudentProfile.objects.create(user=user, full_name=name, university='UM', verification_status='VERIFIED', **extra)
    return user, profile


class CampaignAccessControlTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password='AdminPass123!', role=User.Role.ADMIN)
        self.company_user = User.objects.create_user(username='co@x.com', email='co@x.com', password='CoPass123!', role=User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='Co', tier=CompanyProfile.Tier.FREE, verification_status='VERIFIED')
        self.lead_user, self.lead = make_student('lead@x.my', 'Lead')
        self.outsider_user, self.outsider = make_student('out@x.my', 'Outsider')
        self.campaign = Campaign.objects.create(company=self.company, title='Portal', description='d', type='SOFTWARE_DEVELOPMENT', budget=1000, status=Campaign.Status.IN_PROGRESS)
        self.campaign.assigned_students.add(self.lead)
        ClientAsset.objects.create(campaign=self.campaign, title='brief.pdf', file='client_assets/brief.pdf')

    def test_non_owner_cannot_edit_or_delete_campaign(self):
        url = reverse('campaign_detail', kwargs={'pk': self.campaign.id})
        self.client.force_authenticate(user=self.outsider_user)
        self.assertEqual(self.client.patch(url, {'title': 'Hacked'}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Campaign.objects.filter(id=self.campaign.id, title='Portal').exists())

    def test_company_cannot_self_assign_students_on_create(self):
        self.client.force_authenticate(user=self.company_user)
        res = self.client.post(reverse('campaign_list_create'), {
            'title': 'New', 'description': 'd', 'type': 'SOFTWARE_DEVELOPMENT', 'budget': '500.00',
            'assigned_students': [self.outsider.id], 'match_notes': 'self-matched'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Campaign.objects.get(id=res.data['id'])
        self.assertEqual(created.assigned_students.count(), 0)
        self.assertEqual(created.match_notes, '')

    def test_company_cannot_set_fee_or_payment_structure_on_create(self):
        self.client.force_authenticate(user=self.company_user)
        res = self.client.post(reverse('campaign_list_create'), {
            'title': 'New', 'description': 'd', 'type': 'SOFTWARE_DEVELOPMENT', 'budget': '500.00',
            'platform_fee_percent': '0.00', 'payment_structure': 'MANUAL',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Campaign.objects.get(id=res.data['id'])
        self.assertIsNone(created.platform_fee_percent)
        self.assertEqual(created.payment_structure, Campaign.PaymentStructure.UPFRONT)

    def test_campaign_shows_students_their_pay_after_the_service_fee(self):
        url = reverse('campaign_detail', kwargs={'pk': self.campaign.id})
        self.client.force_authenticate(user=self.lead_user)
        res = self.client.get(url)
        self.assertEqual((res.data['student_pool'], res.data['service_fee_percent']), ('900.00', '10'))

        self.campaign.platform_fee_percent = Decimal('12.50')
        self.campaign.save()
        res = self.client.get(url)
        self.assertEqual((res.data['student_pool'], res.data['service_fee_percent']), ('875.00', '12.5'))

    def test_private_workspace_fields_hidden_from_outsiders(self):
        url = reverse('campaign_detail', kwargs={'pk': self.campaign.id})
        self.client.force_authenticate(user=self.outsider_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn('client_assets', res.data)

        self.client.force_authenticate(user=self.lead_user)
        res = self.client.get(url)
        self.assertEqual(len(res.data['client_assets']), 1)

    def test_team_list_restricted_to_team(self):
        url = reverse('project_team_list', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(user=self.outsider_user)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.lead_user)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

    def test_team_invite_accepts_invitee_email_and_validates_share(self):
        url = reverse('project_team_invite', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(user=self.lead_user)

        bad = self.client.post(url, {'invitee_email': 'out@x.my', 'payout_share_percentage': 150}, format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        ok = self.client.post(url, {'invitee_email': 'out@x.my', 'role_in_project': 'Designer', 'payout_share_percentage': '30'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ok.data['campaign_company_name'], 'Co')
        self.assertEqual(ProjectTeamInvitation.objects.get(id=ok.data['id']).payout_share_percentage, 30)

    def test_team_invite_rejected_once_accepted_shares_would_exceed_100_percent(self):
        url = reverse('project_team_invite', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(user=self.lead_user)

        first = self.client.post(url, {'invitee_email': 'out@x.my', 'payout_share_percentage': '70'}, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.outsider_user)
        accept = self.client.post(reverse('respond_team_invitation', kwargs={'invitation_id': first.data['id']}), {'action': 'accept'}, format='json')
        self.assertEqual(accept.status_code, status.HTTP_200_OK)

        # Another 40% would push the team's committed split to 110%
        self.client.force_authenticate(user=self.lead_user)
        second = self.client.post(url, {'invitee_email': 'fourth@x.my', 'payout_share_percentage': '40'}, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('100%', second.data['error'])

    def test_student_shares_never_exceed_100_percent_even_if_data_is_malformed(self):
        """The invite endpoint blocks over-committing shares, but campaign_student_shares (the
        last line of defense before payouts are computed) must stay safe even if bad data gets in
        some other way - directly via the ORM/admin, a bug, or old data from before that guard existed."""
        from campaigns.utils import campaign_student_shares

        third_user, third = make_student('third@x.my', 'Third')
        self.campaign.assigned_students.add(self.outsider, third)
        ProjectTeamInvitation.objects.create(
            campaign=self.campaign, invited_by=self.lead, invitee_email='out@x.my', invitee_student=self.outsider,
            payout_share_percentage=60, status=ProjectTeamInvitation.Status.ACCEPTED,
        )
        ProjectTeamInvitation.objects.create(
            campaign=self.campaign, invited_by=self.lead, invitee_email='third@x.my', invitee_student=third,
            payout_share_percentage=60, status=ProjectTeamInvitation.Status.ACCEPTED,
        )

        shares = campaign_student_shares(self.campaign)
        self.assertEqual(sum(shares.values()), Decimal('100'))
        # Proportionally scaled down from 60/60 (raw sum 120) rather than clamped unevenly
        self.assertEqual(shares[self.outsider.id], shares[third.id])

    def test_student_deliverable_requires_file_or_valid_link(self):
        url = reverse('student_submit_deliverable', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(user=self.lead_user)
        self.assertEqual(self.client.post(url, {'title': 'x'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.post(url, {'title': 'x', 'external_url': 'not a url'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.post(url, {'title': 'x', 'external_url': 'https://github.com/a/b'}, format='json').status_code, status.HTTP_201_CREATED)

    def test_only_owner_rating_is_applied_on_completion(self):
        url = reverse('campaign_complete', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(user=self.lead_user)
        res = self.client.post(url, {'rating': 1}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.rating, Decimal('5.00'))

    def test_owner_rating_out_of_range_rejected(self):
        url = reverse('campaign_complete', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(user=self.company_user)
        self.assertEqual(self.client.post(url, {'rating': 9}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_finalize_matched_campaign(self):
        self.campaign.status = Campaign.Status.MATCHED
        self.campaign.save()
        self.client.force_authenticate(user=self.admin)
        plan_url = reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id})
        plan_res = self.client.post(plan_url, {'milestones': [{'title': 'Delivery', 'percentage': 100}]}, format='json')
        self.assertEqual(plan_res.status_code, status.HTTP_201_CREATED)

        res = self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {'mock_pay': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['campaign']['status'], 'IN_PROGRESS')

    def test_admin_finalize_without_mock_pay_requires_real_payment(self):
        self.campaign.status = Campaign.Status.MATCHED
        self.campaign.save()
        self.client.force_authenticate(user=self.admin)
        self.client.post(reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id}), {'milestones': [{'title': 'Delivery', 'percentage': 100}]}, format='json')

        # An admin's "Lock & start" click sends no body - it must NOT silently fabricate a payment
        res = self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertFalse(Transaction.objects.filter(related_campaign=self.campaign, transaction_type=Transaction.Type.PROJECT_FEE).exists())

    @override_settings(MOCK_PAYMENTS_ENABLED=False)
    def test_without_demo_checkout_client_cannot_self_certify_payment(self):
        self.campaign.status = Campaign.Status.MATCHED
        self.campaign.save()
        self.client.force_authenticate(user=self.admin)
        self.client.post(reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id}), {'milestones': [{'title': 'Delivery', 'percentage': 100}]}, format='json')

        self.client.force_authenticate(user=self.company_user)
        url = reverse('finalize_match', kwargs={'campaign_id': self.campaign.id})
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(url, {'mock_pay': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertEqual(res.data['payment_method'], 'bank_transfer')
        self.assertFalse(Transaction.objects.filter(related_campaign=self.campaign).exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('admin@x.my', mail.outbox[0].to + mail.outbox[0].bcc)
        self.assertIn('RM 1000', mail.outbox[0].body)

        # Once an admin records the bank transfer, the client can confirm
        self.client.force_authenticate(user=self.admin)
        detail = self.client.get(reverse('campaign_detail', kwargs={'pk': self.campaign.id}))
        self.assertEqual((detail.data['escrow']['outstanding'], detail.data['escrow']['payments']), (Decimal('1000.00'), []))
        recorded = self.client.post(reverse('admin_record_client_payment', kwargs={'campaign_id': self.campaign.id}), {'amount': '1000.00', 'reference': 'IBG-123'}, format='json')
        self.assertEqual(recorded.data['escrow']['outstanding'], Decimal('0.00'))
        self.assertEqual([p['reference'] for p in recorded.data['escrow']['payments']], ['IBG-123'])
        self.client.force_authenticate(user=self.company_user)
        self.assertEqual(self.client.post(url, {}, format='json').status_code, status.HTTP_200_OK)

    def test_matching_rejected_for_in_progress_campaign(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('admin_matchmaking_assign', kwargs={'campaign_id': self.campaign.id}), {'student_ids': [self.outsider.id]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class UserAndAdminFixTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password='AdminPass123!', role=User.Role.ADMIN)

    def test_duplicate_company_email_returns_400(self):
        payload = {'accept_terms': True, 'email': 'dup@corp.com', 'password': 'Pass12345!', 'company_name': 'Dup'}
        self.assertEqual(self.client.post(reverse('register_company'), payload, format='json').status_code, status.HTTP_201_CREATED)
        self.client.cookies.clear()
        res = self.client.post(reverse('register_company'), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', res.data['error'])

    def test_student_registration_saves_skills_and_bio_from_multipart(self):
        res = self.client.post(reverse('register_student'), {'accept_terms': True, 
            'full_name': 'Aina', 'email': 'aina@siswa.my', 'password': 'Pass12345!', 'university': 'UM',
            'skills': '["React", " Django "]', 'bio': 'Builder'
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        profile = StudentProfile.objects.get(user__email='aina@siswa.my')
        self.assertEqual(profile.skills, ['React', 'Django'])
        self.assertEqual(profile.bio, 'Builder')

    def test_admin_verify_rejects_missing_action(self):
        _, student = make_student('s@x.my', 'S')
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin_verify', kwargs={'entity_type': 'STUDENT', 'entity_id': student.id})
        self.assertEqual(self.client.post(url, {}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_block_route_toggles_user(self):
        user, _ = make_student('b@x.my', 'B')
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('admin_block_user', kwargs={'user_id': user.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['is_active'])
        self.assertEqual(self.client.post(reverse('admin_block_user', kwargs={'user_id': self.admin.id})).status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_student_pool_returns_profile_ids(self):
        user, profile = make_student('p@x.my', 'Pool')
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(reverse('admin_student_pool'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        row = next(r for r in res.data if r['email'] == 'p@x.my')
        self.assertEqual(row['id'], profile.id)
        self.assertEqual(row['user_id'], user.id)

    def test_student_public_profile_looks_up_by_user_id(self):
        make_student('one@x.my', 'One')
        second_user, _ = make_student('two@x.my', 'Two')
        res = self.client.get(reverse('student_public_profile', kwargs={'user_id': second_user.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['full_name'], 'Two')
        self.assertEqual(res.data['user_id'], second_user.id)

    def test_token_refresh_from_cookie(self):
        user, _ = make_student('r@x.my', 'R')
        self.client.cookies['refresh_token'] = str(RefreshToken.for_user(user))
        res = self.client.post(reverse('token_refresh'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', res.cookies)

        self.client.cookies['refresh_token'] = 'garbage'
        self.assertEqual(self.client.post(reverse('token_refresh')).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_for_deleted_or_blocked_account_is_401_not_500(self):
        blocked_user, _ = make_student('blocked@x.my', 'Blocked')
        deleted_user, _ = make_student('gone@x.my', 'Gone')
        blocked_token, deleted_token = str(RefreshToken.for_user(blocked_user)), str(RefreshToken.for_user(deleted_user))
        blocked_user.is_active = False
        blocked_user.save()
        deleted_user.delete()

        for token in (blocked_token, deleted_token):
            self.client.cookies['refresh_token'] = token
            res = self.client.post(reverse('token_refresh'))
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
            self.assertEqual(res.cookies['refresh_token'].value, '')  # dead session cookie is cleared


class MockCheckoutTests(APITestCase):
    @override_settings(MOCK_PAYMENTS_ENABLED=False)
    def test_demo_checkout_is_closed_when_disabled(self):
        user = User.objects.create_user(username='pay@corp.com', email='pay@corp.com', password='Pass12345!', role=User.Role.COMPANY)
        company = CompanyProfile.objects.create(user=user, company_name='Pay', verification_status='VERIFIED')
        tx = Transaction.objects.create(company=company, amount=499, transaction_type='SUBSCRIPTION', status='PENDING', stripe_payment_id='pi_mock_x')
        self.client.force_authenticate(user=user)
        for res in (
            self.client.post(reverse('create_intent'), {'amount': '499', 'type': 'SUBSCRIPTION'}, format='json'),
            self.client.post(reverse('mock_checkout', args=[tx.id])),
            self.client.post(reverse('confirm_payment', args=[tx.id])),
        ):
            self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        company.refresh_from_db()
        self.assertEqual(company.tier, CompanyProfile.Tier.FREE)

    def test_checkout_then_confirm_succeeds_and_upgrades(self):
        user = User.objects.create_user(username='pay@corp.com', email='pay@corp.com', password='Pass12345!', role=User.Role.COMPANY)
        company = CompanyProfile.objects.create(user=user, company_name='Pay', verification_status='VERIFIED')
        self.client.force_authenticate(user=user)

        intent = self.client.post(reverse('create_intent'), {'amount': '499', 'type': 'SUBSCRIPTION'}, format='json')
        self.assertEqual(intent.status_code, status.HTTP_200_OK)
        tx_id = intent.data['transactionId']

        self.assertEqual(self.client.post(reverse('mock_checkout', args=[tx_id])).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.post(reverse('confirm_payment', args=[tx_id])).status_code, status.HTTP_200_OK)

        self.assertEqual(Transaction.objects.get(id=tx_id).status, Transaction.Status.SUCCESS)
        company.refresh_from_db()
        self.assertEqual(company.tier, CompanyProfile.Tier.PRO)
