from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from campaigns.models import Campaign
from payments.models import Payout
from users.models import CompanyProfile, StudentProfile, User

from .models import B40Record, Workshop, WorkshopAttendee


class WorkshopCheckinTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', email='admin@test.com', password='pw', role=User.Role.ADMIN)
        self.workshop = Workshop.objects.create(title='Canva for clients', held_on=timezone.localdate() - timedelta(days=10), cost=Decimal('300.00'))
        company_user = User.objects.create_user(username='co', email='co@test.com', password='pw', role=User.Role.COMPANY)
        self.campaign = Campaign.objects.create(company=CompanyProfile.objects.create(user=company_user, company_name='Acme'),
                                                title='Posters', description='d', budget=1000)

    def checkin(self, email, **extra):
        body = {'full_name': 'Someone', 'email': email, 'confidence_before': 2, 'consent': True, **extra}
        return self.client.post(reverse('workshop_checkin', args=[self.workshop.checkin_code]), body, format='json')

    def feedback(self, email, after=4, score=9):
        return self.client.post(reverse('workshop_feedback', args=[self.workshop.checkin_code]),
                                {'email': email, 'confidence_after': after, 'recommend_score': score}, format='json')

    def make_student(self, email, name='Aina'):
        user = User.objects.create_user(username=email.split('@')[0], email=email, password='pw', role=User.Role.STUDENT)
        return StudentProfile.objects.create(user=user, full_name=name, university='UM')

    def test_anyone_with_the_link_can_check_in_once(self):
        public = self.client.get(reverse('workshop_public', args=[self.workshop.checkin_code])).json()
        self.assertEqual(public['title'], 'Canva for clients')
        self.assertEqual(self.checkin('Aina@Example.com ').status_code, 201)
        again = self.checkin('aina@example.com')
        self.assertEqual(again.status_code, 200)
        self.assertTrue(again.json()['already'])
        self.assertEqual(WorkshopAttendee.objects.get().email, 'aina@example.com')

    def test_check_in_needs_consent_and_an_open_workshop(self):
        self.assertEqual(self.checkin('a@x.com', consent=False).status_code, 400)
        self.assertEqual(self.checkin('a@x.com', confidence_before=9).status_code, 400)
        self.workshop.checkin_open = False
        self.workshop.save()
        self.assertEqual(self.checkin('a@x.com').status_code, 400)
        self.assertEqual(self.client.get(reverse('workshop_public', args=['nope'])).status_code, 404)

    def test_existing_student_is_linked_at_check_in(self):
        profile = self.make_student('aina@example.com')
        self.assertTrue(self.checkin('aina@example.com').json()['has_account'])
        self.assertEqual(WorkshopAttendee.objects.get().student, profile)

    def test_attendee_is_linked_when_they_sign_up_later(self):
        self.checkin('ben@uni.edu.my')
        user = User.objects.create_user(username='ben', email='ben@gmail.com', password='pw', role=User.Role.STUDENT)
        profile = StudentProfile.objects.create(user=user, full_name='Ben', university='UM')
        self.assertIsNone(WorkshopAttendee.objects.get().student)
        profile.university_email = 'ben@uni.edu.my'  # checked in with their university email
        profile.save()
        self.assertEqual(WorkshopAttendee.objects.get().student, profile)

    def test_feedback_must_match_a_check_in(self):
        self.checkin('aina@example.com')
        self.assertEqual(self.feedback('stranger@example.com').status_code, 400)
        self.assertEqual(self.feedback('AINA@example.com').status_code, 200)
        self.assertEqual(WorkshopAttendee.objects.get().confidence_after, 4)

    def test_results_follow_attendees_to_paid_work(self):
        aina = self.make_student('aina@example.com')
        B40Record.objects.create(student=aina)
        self.checkin('aina@example.com', b40_self_declared='YES')
        self.checkin('ben@example.com', confidence_before=3)
        self.checkin('cara@example.com')
        self.feedback('aina@example.com', after=5, score=10)
        self.feedback('ben@example.com', after=4, score=6)

        Payout.objects.create(campaign=self.campaign, student=aina, amount=Decimal('500.00'), status=Payout.Status.PAID,
                              paid_at=timezone.now())
        Payout.objects.create(campaign=self.campaign, student=aina, amount=Decimal('999.00'), status=Payout.Status.PAID,
                              paid_at=timezone.now() - timedelta(days=60))  # before the workshop: not counted

        self.client.force_authenticate(self.admin)
        data = self.client.get(reverse('impact_workshop_results', args=[self.workshop.id])).json()
        s = data['summary']
        self.assertEqual(s['attendees'], 3)
        self.assertEqual((s['b40_self_declared'], s['b40_verified']), (1, 1))
        self.assertEqual((s['confidence_before'], s['confidence_after']), (2.5, 4.5))  # only people who answered both
        self.assertEqual(s['nps'], 0)  # one promoter, one detractor
        self.assertEqual((s['have_account'], s['earned'], s['earned_within_90_days']), (1, 1, 1))
        self.assertEqual(Decimal(str(s['total_earned'])), Decimal('500.00'))
        self.assertEqual(Decimal(str(s['cost_per_attendee'])), Decimal('100.00'))
        self.assertEqual(Decimal(str(s['cost_per_earner'])), Decimal('300.00'))
        self.assertEqual(len(data['attendees']), 3)

    def test_counter_uses_check_ins_when_there_are_any(self):
        from . import stats
        Workshop.objects.create(title='Old style', held_on=self.workshop.held_on, attendees=30)
        self.workshop.attendees = 99  # ignored: this workshop has real check-ins
        self.workshop.save()
        self.checkin('a@x.com')
        self.checkin('b@x.com')
        self.assertEqual(stats.compute()['workshop_attendees'], 32)

    def test_results_and_attendee_details_are_admin_only(self):
        self.checkin('aina@example.com')
        student = self.make_student('s@x.com')
        self.client.force_authenticate(student.user)
        self.assertEqual(self.client.get(reverse('impact_workshop_results', args=[self.workshop.id])).status_code, 403)
        self.assertNotIn('aina', str(self.client.get(reverse('workshop_public', args=[self.workshop.checkin_code])).json()))
