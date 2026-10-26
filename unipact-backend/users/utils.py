
PUBLIC_DOMAINS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 
    'yandex.com', 'mail.com', 'gmx.com'
}

def is_public_domain(email):
    try:
        domain = email.split('@')[1].lower()
        return domain in PUBLIC_DOMAINS
    except IndexError:
        return False

def log_event(category, level, message):
    from .models import SystemLog
    try:
        SystemLog.objects.create(
            category=category,
            level=level,
            message=message
        )
    except Exception as e:
        print(f"Logging Failed: {e}")


# --- Email address confirmation -------------------------------------------------
# The link is a signed token rather than a stored row: it expires by itself, and signing the
# address alongside the id means a link stops working the moment someone changes their email.
EMAIL_VERIFY_SALT = 'unipact.email-verify'


def make_email_verification_token(user):
    from django.core import signing
    return signing.dumps({'uid': user.pk, 'email': user.email}, salt=EMAIL_VERIFY_SALT)


def read_email_verification_token(token, max_age=None):
    """Return the user the token belongs to, or None if it is invalid, expired or stale."""
    from django.conf import settings
    from django.core import signing
    from .models import User

    try:
        data = signing.loads(token, salt=EMAIL_VERIFY_SALT, max_age=max_age or settings.EMAIL_VERIFY_TIMEOUT)
    except signing.BadSignature:
        return None

    user = User.objects.filter(pk=data.get('uid'), is_active=True).first()
    if not user or user.email.lower() != str(data.get('email', '')).lower():
        return None
    return user


def email_verification_path(user):
    from urllib.parse import urlencode
    return f"/verify-email?{urlencode({'token': make_email_verification_token(user)})}"


# --- Accounts an admin created ------------------------------------------------------
# The account has no password until its owner picks one from the emailed link, so the admin never
# knows it. The token signs the account's current (unusable) password hash: once a password is set
# the hash changes and every link sent for that account stops working.
ACCOUNT_INVITE_SALT = 'unipact.account-invite'


def make_invitation_token(user):
    from django.core import signing
    return signing.dumps({'uid': user.pk, 'pw': user.password[-16:]}, salt=ACCOUNT_INVITE_SALT)


def read_invitation_token(token, max_age=None):
    """The account the link was sent for, or None if the link is invalid, expired or already used."""
    from django.conf import settings
    from django.core import signing
    from .models import User

    try:
        data = signing.loads(token, salt=ACCOUNT_INVITE_SALT, max_age=max_age or settings.ACCOUNT_INVITE_TIMEOUT)
    except signing.BadSignature:
        return None
    user = User.objects.filter(pk=data.get('uid'), is_active=True).first()
    if not user or user.has_usable_password() or user.password[-16:] != data.get('pw'):
        return None
    return user


def invitation_path(user):
    from urllib.parse import urlencode
    return f"/welcome?{urlencode({'token': make_invitation_token(user)})}"
