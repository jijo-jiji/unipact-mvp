from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from campaigns.models import Campaign
from payments.models import Payout
from users.models import CompanyProfile, StudentProfile, User

from .models import B40Record, ImpactBaseline, Workshop


class ImpactCounterTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', email='admin@test.com', password='pw', role=User.Role.ADMIN)
        company_user = User.objects.create_user(username='co', email='co@test.com', password='pw', role=User.Role.COMPANY)
        company = CompanyProfile.objects.create(user=company_user, company_name='Acme')
        self.campaign = Campaign.objects.create(company=company, title='Site', description='d', budget=1000, status=Campaign.Status.COMPLETED)

        self.b40 = self.student('aina', 'Aina')
        self.other = self.student('other', 'Ben')
        B40Record.objects.create(student=self.b40, verified_by=self.admin)
        Payout.objects.create(campaign=self.campaign, student=self.b40, amount=Decimal('450.00'), status=Payout.Status.PAID)
        Payout.objects.create(campaign=self.campaign, student=self.b40, amount=Decimal('100.00'), status=Payout.Status.PROCESSING)
        Payout.objects.create(campaign=self.campaign, student=self.other, amount=Decimal('300.00'), status=Payout.Status.PAID)

        today = timezone.localdate()
        Workshop.objects.create(title='Canva basics', kind=Workshop.Kind.B40, held_on=today - timedelta(days=3), attendees=20)
        Workshop.objects.create(title='Next month', held_on=today + timedelta(days=30), attendees=40)

    def student(self, username, name):
        user = User.objects.create_user(username=username, email=f'{username}@test.com', password='pw', role=User.Role.STUDENT)
        return StudentProfile.objects.create(user=user, full_name=name, university='UM')

    def test_public_counter_stays_hidden_until_published(self):
        response = self.client.get(reverse('impact_public'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'published': False})

    def test_public_counter_adds_recorded_and_off_platform_figures(self):
        baseline = ImpactBaseline.load()
        baseline.b40_students_paid = 3
        baseline.b40_amount_paid = Decimal('1260.00')
        baseline.projects_delivered = 2
        baseline.show_on_homepage = True
        baseline.save()

        data = self.client.get(reverse('impact_public')).json()
        self.assertTrue(data['published'])
        self.assertEqual(data['workshops_held'], 1)  # the future workshop doesn't count yet
        self.assertEqual(data['workshop_attendees'], 20)
        self.assertEqual(data['b40_students_paid'], 4)  # only PAID payouts, only B40 students
        self.assertEqual(Decimal(str(data['b40_amount_paid'])), Decimal('1710.00'))
        self.assertEqual(data['projects_delivered'], 3)
        # Totals only: no names or ids on the public endpoint
        self.assertNotIn('Aina', str(data))

    def test_admin_sees_the_split_and_can_publish(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(reverse('impact_admin'), {'b40_students_paid': 2, 'show_on_homepage': True}, format='json')
        self.assertEqual(response.status_code, 200)
        stats = response.json()['stats']
        self.assertEqual(stats['b40_students_paid'], {'recorded': 1, 'off_platform': 2, 'total': 3})
        self.assertEqual(stats['students_paid']['recorded'], 2)
        self.assertTrue(self.client.get(reverse('impact_public')).json()['published'])

    def test_admin_marks_and_unmarks_b40(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('impact_b40'), {'student_id': self.other.id, 'evidence_note': 'STR letter'}, format='json')
        self.assertEqual(response.status_code, 201)
        again = self.client.post(reverse('impact_b40'), {'student_id': self.other.id}, format='json')
        self.assertEqual(again.status_code, 200)

        listing = self.client.get(reverse('impact_b40')).json()
        self.assertEqual({r['full_name']: Decimal(r['amount_paid']) for r in listing}, {'Aina': Decimal('450.00'), 'Ben': Decimal('300.00')})

        record = B40Record.objects.get(student=self.other)
        self.assertEqual(self.client.delete(reverse('impact_b40_detail', args=[record.id])).status_code, 204)
        self.assertFalse(B40Record.objects.filter(student=self.other).exists())

    def test_admin_logs_a_workshop(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('impact_workshops'), {
            'title': 'Digital marketing 101', 'kind': 'DIGITAL_MARKETING', 'held_on': str(timezone.localdate()), 'attendees': 15,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Workshop.objects.get(pk=response.json()['id']).created_by, self.admin)

    def test_only_admins_reach_the_admin_endpoints(self):
        self.client.force_authenticate(self.b40.user)
        for name in ['impact_admin', 'impact_workshops', 'impact_b40']:
            self.assertEqual(self.client.get(reverse(name)).status_code, 403, name)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(reverse('impact_admin')).status_code, (401, 403))

    def test_b40_status_never_appears_on_student_profiles(self):
        self.client.force_authenticate(self.b40.user)
        response = self.client.get('/api/users/me/')
        self.assertNotIn('b40', response.content.decode().lower())
