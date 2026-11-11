from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from campaigns.models import Campaign
from payments.models import Payout
from users.models import CompanyProfile, StudentProfile, User

from .models import B40Record, ImpactSettings, Workshop


class ImpactCounterTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', email='admin@test.com', password='pw', role=User.Role.ADMIN)
        company_user = User.objects.create_user(username='co', email='co@test.com', password='pw', role=User.Role.COMPANY)
        company = CompanyProfile.objects.create(user=company_user, company_name='Acme')
        now = timezone.now()
        self.campaign = Campaign.objects.create(company=company, title='Site', description='d', budget=1000,
                                                status=Campaign.Status.COMPLETED, completed_at=now)

        self.b40 = self.student('aina', 'Aina')
        self.other = self.student('other', 'Ben')
        B40Record.objects.create(student=self.b40, verified_by=self.admin)
        Payout.objects.create(campaign=self.campaign, student=self.b40, amount=Decimal('450.00'), status=Payout.Status.PAID, paid_at=now)
        Payout.objects.create(campaign=self.campaign, student=self.b40, amount=Decimal('100.00'), status=Payout.Status.PROCESSING)
        Payout.objects.create(campaign=self.campaign, student=self.other, amount=Decimal('300.00'), status=Payout.Status.PAID, paid_at=now)

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

    def publish(self, **changes):
        config = ImpactSettings.load()
        config.show_on_homepage = True
        for key, value in changes.items():
            setattr(config, key, value)
        config.save()

    def test_public_counter_counts_platform_records_only(self):
        self.publish()
        data = self.client.get(reverse('impact_public')).json()
        self.assertTrue(data['published'])
        self.assertEqual(data['workshops_held'], 1)  # the future workshop doesn't count yet
        self.assertEqual(data['workshop_attendees'], 20)
        self.assertEqual(data['b40_students_paid'], 1)  # only PAID payouts, only B40 students
        self.assertEqual(Decimal(str(data['b40_amount_paid'])), Decimal('450.00'))
        self.assertEqual(data['projects_delivered'], 1)
        # Totals only: no names or ids on the public endpoint
        self.assertNotIn('Aina', str(data))

    def test_counting_start_date_leaves_out_older_records(self):
        today = timezone.localdate()
        old = timezone.now() - timedelta(days=60)
        Payout.objects.create(campaign=self.campaign, student=self.b40, amount=Decimal('999.00'), status=Payout.Status.PAID, paid_at=old)
        Workshop.objects.create(title='Old one', held_on=today - timedelta(days=60), attendees=50)
        self.publish(counting_starts_on=today - timedelta(days=7))

        data = self.client.get(reverse('impact_public')).json()
        self.assertEqual(data['workshops_held'], 1)
        self.assertEqual(Decimal(str(data['b40_amount_paid'])), Decimal('450.00'))

        self.campaign.completed_at = old
        self.campaign.save()
        self.assertEqual(self.client.get(reverse('impact_public')).json()['projects_delivered'], 0)

    def test_admin_sees_every_figure_and_can_publish(self):
        self.client.force_authenticate(self.admin)
        start = str(timezone.localdate() - timedelta(days=30))
        response = self.client.patch(reverse('impact_admin'), {'counting_starts_on': start, 'show_on_homepage': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['settings']['counting_starts_on'], start)
        stats = response.json()['stats']
        self.assertEqual(stats['b40_students_paid'], 1)
        self.assertEqual(stats['students_paid'], 2)
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
