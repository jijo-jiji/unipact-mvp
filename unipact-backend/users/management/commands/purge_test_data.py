from django.core.management.base import BaseCommand, CommandError
from django.db import models, router, transaction
from django.db.models import Q
from django.db.models.deletion import Collector

from campaigns.models import Campaign
from payments.models import Invoice
from users.models import User


class Command(BaseCommand):
    help = (
        'Remove test accounts and test projects from a live site, with everything that hangs off them: profiles, '
        'projects, milestones, payments, payouts, invoices, ledgers, agreement records and uploaded files. '
        'With no options it only lists what exists. With --emails / --projects / --all-except-admins it shows '
        'exactly what would be removed; nothing is deleted until you add --yes. Admin accounts are never removed.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--emails', default='', help='Accounts to remove, comma separated')
        parser.add_argument('--projects', default='', help='Project ids to remove, comma separated (their owners are kept)')
        parser.add_argument('--all-except-admins', action='store_true', help='Remove every account that is not an admin')
        parser.add_argument('--yes', action='store_true', help='Actually delete. Without it, this is a preview and nothing changes')
        parser.add_argument('--force', action='store_true',
                            help='Allow removing a student who is on a project whose client is being kept')

    # ------------------------------------------------------------------
    def handle(self, *args, **options):
        emails = [e.strip().lower() for e in options['emails'].split(',') if e.strip()]
        try:
            project_ids = [int(p) for p in options['projects'].split(',') if p.strip()]
        except ValueError:
            raise CommandError('--projects takes project numbers, e.g. --projects 3,7')

        if not (emails or project_ids or options['all_except_admins']):
            return self.list_everything()

        users = self.pick_users(emails, options['all_except_admins'])
        campaigns = self.pick_projects(project_ids)
        self.check_shared_projects(users, campaigns, options['force'])

        # Named before anything is deleted: the accounts, and every project that goes (picked directly, or
        # because its client is being removed)
        going_accounts = [f'{u.email} ({u.role.lower()}) {self.describe(u)}' for u in users.order_by('email')]
        going_projects = [
            f'#{c.id} "{c.title}" ({c.status.lower().replace("_", " ")}, RM {c.budget}, client {c.company.user.email})'
            for c in Campaign.objects.filter(Q(pk__in=campaigns) | Q(company__user__in=users)).select_related('company__user').distinct().order_by('id')
        ]

        with transaction.atomic():
            deleted, files = self.delete(users, campaigns)
            if not options['yes']:
                transaction.set_rollback(True)  # a preview: undo everything that was just counted

        self.report(going_accounts, going_projects, deleted, files, done=options['yes'])
        self.stdout.write(f'Uploads are read from: {self.storage_name()}')
        self.stdout.write('')
        if options['yes']:
            removed = sum(1 for storage, name in files if self.remove_file(storage, name))
            self.stdout.write(self.style.SUCCESS(f'Deleted. {removed} of {len(files)} uploaded file(s) removed from storage.'))
            if removed < len(files):
                self.stdout.write(self.style.WARNING(
                    f'{len(files) - removed} file(s) were not found in that storage. If the live site keeps uploads in Cloudflare R2 and '
                    'this ran without the R2 settings, those files are still in the bucket: delete them in the Cloudflare dashboard.'))
        else:
            self.stdout.write(self.style.WARNING('PREVIEW ONLY: nothing was deleted. Run the same command with --yes to delete.'))

    # ------------------------------------------------------------------
    def list_everything(self):
        accounts = User.objects.exclude(Q(role=User.Role.ADMIN) | Q(is_superuser=True)).order_by('date_joined')
        self.stdout.write(f'Accounts ({accounts.count()}, admins not shown):')
        for user in accounts:
            self.stdout.write(f'  {user.email:<40} {user.role.lower():<8} joined {user.date_joined:%d %b %Y}  {self.describe(user)}')
        projects = Campaign.objects.select_related('company__user').order_by('id')
        self.stdout.write(f'\nProjects ({projects.count()}):')
        for c in projects:
            self.stdout.write(f'  #{c.id:<4} {c.status:<12} RM {c.budget:<10} {c.title[:40]:<40} client: {c.company.user.email}')
        self.stdout.write('\nNothing was changed. To preview a removal, add e.g. --emails a@x.com,b@y.com  or  --projects 3,7  or  --all-except-admins')

    def describe(self, user):
        company = getattr(user, 'company_profile', None) if user.role == User.Role.COMPANY else None
        student = getattr(user, 'student_profile', None) if user.role == User.Role.STUDENT else None
        if company:
            return f'"{company.company_name}", {company.campaigns.count()} project(s)'
        if student:
            return f'"{student.full_name}", on {student.assigned_jobs.count()} project(s)'
        return ''

    def pick_users(self, emails, everyone):
        users = User.objects.none()
        if everyone:
            users = User.objects.exclude(Q(role=User.Role.ADMIN) | Q(is_superuser=True))
        elif emails:
            users = User.objects.filter(email__in=emails)
            found = {e.lower() for e in users.values_list('email', flat=True)}
            missing = [e for e in emails if e not in found]
            if missing:
                raise CommandError('No account with: ' + ', '.join(missing) + '. Check the spelling (run with no options to list accounts).')
            admins = [u.email for u in users if u.role == User.Role.ADMIN or u.is_superuser]
            if admins:
                raise CommandError('Admin accounts are never removed by this command: ' + ', '.join(admins))
        return users

    def pick_projects(self, project_ids):
        campaigns = Campaign.objects.filter(id__in=project_ids)
        missing = sorted(set(project_ids) - set(campaigns.values_list('id', flat=True)))
        if missing:
            raise CommandError('No project numbered: ' + ', '.join(map(str, missing)))
        return campaigns

    def check_shared_projects(self, users, campaigns, force):
        """A student being removed may be on a project whose client stays. Removing them would also remove
        their payouts and submitted work from that client's project, so make the caller say so."""
        kept = (Campaign.objects.filter(assigned_students__user__in=users)
                .exclude(company__user__in=users).exclude(pk__in=campaigns).distinct())
        if kept.exists() and not force:
            lines = [f'  #{c.id} "{c.title}" (client {c.company.user.email})' for c in kept.select_related('company__user')]
            raise CommandError(
                'These projects belong to clients you are keeping, but have students you are removing:\n' + '\n'.join(lines) +
                '\nRemoving the students would also delete their payouts and submitted work on those projects. '
                'Add the projects with --projects, add the clients to --emails, or pass --force to go ahead anyway.'
            )

    # ------------------------------------------------------------------
    def delete(self, users, campaigns):
        """Delete inside the caller's transaction. Returns ({model label: rows}, [(storage, file name)])."""
        totals, files = {}, []

        def run(queryset):
            collector = Collector(using=router.db_for_write(queryset.model))
            collector.collect(queryset)
            files.extend(self.files_in(collector))
            for label, count in collector.delete()[1].items():
                totals[label] = totals.get(label, 0) + count

        # Invoices protect their project and client from deletion, so they go first
        run(Invoice.objects.filter(Q(company__user__in=users) | Q(campaign__company__user__in=users) | Q(campaign__in=campaigns)))
        run(Campaign.objects.filter(pk__in=list(campaigns.values_list('pk', flat=True))))
        run(User.objects.filter(pk__in=list(users.values_list('pk', flat=True))))
        return {label: count for label, count in totals.items() if count}, sorted(set(files), key=lambda f: f[1])

    def files_in(self, collector):
        found = []

        def scan(model, objects):
            fields = [f for f in model._meta.get_fields() if isinstance(f, models.FileField)]
            for obj in (objects if fields else []):
                for field in fields:
                    stored = getattr(obj, field.name)
                    if stored and stored.name:
                        found.append((stored.storage, stored.name))

        for model, objects in collector.data.items():
            scan(model, objects)
        for queryset in collector.fast_deletes:
            scan(queryset.model, queryset)
        return found

    def storage_name(self):
        from django.conf import settings
        return f'the "{settings.AWS_STORAGE_BUCKET_NAME}" bucket' if settings.USE_S3 else 'this computer (not cloud storage)'

    def remove_file(self, storage, name):
        try:
            if not storage.exists(name):
                return False
            storage.delete(name)
            return True
        except Exception as exc:  # noqa: BLE001 - a missing file must not stop the rest
            self.stderr.write(f'  could not remove file {name}: {exc}')
            return False

    def report(self, accounts, projects, deleted, files, done):
        verb = 'Removed' if done else 'Would remove'
        self.stdout.write(f'{verb} {len(accounts)} account(s):')
        for line in accounts:
            self.stdout.write(f'  {line}')
        self.stdout.write('')
        self.stdout.write(f'{verb} {len(projects)} project(s):')
        for line in projects:
            self.stdout.write(f'  {line}')
        self.stdout.write('')
        self.stdout.write('In total:')
        labels = {
            'users.User': 'accounts', 'users.CompanyProfile': 'client profiles', 'users.StudentProfile': 'student profiles',
            'users.ClubProfile': 'club profiles', 'users.AgreementAcceptance': 'agreement acceptances',
            'campaigns.Campaign': 'projects', 'campaigns.Milestone': 'milestones', 'campaigns.MatchOffer': 'match offers',
            'campaigns.ImpactLedger': 'impact ledgers', 'campaigns.ProjectImpactReport': 'impact statements',
            'campaigns.StudentDeliverable': 'submitted work', 'campaigns.ClientAsset': 'client files',
            'payments.Transaction': 'payment records', 'payments.Payout': 'payouts', 'payments.Invoice': 'invoices',
            'payments.Subscription': 'plan records', 'campaigns.Campaign_assigned_students': 'team assignments',
            'campaigns.ProjectTeamInvitation': 'team invitations', 'campaigns.MilestoneMessage': 'milestone messages',
        }
        for label, count in sorted(deleted.items(), key=lambda item: labels.get(item[0], item[0])):
            self.stdout.write(f'  {count:>4}  {labels.get(label, label)}')
        self.stdout.write(f'  {len(files):>4}  uploaded files')
        if not deleted:
            self.stdout.write('  nothing')
