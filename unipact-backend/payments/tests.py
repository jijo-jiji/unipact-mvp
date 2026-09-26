from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Campaign
from payments.models import Payout, Transaction
from users.models import CompanyProfile, StudentProfile

User = get_user_model()


class StudentPayoutTests(APITestCase):
    def setUp(self):
        # Create Student User & Profile with Bank Details
        self.student_user = User.objects.create_user(
            username='student_test',
            email='student.payout@test.com',
            password='password123',
            role=User.Role.STUDENT,
            is_verified=True,
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Ali bin Abu',
            university='Universiti Malaya (UM)',
            bank_name='Maybank',
            bank_account_number='114012345678',
            bank_account_holder_name='Ali bin Abu',
            duitnow_id='0123456789',
        )

        # Create Company & Campaign
        self.company_user = User.objects.create_user(
            username='comp_test',
            email='comp.payout@test.com',
            password='password123',
            role=User.Role.COMPANY,
            is_verified=True,
        )
        self.company_profile = CompanyProfile.objects.create(
            user=self.company_user,
            company_name='Nexus Tech Sdn Bhd',
        )
        self.campaign = Campaign.objects.create(
            company=self.company_profile,
            title='Web Portal MVP',
            type=Campaign.Type.SOFTWARE_DEVELOPMENT,
            budget=Decimal('2000.00'),
            status=Campaign.Status.IN_PROGRESS,
        )
        self.campaign.assigned_students.add(self.student_profile)

        # Create a Payout
        self.payout = Payout.objects.create(
            campaign=self.campaign,
            student=self.student_profile,
            amount=Decimal('2000.00'),
            status=Payout.Status.PROCESSING,
            bank_name=self.student_profile.bank_name,
            bank_account_number=self.student_profile.bank_account_number,
            bank_account_holder_name=self.student_profile.bank_account_holder_name,
        )

    def test_student_can_fetch_payouts(self):
        self.client.force_authenticate(user=self.student_user)
        url = reverse('student_payouts_me')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_bank_details'])
        self.assertEqual(Decimal(str(response.data['pending_amount'])), Decimal('2000.00'))
        self.assertEqual(Decimal(str(response.data['total_earned'])), Decimal('0.00'))
        self.assertEqual(len(response.data['payouts']), 1)
        self.assertEqual(response.data['payouts'][0]['campaign_title'], 'Web Portal MVP')

    def test_non_student_cannot_fetch_student_payouts(self):
        self.client.force_authenticate(user=self.company_user)
        url = reverse('student_payouts_me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdminPayoutTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='admin_test',
            email='admin.payout@test.com',
            password='password123',
            role=User.Role.ADMIN,
            is_verified=True,
        )
        self.student_user = User.objects.create_user(
            username='student_payout',
            email='student.admin.payout@test.com',
            password='password123',
            role=User.Role.STUDENT,
            is_verified=True,
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Tan Ah Kow',
            university='Sunway University',
            bank_name='CIMB Bank',
            bank_account_number='7001234567',
            bank_account_holder_name='Tan Ah Kow',
        )
        self.company_user = User.objects.create_user(
            username='comp_admin_test',
            email='comp.admin@test.com',
            password='password123',
            role=User.Role.COMPANY,
            is_verified=True,
        )
        self.company_profile = CompanyProfile.objects.create(
            user=self.company_user,
            company_name='Digital Brand PLT',
        )
        self.campaign = Campaign.objects.create(
            company=self.company_profile,
            title='TikTok Marketing Launch',
            type=Campaign.Type.DIGITAL_MARKETING,
            budget=Decimal('1500.00'),
            status=Campaign.Status.IN_PROGRESS,
        )
        self.payout = Payout.objects.create(
            campaign=self.campaign,
            student=self.student_profile,
            amount=Decimal('1500.00'),
            status=Payout.Status.PROCESSING,
            bank_name=self.student_profile.bank_name,
            bank_account_number=self.student_profile.bank_account_number,
            bank_account_holder_name=self.student_profile.bank_account_holder_name,
        )

    def test_admin_can_list_payouts(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_payouts_list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count_ready'], 1)
        self.assertEqual(len(response.data['payouts']), 1)

    def test_admin_records_payout_disbursement(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_record_payout', kwargs={'pk': self.payout.id})

        # Missing transfer reference
        res_fail = self.client.post(url, {'transfer_reference': ''})
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Successful disbursement
        res_success = self.client.post(url, {
            'transfer_reference': 'MBB-20260918-9921',
            'notes': 'Paid via Maybank Instant Transfer.'
        })
        self.assertEqual(res_success.status_code, status.HTTP_200_OK)

        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, Payout.Status.PAID)
        self.assertEqual(self.payout.transfer_reference, 'MBB-20260918-9921')
        self.assertIsNotNone(self.payout.paid_at)


class MilestoneApprovalGeneratesPayoutTests(APITestCase):
    """Managed-escrow model: the client pays the full project fee, UniPact keeps its cut,
    and approving a milestone releases that slice of the remaining pool to the student -
    but only once the money to cover it has actually been collected."""

    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='admin_escrow', email='admin.escrow@test.com', password='password123',
            role=User.Role.ADMIN, is_verified=True,
        )
        self.company_user = User.objects.create_user(
            username='company_client', email='client@agency.my', password='password123',
            role=User.Role.COMPANY, is_verified=True,
        )
        self.company_profile = CompanyProfile.objects.create(
            user=self.company_user, company_name='Creative Agency Sdn Bhd',
        )

        self.student_user = User.objects.create_user(
            username='talent_student', email='talent@um.edu.my', password='password123',
            role=User.Role.STUDENT, is_verified=True,
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Nurul Huda',
            university='Universiti Malaya (UM)',
            bank_name='Bank Islam',
            bank_account_number='120381029381',
            bank_account_holder_name='Nurul Huda',
        )

        # RM3000 project, default 10% platform cut -> RM2700 student pool.
        self.campaign = Campaign.objects.create(
            company=self.company_profile,
            title='ESG Tracking Portal',
            type=Campaign.Type.SOFTWARE_DEVELOPMENT,
            budget=Decimal('3000.00'),
            status=Campaign.Status.IN_PROGRESS,
        )
        self.campaign.assigned_students.add(self.student_profile)

        self.client.force_authenticate(user=self.admin_user)
        plan_res = self.client.post(reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id}), {
            'milestones': [
                {'title': 'Kickoff draft', 'percentage': 40},
                {'title': 'Final delivery', 'percentage': 60},
            ]
        }, format='json')
        assert plan_res.status_code == 201, plan_res.data
        self.milestones = plan_res.data

        self.campaign.is_match_finalized = True
        self.campaign.save(update_fields=['is_match_finalized'])

    def submit_and_review(self, milestone_id, action='approve'):
        self.client.force_authenticate(user=self.student_user)
        self.client.post(reverse('milestone_submit', kwargs={'campaign_id': self.campaign.id, 'milestone_id': milestone_id}),
                          {'deliverable_url': 'https://github.com/nurul/esg'}, format='json')
        self.client.force_authenticate(user=self.company_user)
        return self.client.post(reverse('milestone_review', kwargs={'campaign_id': self.campaign.id, 'milestone_id': milestone_id}),
                                 {'action': action}, format='json')

    def test_approval_blocked_until_client_payment_is_recorded(self):
        first = self.milestones[0]
        res = self.submit_and_review(first['id'])
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertEqual(res.data['code'], 'escrow_insufficient')
        self.assertFalse(Payout.objects.filter(campaign=self.campaign).exists())

    def test_approving_milestone_creates_payout_once_escrow_is_funded(self):
        Transaction.objects.create(
            company=self.company_profile, related_campaign=self.campaign,
            amount=Decimal('3000.00'), transaction_type=Transaction.Type.PROJECT_FEE,
            status=Transaction.Status.SUCCESS,
        )

        first = self.milestones[0]
        self.assertEqual(Decimal(str(first['amount'])), Decimal('1080.00'))  # 40% of the RM2700 pool
        res = self.submit_and_review(first['id'])
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        payouts = Payout.objects.filter(campaign=self.campaign, student=self.student_profile)
        self.assertEqual(payouts.count(), 1)
        p = payouts.first()
        self.assertEqual(p.amount, Decimal('1080.00'))
        self.assertEqual(p.status, Payout.Status.PROCESSING)
        self.assertEqual(p.bank_name, 'Bank Islam')
        self.assertEqual(p.milestone_id, first['id'])

        # Campaign can't be closed out until every milestone is approved
        self.client.force_authenticate(user=self.company_user)
        complete = self.client.post(reverse('campaign_complete', kwargs={'campaign_id': self.campaign.id}), {'rating': 5})
        self.assertEqual(complete.status_code, status.HTTP_400_BAD_REQUEST)

        second = self.milestones[1]
        res2 = self.submit_and_review(second['id'])
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(Payout.objects.filter(campaign=self.campaign).count(), 2)

        complete2 = self.client.post(reverse('campaign_complete', kwargs={'campaign_id': self.campaign.id}), {'rating': 5})
        self.assertEqual(complete2.status_code, status.HTTP_200_OK)

    def test_student_cannot_review_their_own_milestone(self):
        Transaction.objects.create(
            company=self.company_profile, related_campaign=self.campaign,
            amount=Decimal('3000.00'), transaction_type=Transaction.Type.PROJECT_FEE,
            status=Transaction.Status.SUCCESS,
        )
        first = self.milestones[0]
        self.client.force_authenticate(user=self.student_user)
        self.client.post(reverse('milestone_submit', kwargs={'campaign_id': self.campaign.id, 'milestone_id': first['id']}),
                          {'deliverable_url': 'https://github.com/nurul/esg'}, format='json')
        res = self.client.post(reverse('milestone_review', kwargs={'campaign_id': self.campaign.id, 'milestone_id': first['id']}),
                                {'action': 'approve'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Payout.objects.filter(campaign=self.campaign).exists())


class EscrowHardeningTests(APITestCase):
    """Guards around money moving in and out of a project's escrow."""

    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='admin_hard', email='admin.hard@test.com', password='password123', role=User.Role.ADMIN, is_verified=True,
        )
        self.company_user = User.objects.create_user(
            username='hard_co', email='hard.co@test.com', password='password123', role=User.Role.COMPANY, is_verified=True,
        )
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='Hard Co', verification_status='VERIFIED')
        self.student_user = User.objects.create_user(
            username='hard_stu', email='hard.stu@test.com', password='password123', role=User.Role.STUDENT, is_verified=True,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, full_name='Hana', university='UM',
            bank_name='Maybank', bank_account_number='114000001111', bank_account_holder_name='Hana',
        )
        # RM1000 at the default 10% cut -> RM900 student pool
        self.campaign = Campaign.objects.create(
            company=self.company, title='Portal', description='d', type=Campaign.Type.SOFTWARE_DEVELOPMENT,
            budget=Decimal('1000.00'), status=Campaign.Status.MATCHED,
        )
        self.campaign.assigned_students.add(self.student)

    def plan(self, *percentages):
        self.client.force_authenticate(self.admin)
        return self.client.post(reverse('milestone_plan', kwargs={'campaign_id': self.campaign.id}),
                                {'milestones': [{'title': f'M{i}', 'percentage': p} for i, p in enumerate(percentages, 1)]}, format='json')

    def pay(self, amount):
        return Transaction.objects.create(company=self.company, related_campaign=self.campaign, amount=Decimal(amount),
                                          transaction_type=Transaction.Type.PROJECT_FEE, status=Transaction.Status.SUCCESS)

    def approve(self, milestone_id):
        self.client.force_authenticate(self.student_user)
        self.client.post(reverse('milestone_submit', kwargs={'campaign_id': self.campaign.id, 'milestone_id': milestone_id}),
                         {'deliverable_url': 'https://github.com/hana/portal'}, format='json')
        self.client.force_authenticate(self.company_user)
        return self.client.post(reverse('milestone_review', kwargs={'campaign_id': self.campaign.id, 'milestone_id': milestone_id}),
                                {'action': 'approve'}, format='json')

    def test_partial_payment_does_not_unlock_finalize(self):
        self.plan(100)
        self.pay('1.00')
        self.client.force_authenticate(self.company_user)
        res = self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {'mock_pay': False}, format='json')
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertEqual(Decimal(str(res.data['project_fee'])), Decimal('999.00'))  # only asks for the outstanding part

    def test_fractional_milestone_percentages_are_stored_exactly_and_amounts_add_up(self):
        res = self.plan('33.34', '33.33', '33.33')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        stored = list(self.campaign.milestones.order_by('step_number'))
        self.assertEqual(sum(m.percentage for m in stored), Decimal('100'))
        self.assertEqual(sum(m.amount for m in stored), Decimal('900.00'))

        self.assertEqual(self.plan('33.333', '33.333', '33.334').status_code, status.HTTP_400_BAD_REQUEST)

    def test_payouts_split_across_team_add_up_to_the_milestone_exactly(self):
        for n in range(2):
            u = User.objects.create_user(username=f'mate{n}', email=f'mate{n}@test.com', password='password123', role=User.Role.STUDENT)
            self.campaign.assigned_students.add(StudentProfile.objects.create(
                user=u, full_name=f'Mate {n}', university='UM', bank_name='CIMB', bank_account_number=f'70000{n}'))
        milestone_id = self.plan(100).data[0]['id']  # three co-leads -> 33.33% each
        self.campaign.status = Campaign.Status.IN_PROGRESS
        self.campaign.save()
        self.pay('1000.00')

        self.assertEqual(self.approve(milestone_id).status_code, status.HTTP_200_OK)
        self.assertEqual(sum(p.amount for p in Payout.objects.filter(campaign=self.campaign)), Decimal('900.00'))

    def test_duplicate_payout_for_same_milestone_is_rejected_by_the_database(self):
        from django.db import IntegrityError, transaction
        milestone_id = self.plan(100).data[0]['id']
        Payout.objects.create(campaign=self.campaign, student=self.student, milestone_id=milestone_id, amount=Decimal('900.00'))
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payout.objects.create(campaign=self.campaign, student=self.student, milestone_id=milestone_id, amount=Decimal('900.00'))

    def test_admin_recorded_payment_funds_escrow_for_manual_billing(self):
        self.campaign.payment_structure = Campaign.PaymentStructure.MANUAL
        self.campaign.save()
        milestone_id = self.plan(100).data[0]['id']
        self.client.post(reverse('finalize_match', kwargs={'campaign_id': self.campaign.id}), {}, format='json')
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.IN_PROGRESS)  # MANUAL skips the upfront gate

        self.assertEqual(self.approve(milestone_id).status_code, status.HTTP_402_PAYMENT_REQUIRED)  # nothing received yet

        url = reverse('admin_record_client_payment', kwargs={'campaign_id': self.campaign.id})
        self.client.force_authenticate(self.company_user)
        self.assertEqual(self.client.post(url, {'amount': '1000.00', 'reference': 'X'}, format='json').status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(url, {'amount': '1500.00', 'reference': 'MBB-1'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.post(url, {'amount': '1000.00'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        ok = self.client.post(url, {'amount': '1000.00', 'reference': 'MBB-1'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(ok.data['escrow']['available'])), Decimal('900.00'))

        # The milestone is still SUBMITTED from the blocked attempt above, so approve it directly
        self.client.force_authenticate(self.company_user)
        res = self.client.post(reverse('milestone_review', kwargs={'campaign_id': self.campaign.id, 'milestone_id': milestone_id}),
                               {'action': 'approve'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_budget_and_fee_recompute_the_plan_before_finalize_and_lock_after(self):
        self.plan(40, 60)
        url = reverse('campaign_detail', kwargs={'pk': self.campaign.id})
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {'platform_fee_percent': '20.00'}, format='json').status_code, status.HTTP_200_OK)
        self.assertEqual([m.amount for m in self.campaign.milestones.order_by('step_number')], [Decimal('320.00'), Decimal('480.00')])
        self.assertEqual(self.client.patch(url, {'platform_fee_percent': '150'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        self.campaign.is_match_finalized = True
        self.campaign.save()
        self.assertEqual(self.client.patch(url, {'platform_fee_percent': '5.00'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(self.company_user)
        self.assertEqual(self.client.patch(url, {'budget': '10.00'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.patch(url, {'title': 'Renamed'}, format='json').status_code, status.HTTP_200_OK)

    def test_recording_a_transfer_twice_or_without_bank_details_is_rejected(self):
        payout = Payout.objects.create(campaign=self.campaign, student=self.student, amount=Decimal('900.00'), status=Payout.Status.PENDING)
        url = reverse('admin_record_payout', kwargs={'pk': payout.id})
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(url, {'transfer_reference': 'R1'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        payout.status = Payout.Status.PROCESSING
        payout.save()
        self.assertEqual(self.client.post(url, {'transfer_reference': 'R1'}, format='json').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.post(url, {'transfer_reference': 'R2'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        payout.refresh_from_db()
        self.assertEqual(payout.transfer_reference, 'R1')

    def test_bank_change_after_approval_updates_the_payout_but_requires_admin_confirmation(self):
        payout = Payout.objects.create(
            campaign=self.campaign, student=self.student, amount=Decimal('900.00'), status=Payout.Status.PROCESSING,
            bank_name='Maybank', bank_account_number='114000001111', bank_account_holder_name='Hana',
        )
        self.client.force_authenticate(self.student_user)
        self.client.patch(reverse('account_settings'), {'bank_account_number': '114000009999'}, format='json')
        payout.refresh_from_db()
        self.assertEqual(payout.bank_account_number, '114000009999')
        self.assertIsNotNone(payout.bank_details_changed_at)

        url = reverse('admin_record_payout', kwargs={'pk': payout.id})
        self.client.force_authenticate(self.admin)
        blocked = self.client.post(url, {'transfer_reference': 'R1'}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(blocked.data['code'], 'bank_change_unconfirmed')
        self.assertEqual(self.client.post(url, {'transfer_reference': 'R1', 'confirm_bank_change': True}, format='json').status_code, status.HTTP_200_OK)
