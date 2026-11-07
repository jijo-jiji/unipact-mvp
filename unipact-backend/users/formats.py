"""Checks for the Malaysian identifiers people type in at sign-up: mobile numbers, university emails,
SSM company numbers and ROS (KDN) society numbers. Each returns the cleaned value or raises
ValidationError with a message that shows the expected format."""
import re
from datetime import date

from django.conf import settings
from rest_framework.exceptions import ValidationError

# Malaysian universities whose student email isn't under .edu.my or .edu
UNIVERSITY_EMAIL_DOMAINS = {
    'utm.my', 'usm.my', 'unimas.my', 'ums.edu.my', 'uitm.edu.my', 'unikl.edu.my', 'umpsa.edu.my',
}
ACADEMIC_SUFFIXES = ('.edu.my', '.edu', '.ac.uk', '.edu.au', '.ac.id', '.edu.sg')


def malaysian_mobile(value):
    """'012-345 6789', '+60 12-345 6789' or '60123456789' -> '+60123456789'."""
    digits = re.sub(r'[\s()+.-]', '', str(value or ''))
    if digits.startswith('60'):
        digits = '0' + digits[2:]
    if not re.fullmatch(r'01\d{8,9}', digits):
        raise ValidationError('Enter a Malaysian mobile number, e.g. 012-345 6789.')
    return '+6' + digits


def university_email(value):
    email = str(value or '').strip().lower()
    domain = email.rpartition('@')[2]
    allowed = UNIVERSITY_EMAIL_DOMAINS | set(getattr(settings, 'EXTRA_UNIVERSITY_EMAIL_DOMAINS', []))
    if not (domain.endswith(ACADEMIC_SUFFIXES) or any(domain == d or domain.endswith('.' + d) for d in allowed)):
        raise ValidationError(
            'Use the email your university gave you, e.g. you@siswa.um.edu.my. '
            'If your university uses a different address, contact UniPact support.'
        )
    return email


def ssm_number(value):
    """SSM's 12-digit registration number (since 2019): year, entity type, running number,
    e.g. 202603205508 = registered 2026, type 03 (business), number 205508."""
    number = re.sub(r'[\s-]', '', str(value or ''))
    hint = 'Enter the 12-digit SSM registration number, e.g. 202603205508.'
    if not re.fullmatch(r'\d{12}', number):
        raise ValidationError(hint)
    year, entity_type = int(number[:4]), number[4:6]
    if not (1900 <= year <= date.today().year) or entity_type not in {'01', '02', '03', '04', '05', '06'}:
        raise ValidationError(hint)
    return number


def ros_number(value):
    """A society registered with the Registry of Societies (ROS, under KDN), e.g. PPM-011-10-25022025:
    PPM, a 3-digit number, the 2-digit state code and the registration date (DDMMYYYY)."""
    number = re.sub(r'\s', '', str(value or '')).upper()
    hint = 'Enter the ROS (KDN) registration number, e.g. PPM-011-10-25022025.'
    match = re.fullmatch(r'PPM-(\d{3})-(\d{2})-(\d{2})(\d{2})(\d{4})', number)
    if not match:
        raise ValidationError(hint)
    _, state, day, month, year = match.groups()
    try:
        registered = date(int(year), int(month), int(day))
    except ValueError:
        raise ValidationError(hint)
    if not (1 <= int(state) <= 16) or registered > date.today():
        raise ValidationError(hint)
    return number


def linkedin_url(value):
    url = str(value or '').strip()
    if url and not re.match(r'^https://([a-z]{2,3}\.)?linkedin\.com/', url, re.I):
        raise ValidationError('Enter your LinkedIn profile link, e.g. https://www.linkedin.com/in/your-name.')
    return url
