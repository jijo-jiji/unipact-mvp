
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
