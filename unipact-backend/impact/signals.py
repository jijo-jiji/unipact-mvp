from django.db.models.signals import post_save
from django.dispatch import receiver

from users.models import StudentProfile

from .linking import link_profile


@receiver(post_save, sender=StudentProfile)
def link_workshop_checkins(sender, instance, **kwargs):
    # On sign-up, and again if they add a university email later
    link_profile(instance)
