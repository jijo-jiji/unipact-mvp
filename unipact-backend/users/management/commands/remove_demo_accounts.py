from django.core.management.base import BaseCommand
from django.db import transaction

from unipact_backend.demo_data import demo_accounts_queryset


class Command(BaseCommand):
    help = (
        'List (default) or delete the demo accounts created by the seed scripts. Their passwords are public, '
        'so they must not exist on a live site. Deleting an account also deletes its profile, projects and uploads.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Actually delete the accounts (otherwise only list them)')

    def handle(self, *args, **options):
        accounts = demo_accounts_queryset().order_by('email')
        count = accounts.count()
        if not count:
            self.stdout.write(self.style.SUCCESS('No demo accounts found.'))
            return

        self.stdout.write(f'Found {count} demo account(s):')
        for user in accounts:
            self.stdout.write(f'  - {user.email} ({user.role.lower()})')

        if not options['yes']:
            self.stdout.write(self.style.WARNING('\nNothing deleted. Re-run with --yes to delete these accounts and all of their data.'))
            return

        with transaction.atomic():
            accounts.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} demo account(s).'))
