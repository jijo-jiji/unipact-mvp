import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from users.models import CompanyProfile, StudentProfile, User

from .models import LearningModule, ModuleItem, Workshop

MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA)
class LearningLibraryTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user(username='admin', email='admin@test.com', password='pw', role=User.Role.ADMIN)
        student_user = User.objects.create_user(username='stu', email='stu@test.com', password='pw', role=User.Role.STUDENT)
        StudentProfile.objects.create(user=student_user, full_name='Stu', university='UM')
        self.student = student_user
        company_user = User.objects.create_user(username='co', email='co@test.com', password='pw', role=User.Role.COMPANY)
        CompanyProfile.objects.create(user=company_user, company_name='Acme')
        self.company = company_user

    def pdf(self, name='slides.pdf'):
        return SimpleUploadedFile(name, b'%PDF-1.4 workshop slides', content_type='application/pdf')

    def test_admin_builds_a_module_and_students_see_it_once_published(self):
        self.client.force_authenticate(self.admin)
        module = self.client.post(reverse('admin_modules'), {'title': 'Canva for clients', 'topic': 'DIGITAL_MARKETING'}, format='json').json()
        items_url = reverse('admin_module_items', args=[module['id']])
        self.assertEqual(self.client.post(items_url, {'title': 'Slides', 'file': self.pdf()}, format='multipart').status_code, 201)
        self.assertEqual(self.client.post(items_url, {'title': 'Video', 'link_url': 'https://youtu.be/abc'}, format='multipart').status_code, 201)
        exercise = self.client.post(items_url, {'title': 'Design a poster', 'item_type': 'EXERCISE',
                                                'description': 'Make an A4 poster for a cafe opening.'}, format='multipart')
        self.assertEqual(exercise.status_code, 201)

        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(reverse('library')).json(), [])  # still a draft

        self.client.force_authenticate(self.admin)
        self.client.patch(reverse('admin_module_detail', args=[module['id']]), {'is_published': True}, format='json')

        self.client.force_authenticate(self.student)
        library = self.client.get(reverse('library')).json()
        self.assertEqual(len(library), 1)
        items = library[0]['items']
        self.assertEqual([i['item_type'] for i in items].count('EXERCISE'), 1)
        slides = next(i for i in items if i['title'] == 'Slides')
        self.assertTrue(slides['file_url'].endswith('.pdf'))
        self.assertNotIn('file', slides)

    def test_an_item_needs_a_file_a_link_or_exercise_instructions(self):
        module = LearningModule.objects.create(title='M')
        self.client.force_authenticate(self.admin)
        url = reverse('admin_module_items', args=[module.id])
        self.assertEqual(self.client.post(url, {'title': 'Empty'}, format='multipart').status_code, 400)
        self.assertEqual(self.client.post(url, {'title': 'Empty exercise', 'item_type': 'EXERCISE'}, format='multipart').status_code, 400)

    def test_unsafe_files_are_refused(self):
        module = LearningModule.objects.create(title='M')
        self.client.force_authenticate(self.admin)
        bad = SimpleUploadedFile('page.html', b'<html><script>alert(1)</script>', content_type='text/html')
        response = self.client.post(reverse('admin_module_items', args=[module.id]), {'title': 'Bad', 'file': bad}, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_deleting_an_item_removes_its_file(self):
        module = LearningModule.objects.create(title='M')
        self.client.force_authenticate(self.admin)
        created = self.client.post(reverse('admin_module_items', args=[module.id]), {'title': 'Slides', 'file': self.pdf()}, format='multipart').json()
        item = ModuleItem.objects.get(pk=created['id'])
        storage, name = item.file.storage, item.file.name
        self.assertTrue(storage.exists(name))
        self.client.delete(reverse('admin_module_item_detail', args=[item.id]))
        self.assertFalse(storage.exists(name))

    def test_only_students_and_admins_open_the_library(self):
        LearningModule.objects.create(title='M', is_published=True)
        self.client.force_authenticate(self.company)
        self.assertEqual(self.client.get(reverse('library')).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(reverse('library')).status_code, (401, 403))
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(reverse('admin_modules')).status_code, 403)

    def test_a_workshop_records_which_modules_it_taught(self):
        module = LearningModule.objects.create(title='SEO basics')
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('impact_workshops'), {
            'title': 'Marketing day', 'kind': 'DIGITAL_MARKETING', 'held_on': '2026-11-01', 'attendees': 12, 'module_ids': [module.id],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['module_titles'], ['SEO basics'])
        self.assertEqual(list(Workshop.objects.get().modules.all()), [module])
