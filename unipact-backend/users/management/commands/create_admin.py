import getpass
import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.utils import timezone

from users.models import User
from unipact_backend.demo_data import demo_accounts_queryset


class Command(BaseCommand):
    help = (
        'Create a UniPact admin account (role ADMIN, staff and superuser). '
        'The password is asked for interactively, or read from the ADMIN_PASSWORD environment variable '
        'for non-interactive hosts. It must pass the same strength rules as user sign-ups.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='Admin email address, used to sign in')
        parser.add_argument('--name', default='', help='Admin full name (optional)')
        parser.add_argument('--reset-password', action='store_true', help='Set a new password if this admin already exists')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError(f'"{email}" is not a valid email address.')

        existing = User.objects.filter(email__iexact=email).first()
        if existing and existing.role != User.Role.ADMIN:
            raise CommandError(f'{email} already belongs to a {existing.role.lower()} account. Use a different email for the admin.')
        if existing and not options['reset_password']:
            raise CommandError(f'Admin {email} already exists. Add --reset-password to set a new password.')

        probe = existing or User(email=email, username=email, first_name=options['name'])
        password = self._get_password(probe)

        if existing:
            existing.set_password(password)
            existing.is_active = True
            existing.save(update_fields=['password', 'is_active'])
            self.stdout.write(self.style.SUCCESS(f'Password updated for admin {email}.'))
        else:
            first, _, last = options['name'].partition(' ')
            User.objects.create_superuser(
                username=email, email=email, password=password, role=User.Role.ADMIN,
                first_name=first, last_name=last, is_verified=True, terms_accepted_at=timezone.now(),
            )
            self.stdout.write(self.style.SUCCESS(f'Admin account created: {email}'))

        demo = demo_accounts_queryset()
        if demo.exists():
            self.stdout.write(self.style.WARNING(
                f'\nWarning: {demo.count()} demo account(s) with publicly known passwords exist in this database. '
                'Remove them with: python manage.py remove_demo_accounts --yes'
            ))

    def _get_password(self, probe):
        password = os.environ.get('ADMIN_PASSWORD')
        if password is None:
            if not self.stdin_is_interactive():
                raise CommandError('Set the ADMIN_PASSWORD environment variable or run this command in an interactive terminal.')
            password = getpass.getpass('Admin password: ')
            if password != getpass.getpass('Confirm password: '):
                raise CommandError('The passwords did not match.')
        try:
            validate_password(password, user=probe)
        except ValidationError as exc:
            raise CommandError('Password rejected: ' + ' '.join(exc.messages))
        if len(password) < 12:
            raise CommandError('Password rejected: admin passwords must be at least 12 characters.')
        return password

    @staticmethod
    def stdin_is_interactive():
        import sys
        return sys.stdin.isatty()
