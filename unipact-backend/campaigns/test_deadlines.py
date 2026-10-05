from datetime import datetime, timedelta
from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.deadlines import THROTTLE_KEY
from campaigns.milestones import auto_accept_due, review_due_at
from campaigns.models import Campaign, Milestone
from campaigns.workdays import MALAYSIA, add_working_days
from payments.models import Payout, Transaction
from payments.payouts import due_at, send_payout_reminders
from users.models import CompanyProfile, StudentProfile, User

STRONG = 'Blue-Kettle-Run-88'


def kl(year, month, day, hour=10):
    return datetime(year, month, day, hour, tzinfo=MALAYSIA)


class WorkingDayTests(APITestCase):
    def test_weekends_do_not_count(self):
        friday = kl(2026, 10, 2)
        self.assertEqual(add_working_days(friday, 1), kl(2026, 10, 5))    # Monday
        self.assertEqual(add_working_days(friday, 5), kl(2026, 10, 9))    # the following Friday
        self.assertEqual(add_working_days(friday, 7), kl(2026, 10, 13))   # Tuesday after that
        self.assertEqual(add_working_days(kl(2026, 10, 3), 1), kl(2026, 10, 5))  # from a Saturday: Monday
        self.assertEqual(add_working_days(friday, 0), friday)


class AgreementDeadlineTests(APITestCase):
    def setUp(self):
        cache.delete(THROTTLE_KEY)
        self.admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password=STRONG, role=User.Role.ADMIN)
        self.company_user = User.objects.create_user(username='co@x.com', email='co@x.com', password=STRONG, role=User.Role.COMPANY, email_verified=True)
        self.company = CompanyProfile.objects.create(user=self.company_user, company_name='Co', verification_status='VERIFIED')
        self.student_user = User.objects.create_user(username='ali@x.my', email='ali@x.my', password=STRONG, role=User.Role.STUDENT, email_verified=True)
        self.student = StudentProfile.objects.create(user=self.student_user, full_name='Ali', university='UM', verification_status='VERIFIED',
                                                     bank_name='Maybank', bank_account_number='1234567890')
        self.campaign = Campaign.objects.create(company=self.company, title='CRM', description='d', type='SOFTWARE_DEVELOPMENT',
                                                budget=1000, status=Campaign.Status.IN_PROGRESS, is_match_finalized=True)
        self.campaign.assigned_students.add(self.student)
        self.milestone = Milestone.objects.create(campaign=self.campaign, step_number=1, title='Delivery', percentage=100, amount=Decimal('900.00'))

    def fund(self):
        Transaction.objects.create(company=self.company, related_campaign=self.campaign, amount=1000,
                                   transaction_type=Transaction.Type.PROJECT_FEE, status=Transaction.Status.SUCCESS)

    def submit(self, at=None):
        self.client.force_authenticate(self.student_user)
        res = self.client.post(reverse('milestone_submit', kwargs={'campaign_id': self.campaign.id, 'milestone_id': self.milestone.id}),
                               {'deliverable_url': 'https://example.com/work'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        if at:
            Milestone.objects.filter(pk=self.milestone.pk).update(submitted_at=at)
        self.milestone.refresh_from_db()
        return res

    def review(self, user, action, **extra):
        self.client.force_authenticate(user)
        return self.client.post(reverse('milestone_review', kwargs={'campaign_id': self.campaign.id, 'milestone_id': self.milestone.id}),
                                {'action': action, **extra}, format='json')

    def test_submitting_starts_the_clients_five_working_day_review(self):
        res = self.submit(at=kl(2026, 10, 2))  # a Friday
        self.milestone.refresh_from_db()
        self.assertEqual(review_due_at(self.milestone), kl(2026, 10, 9))
        self.assertIsNotNone(res.data['review_due_at'])

    def test_silence_for_five_working_days_accepts_the_milestone_and_releases_payment(self):
        self.fund()
        self.submit(at=kl(2026, 10, 2))
        mail.outbox.clear()

        self.assertEqual(auto_accept_due(now=kl(2026, 10, 9, hour=9)), 0)  # an hour before the deadline
        self.milestone.refresh_from_db()
        self.assertEqual(self.milestone.status, Milestone.Status.SUBMITTED)

        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(auto_accept_due(now=kl(2026, 10, 9, hour=11)), 1)
        self.milestone.refresh_from_db()
        self.assertEqual((self.milestone.status, self.milestone.auto_approved), (Milestone.Status.APPROVED, True))
        payout = Payout.objects.get(milestone=self.milestone)
        self.assertEqual((payout.amount, payout.status), (Decimal('900.00'), Payout.Status.PROCESSING))
        subjects = {m.to[0]: m.subject for m in mail.outbox}
        self.assertIn('accepted automatically', subjects['co@x.com'])
        self.assertIn('Milestone accepted', subjects['ali@x.my'])
        self.assertEqual(auto_accept_due(now=kl(2026, 10, 12)), 0)  # nothing left to accept; no second payout
        self.assertEqual(Payout.objects.count(), 1)

    def test_an_unfunded_milestone_is_not_accepted_automatically(self):
        self.submit(at=kl(2026, 10, 2))  # the client has paid nothing: there is no money to release
        self.assertEqual(auto_accept_due(now=kl(2026, 10, 20)), 0)
        self.milestone.refresh_from_db()
        self.assertEqual(self.milestone.status, Milestone.Status.SUBMITTED)
        self.assertFalse(Payout.objects.exists())

    def test_a_revision_request_restarts_the_clock(self):
        self.fund()
        self.submit(at=kl(2026, 10, 2))
        self.assertEqual(self.review(self.company_user, 'request_revision', feedback='Fix the header').status_code, status.HTTP_200_OK)
        self.assertEqual(auto_accept_due(now=kl(2026, 10, 20)), 0)  # it is with the team, not the client
        self.submit(at=kl(2026, 10, 19))
        self.assertEqual(review_due_at(self.milestone), kl(2026, 10, 26))

    def test_client_gets_two_revision_rounds_per_milestone(self):
        self.fund()
        for _ in range(2):
            self.submit()
            self.assertEqual(self.review(self.company_user, 'request_revision', feedback='Change it').status_code, status.HTTP_200_OK)
        self.submit()
        third = self.review(self.company_user, 'request_revision', feedback='Again')
        self.assertEqual((third.status_code, third.data['code']), (status.HTTP_400_BAD_REQUEST, 'revision_limit_reached'))
        self.assertEqual(self.review(self.admin, 'request_revision', feedback='UniPact agreed one more').status_code, status.HTTP_200_OK)

    def test_client_approval_still_works_and_is_not_marked_automatic(self):
        self.fund()
        self.submit()
        with self.captureOnCommitCallbacks(execute=True):
            res = self.review(self.company_user, 'approve')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual((res.data['milestone']['status'], res.data['milestone']['auto_approved']), ('APPROVED', False))
        self.assertIsNotNone(res.data['payouts'][0]['due_at'])
        self.assertFalse(res.data['payouts'][0]['is_overdue'])

    def test_admins_are_reminded_once_before_a_payout_is_late(self):
        payout = Payout.objects.create(campaign=self.campaign, student=self.student, milestone=self.milestone, amount=900)
        Payout.objects.filter(pk=payout.pk).update(created_at=kl(2026, 10, 2))  # accepted on a Friday
        payout.refresh_from_db()
        self.assertEqual(due_at(payout), kl(2026, 10, 13))  # 7 working days later

        self.assertEqual(send_payout_reminders(now=kl(2026, 10, 8)), 0)  # 4 working days in: not yet
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(send_payout_reminders(now=kl(2026, 10, 9, hour=11)), 1)  # 5 working days in: 2 left
        self.assertIn('admin@x.my', mail.outbox[-1].to + mail.outbox[-1].bcc)
        self.assertIn('13 Oct 2026', mail.outbox[-1].body)
        self.assertEqual(send_payout_reminders(now=kl(2026, 10, 12)), 0)  # only once

        payout.status = Payout.Status.PAID
        payout.save()
        self.client.force_authenticate(self.admin)
        listed = self.client.get(reverse('admin_payouts_list')).data
        rows = listed['payouts'] if isinstance(listed, dict) else listed
        self.assertFalse(rows[0]['is_overdue'])  # a paid payout is never overdue

    def test_the_checks_run_as_people_use_the_site_and_from_the_command(self):
        self.fund()
        self.submit(at=timezone.now() - timedelta(days=14))
        cache.delete(THROTTLE_KEY)
        self.client.force_authenticate(self.company_user)
        self.client.get(reverse('campaign_detail', kwargs={'pk': self.campaign.id}))  # just opening the project
        self.milestone.refresh_from_db()
        self.assertEqual((self.milestone.status, self.milestone.auto_approved), (Milestone.Status.APPROVED, True))
        call_command('run_deadlines')  # runs cleanly with nothing left to do


class PostgresRowLockTests(APITestCase):
    """Tests run on SQLite, which ignores row locks; production is PostgreSQL, which rejects a plain
    FOR UPDATE that reaches across an outer join (a nullable relation). That once left every online payment
    unrecorded. So compile each locking query the way PostgreSQL would see it, without connecting."""

    def postgres_sql(self, queryset):
        from django.db.backends.postgresql.base import DatabaseWrapper

        postgres = DatabaseWrapper({
            'NAME': 'x', 'USER': '', 'PASSWORD': '', 'HOST': '', 'PORT': '', 'OPTIONS': {}, 'TIME_ZONE': None,
            'CONN_MAX_AGE': 0, 'CONN_HEALTH_CHECKS': False, 'AUTOCOMMIT': True, 'ATOMIC_REQUESTS': False, 'TEST': {},
        }, alias='postgres-sql-only')
        postgres.get_autocommit = lambda: False  # compile as if inside a transaction; nothing connects
        return queryset.query.get_compiler(connection=postgres).as_sql()[0]

    def test_no_row_lock_reaches_across_an_outer_join(self):
        from campaigns.models import MatchOffer
        from payments import toyyibpay
        from users.models import ShadowUser

        campaign = Campaign(pk=1)
        locking_queries = {
            'approve milestone: project': Campaign.objects.select_for_update().filter(pk=1),
            'approve milestone: milestone': Milestone.objects.select_for_update().filter(pk=1, campaign=campaign),
            'request revision': Milestone.objects.select_for_update().filter(pk=1),
            'answer a match offer': MatchOffer.objects.select_for_update().select_related('campaign__company__user').filter(campaign_id=1),
            'issue an invoice': Campaign.objects.select_for_update().filter(pk=1),
            'record an online payment': toyyibpay.locked_transactions().filter(pk=1),
            'record a payout': Payout.objects.select_for_update().select_related('student', 'student__user', 'campaign').filter(pk=1),
            'record a client payment': Campaign.objects.select_for_update().select_related('company').filter(pk=1),
            'club invitation': ShadowUser.objects.select_for_update().select_related('invited_by__user').filter(pk=1),
        }
        for name, queryset in locking_queries.items():
            sql = self.postgres_sql(queryset)
            self.assertIn('FOR UPDATE', sql, name)
            if 'OUTER JOIN' in sql:
                # Allowed only when the lock names its own table, so the nullable side is left alone
                self.assertIn('FOR UPDATE OF', sql, f'{name}: locks across an outer join, which PostgreSQL rejects')
