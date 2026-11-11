"""Connect workshop check-ins to student accounts by email, whichever comes first."""
from users.models import StudentProfile

from .models import WorkshopAttendee


def student_for_email(email):
    email = (email or '').strip().lower()
    if not email:
        return None
    return (StudentProfile.objects.filter(user__email__iexact=email).first()
            or StudentProfile.objects.filter(university_email__iexact=email).first())


def link_profile(profile):
    """Attach any unlinked check-ins made with this student's personal or university email."""
    emails = {e.strip().lower() for e in (profile.user.email, profile.university_email) if e}
    if emails:
        WorkshopAttendee.objects.filter(student__isnull=True, email__in=emails).update(student=profile)
