"""
Management command to test email delivery.

Usage:
    python manage.py test_email recipient@example.com
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import send_mail


class Command(BaseCommand):
    help = 'Test sending an email to verify SMTP or Resend API delivery.'

    def add_arguments(self, parser):
        parser.add_argument('recipient', type=str, help='Recipient email address')

    def handle(self, *args, **options):
        recipient = options['recipient']
        self.stdout.write(f"Testing email delivery to {recipient}...")
        self.stdout.write(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
        if getattr(settings, 'RESEND_API_KEY', ''):
            masked = settings.RESEND_API_KEY[:6] + '...' + settings.RESEND_API_KEY[-4:]
            self.stdout.write(f"RESEND_API_KEY: {masked}")
        else:
            self.stdout.write(f"EMAIL_HOST: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")

        try:
            sent = send_mail(
                subject='UniPact Email Delivery Verification',
                message=(
                    'Hello,\n\n'
                    'This is a verification email from your UniPact deployment.\n'
                    'If you are reading this, transactional email delivery is functioning correctly!\n\n'
                    'Best regards,\n'
                    'The UniPact Team'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )
            if sent:
                self.stdout.write(self.style.SUCCESS(f"SUCCESS: Email sent to {recipient}!"))
            else:
                self.stdout.write(self.style.WARNING("WARNING: send_mail returned 0 (not sent)."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"ERROR sending email: {e}"))
            raise
