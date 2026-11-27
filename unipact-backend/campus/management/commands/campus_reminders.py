"""Daily reminders for UniPact Campus. Run once a day (a Render cron job, or by hand):

    python manage.py campus_reminders

Activity reports: the committee is emailed 1 day after a published activity ends, on its due date (the campus's
report_due_days, 14 by default), then weekly for two more weeks, until a report is submitted.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from campus import emails
from campus.models import Activity, ActivityPolicy, ReportReminder
from campus.views_activities import committee_of


def report_schedule(due_days):
    """Days after the activity ends on which a reminder goes out."""
    return [1, due_days, due_days + 7, due_days + 14]


class Command(BaseCommand):
    help = 'Email Campus reminders (activity reports that are due or late). Safe to run more than once a day.'

    def handle(self, *args, **options):
        now = timezone.now()
        sent = 0
        waiting = Activity.objects.filter(status=Activity.Status.PUBLISHED, ends_at__lt=now - timedelta(days=1),
                                          report__isnull=True).select_related('club')
        for activity in waiting:
            policy = ActivityPolicy.for_campus(activity.club.campus)
            schedule = report_schedule(policy.report_due_days)
            reminder = ReportReminder.objects.filter(activity=activity).first()
            count = reminder.count if reminder else 0
            if count >= len(schedule):
                continue
            days_since_end = (now - activity.ends_at).days
            if days_since_end < schedule[count]:
                continue
            emails.activity_report_reminder(activity, committee_of(activity.club),
                                            days_late=days_since_end - policy.report_due_days)
            ReportReminder.objects.update_or_create(activity=activity,
                                                    defaults={'count': count + 1, 'last_sent_at': now})
            sent += 1
        self.stdout.write(f'Sent {sent} activity report reminder(s).')
