from django.core.management.base import BaseCommand

from campaigns.deadlines import run_deadlines


class Command(BaseCommand):
    help = (
        "Apply the agreements' time limits: accept milestones the client has not reviewed within "
        "ACCEPTANCE_WORKING_DAYS, and remind admins of student payouts nearing PAYOUT_WORKING_DAYS. "
        "The site also runs these checks as people use it; schedule this command daily if the host has a scheduler."
    )

    def handle(self, *args, **options):
        result = run_deadlines()
        self.stdout.write(self.style.SUCCESS(
            f"Milestones accepted automatically: {result['milestones_accepted']}. Payouts reminded: {result['payouts_reminded']}."
        ))
