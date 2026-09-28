from unittest.mock import patch, MagicMock
from django.test import SimpleTestCase, override_settings
from django.core.mail import EmailMultiAlternatives
from unipact_backend.email_backends import ResendEmailBackend


class ResendEmailBackendTests(SimpleTestCase):
    @override_settings(RESEND_API_KEY='re_test_123', DEFAULT_FROM_EMAIL='UniPact <onboarding@resend.dev>')
    @patch('urllib.request.urlopen')
    def test_send_message_success(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = b'{"id": "msg_123"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        backend = ResendEmailBackend()
        email = EmailMultiAlternatives(
            subject='Welcome to UniPact',
            body='Welcome text',
            from_email='UniPact <onboarding@resend.dev>',
            to=['student@example.com'],
        )
        email.attach_alternative('<p>Welcome HTML</p>', 'text/html')

        count = backend.send_messages([email])
        self.assertEqual(count, 1)
        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.full_url, 'https://api.resend.com/emails')
        self.assertEqual(req.headers['Authorization'], 'Bearer re_test_123')

    @override_settings(RESEND_API_KEY='')
    def test_missing_api_key_raises(self):
        backend = ResendEmailBackend(fail_silently=False)
        email = EmailMultiAlternatives(subject='Hi', body='Text', to=['test@example.com'])
        with self.assertRaises(ValueError):
            backend.send_messages([email])
