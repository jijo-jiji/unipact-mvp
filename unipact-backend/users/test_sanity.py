from django.test import TestCase
from users.models import User, ShadowUser, ClubProfile

class SanityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(email='test@e.com', username='test')

    def test_math(self):
        self.assertTrue(True)
