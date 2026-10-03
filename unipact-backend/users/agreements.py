"""The agreements people accept inside the app: the Talent Agreement (students) and the Client Service
Agreement (companies). The wording lives in the frontend (src/pages/AgreementPages.jsx).

Each acceptance is stored with the version accepted and when. Bump a version here, together with the
wording and src/utils/agreements.js, whenever an agreement's text changes: everyone is then asked to
accept the new version before their next job or payment.
"""
from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException

TALENT = 'TALENT'
CLIENT = 'CLIENT'

CURRENT_VERSIONS = {
    TALENT: '2026-09-29-draft',
    CLIENT: '2026-09-29-draft',
}
TITLES = {
    TALENT: 'Talent Agreement',
    CLIENT: 'Client Service Agreement',
}


class AgreementRequired(APIException):
    """Raised before a job is accepted or money changes hands without the current agreement on record."""
    status_code = status.HTTP_403_FORBIDDEN
    default_code = 'agreement_required'

    def __init__(self, agreement):
        super().__init__({
            'error': f'Please read and accept the {TITLES[agreement]} to continue.',
            'code': 'agreement_required',
            'agreement': agreement,
            'version': CURRENT_VERSIONS[agreement],
        })


def agreement_for(user):
    """The agreement that applies to this kind of account, if any."""
    from .models import User

    return {User.Role.STUDENT: TALENT, User.Role.COMPANY: CLIENT}.get(getattr(user, 'role', None))


def has_accepted(user, agreement):
    from .models import AgreementAcceptance

    return AgreementAcceptance.objects.filter(user=user, agreement=agreement, version=CURRENT_VERSIONS[agreement]).exists()


def record_acceptance(user, agreement):
    from .models import AgreementAcceptance

    acceptance, _ = AgreementAcceptance.objects.get_or_create(user=user, agreement=agreement, version=CURRENT_VERSIONS[agreement])
    return acceptance


def status_for(user):
    """What the app shows this user: their agreement, the current version and whether they have accepted it."""
    from .models import AgreementAcceptance

    agreement = agreement_for(user)
    if not agreement:
        return []
    acceptance = AgreementAcceptance.objects.filter(user=user, agreement=agreement, version=CURRENT_VERSIONS[agreement]).first()
    return [{
        'agreement': agreement,
        'title': TITLES[agreement],
        'version': CURRENT_VERSIONS[agreement],
        'accepted': acceptance is not None,
        'accepted_at': acceptance.accepted_at if acceptance else None,
    }]


def require(user, agreement):
    if settings.AGREEMENTS_ENFORCED and not has_accepted(user, agreement):
        raise AgreementRequired(agreement)
