"""Shared bits for tests that go through the sign-up forms."""
import itertools

_students = itertools.count(1)

# What the company/NGO sign-up form requires on top of email, password and name
COMPANY_SIGNUP = {'registration_number': '202603205508'}


def student_signup(**overrides):
    """The contact and availability fields the student sign-up form requires, with a unique university email."""
    n = next(_students)
    return {
        'whatsapp_number': '012-345 6789',
        'university_email': f'student{n}@siswa.um.edu.my',
        'year_of_study': 2,
        'current_semester': 1,
        'weekly_availability': '6-10',
        'portfolio_url': 'https://github.com/student',
        **overrides,
    }
