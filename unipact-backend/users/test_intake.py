from decimal import Decimal
from urllib.parse import unquote

from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from campaigns.models import Campaign, Milestone
from payments.models import Payout
from unipact_backend.testing import COMPANY_SIGNUP, student_signup
from users import formats
from users.models import CompanyProfile, StudentProfile, User

STRONG = 'Blue-Kettle-Run-88'


class FormatTests(APITestCase):
    def test_malaysian_mobile_numbers(self):
        for typed in ('012-345 6789', '+60 12-345 6789', '60123456789', '0123456789'):
            self.assertEqual(formats.malaysian_mobile(typed), '+60123456789', typed)
        self.assertEqual(formats.malaysian_mobile('011-1234 5678'), '+601112345678')
        for bad in ('03-1234 5678', '12345', 'abc', '+65 9123 4567'):
            with self.assertRaises(ValidationError, msg=bad):
                formats.malaysian_mobile(bad)

    def test_university_emails(self):
        for ok in ('a@siswa.um.edu.my', 'B@Student.Monash.edu', 'c@graduate.utm.my', 'd@student.usm.my'):
            self.assertEqual(formats.university_email(ok), ok.lower())
        for bad in ('a@gmail.com', 'b@company.com.my', 'c@yahoo.com'):
            with self.assertRaises(ValidationError, msg=bad):
                formats.university_email(bad)

    def test_ssm_numbers(self):
        self.assertEqual(formats.ssm_number('2026-03-205508'), '202603205508')
        for bad in ('1234567-X', '20260320550', '202609205508', '209903205508', 'PPM-011-10-25022025'):
            with self.assertRaises(ValidationError, msg=bad):
                formats.ssm_number(bad)

    def test_ros_numbers(self):
        self.assertEqual(formats.ros_number('ppm-011-10-25022025'), 'PPM-011-10-25022025')
        for bad in ('PPM-011-10-31022025', 'PPM-011-99-25022025', 'PPM-011-10-25022099', 'PPM-11-10-25022025', '202603205508'):
            with self.assertRaises(ValidationError, msg=bad):
                formats.ros_number(bad)


class StudentSignupTests(APITestCase):
    def sign_up(self, **fields):
        data = {'accept_terms': 'true', 'email': 'aina@gmail.com', 'password': STRONG, 'full_name': 'Aina', 'university': 'UM',
                'domain_focus': 'SOFTWARE_DEV', **student_signup(university_email='aina@siswa.um.edu.my'), **fields}
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse('register_student'), data, format='json')

    def test_contact_and_availability_are_required_and_stored(self):
        for missing in ('whatsapp_number', 'university_email', 'year_of_study', 'current_semester', 'weekly_availability'):
            res = self.sign_up(**{missing: ''})
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, missing)
            self.assertIn(missing, res.data)
        self.assertFalse(User.objects.exists())

        res = self.sign_up(whatsapp_number='+60 12-345 6789', linkedin_url='https://www.linkedin.com/in/aina')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        profile = StudentProfile.objects.get()
        self.assertEqual((profile.whatsapp_number, profile.university_email, profile.year_of_study, profile.current_semester, profile.weekly_availability),
                         ('+60123456789', 'aina@siswa.um.edu.my', 2, 1, '6-10'))
        self.assertIsNone(profile.university_email_verified_at)

    def test_university_email_must_be_academic_and_unused(self):
        self.assertIn('university_email', self.sign_up(university_email='aina@gmail.com').data)
        self.assertEqual(self.sign_up().status_code, status.HTTP_201_CREATED)
        self.client.cookies.clear()
        again = self.sign_up(email='other@gmail.com')  # a second account with the same university email
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('university_email', again.data)

    def test_portfolio_link_is_required_for_software_but_any_link_counts(self):
        self.assertIn('portfolio_url', self.sign_up(portfolio_url='').data)
        self.assertEqual(self.sign_up(domain_focus='MARKETING', portfolio_url='').status_code, status.HTTP_201_CREATED)
        StudentProfile.objects.all().delete()
        User.objects.all().delete()
        self.client.cookies.clear()
        res = self.sign_up(portfolio_url='https://www.canva.com/design/abc/view')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_the_university_email_is_confirmed_by_link(self):
        self.sign_up()
        link_email = next(m for m in mail.outbox if m.to == ['aina@siswa.um.edu.my'])
        token = unquote(link_email.body.split('/verify-university-email?token=')[1].split()[0])
        res = self.client.post(reverse('verify_university_email'), {'token': token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        profile = StudentProfile.objects.get()
        self.assertIsNotNone(profile.university_email_verified_at)
        self.assertTrue(self.client.get(reverse('me')).data['student_profile']['university_email_verified'])

        # Changing it in settings means confirming the new one
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(reverse('account_settings'), {'university_email': 'aina2@siswa.um.edu.my'}, format='json')
        profile.refresh_from_db()
        self.assertIsNone(profile.university_email_verified_at)
        self.assertEqual(mail.outbox[0].to, ['aina2@siswa.um.edu.my'])
        self.assertEqual(self.client.post(reverse('verify_university_email'), {'token': token}, format='json').status_code,
                         status.HTTP_400_BAD_REQUEST)  # the old link no longer works

    def test_clients_see_links_but_not_whatsapp_or_university_email(self):
        from users.serializers import StudentTeamMemberSerializer
        self.sign_up()
        shown = StudentTeamMemberSerializer(StudentProfile.objects.get()).data
        self.assertIn('portfolio_url', shown)
        self.assertFalse({'whatsapp_number', 'university_email'} & shown.keys())


class OrganisationSignupTests(APITestCase):
    def sign_up(self, **fields):
        data = {'accept_terms': 'true', 'email': 'hello@kasih.org.my', 'password': STRONG, 'company_name': 'Pertubuhan Kasih', **fields}
        return self.client.post(reverse('register_company'), data, format='json')

    def test_companies_give_an_ssm_number_and_ngos_a_ros_number(self):
        self.assertIn('registration_number', self.sign_up(**COMPANY_SIGNUP, org_type='NGO').data)
        self.assertIn('registration_number', self.sign_up(registration_number='PPM-011-10-25022025').data)  # a company with a ROS number
        self.assertIn('registration_number', self.sign_up().data)  # nothing given

        res = self.sign_up(org_type='NGO', registration_number='PPM-011-10-25022025')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        ngo = CompanyProfile.objects.get()
        self.assertEqual((ngo.org_type, ngo.registration_number), ('NGO', 'PPM-011-10-25022025'))

    def test_an_ngo_is_verified_only_with_its_ros_certificate(self):
        from django.core.files.base import ContentFile
        self.sign_up(org_type='NGO', registration_number='PPM-011-10-25022025')
        ngo = CompanyProfile.objects.get()
        admin = User.objects.create_superuser(username='admin@x.my', email='admin@x.my', password=STRONG, role=User.Role.ADMIN)
        self.client.force_authenticate(admin)
        url = reverse('admin_verify', kwargs={'entity_type': 'COMPANY', 'entity_id': ngo.id})
        refused = self.client.post(url, {'action': 'approve'}, format='json')
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ROS', refused.data['error'])

        ngo.ssm_document.save('ros.pdf', ContentFile(b'%PDF-1.4'))
        self.assertEqual(self.client.post(url, {'action': 'approve'}, format='json').status_code, status.HTTP_200_OK)


class VolunteerProjectTests(APITestCase):
    def make_org(self, email, org_type):
        user = User.objects.create_user(username=email, email=email, password=STRONG, role=User.Role.COMPANY, email_verified=True)
        CompanyProfile.objects.create(user=user, company_name=email, org_type=org_type, verification_status='VERIFIED',
                                      registration_number='PPM-011-10-25022025' if org_type == 'NGO' else '202603205508')
        return user

    def post_project(self, user, **fields):
        self.client.force_authenticate(user)
        return self.client.post(reverse('campaign_list_create'), {'title': 'Food bank site', 'description': 'd', 'type': 'SOFTWARE_DEVELOPMENT',
                                                                  'budget': '500.00', **fields}, format='json')

    def test_only_ngos_can_post_unpaid_projects_and_nothing_is_charged_or_paid(self):
        company = self.make_org('hr@acme.com', 'COMPANY')
        self.assertIn('is_volunteer', self.post_project(company, is_volunteer=True).data)
        self.assertIn('budget', self.post_project(company, budget='0').data)

        ngo = self.make_org('hello@kasih.org.my', 'NGO')
        res = self.post_project(ngo, is_volunteer=True)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        project = Campaign.objects.get(pk=res.data['id'])
        self.assertEqual((project.is_volunteer, project.budget), (True, Decimal('0.00')))

        # The project starts without any payment, and approving work creates no payouts
        student_user = User.objects.create_user(username='s@x.my', email='s@x.my', password=STRONG, role=User.Role.STUDENT)
        student = StudentProfile.objects.create(user=student_user, full_name='S', university='UM', verification_status='VERIFIED')
        project.assigned_students.add(student)
        project.status = Campaign.Status.IN_PROGRESS
        project.is_match_finalized = True
        project.save()
        milestone = Milestone.objects.create(campaign=project, title='Delivery', amount=0, status=Milestone.Status.SUBMITTED)
        approved = self.client.post(reverse('milestone_review', kwargs={'campaign_id': project.id, 'milestone_id': milestone.id}),
                                    {'action': 'approve'}, format='json')
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertEqual(approved.data['payouts'], [])
        self.assertFalse(Payout.objects.exists())
