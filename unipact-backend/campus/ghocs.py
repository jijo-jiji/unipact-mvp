"""GHOCS vocabulary shared by clubs, news, activities and (from M4) points.

Values match the GHOCS student manual v2.0 and Ashraf Rahimi's UniKLSKILL forms, so labels read the same as
what students already see in ECITIE.
"""
from django.db import models


class DnaCategory(models.TextChoices):
    ACTIVE_PROGRAMME = 'ACTIVE_PROGRAMME', 'Active Programme'
    SPORTS_RECREATION = 'SPORTS_RECREATION', 'Sports & Recreation'
    ENTREPRENEUR = 'ENTREPRENEUR', 'Entrepreneur'
    GLOBAL = 'GLOBAL', 'Global'
    GRADUATE = 'GRADUATE', 'Graduate'
    LEADERSHIP = 'LEADERSHIP', 'Leadership'


class MeritElement(models.TextChoices):
    """S.P.I.C.E.S, the six Student Character Building elements."""
    SPIRITUAL = 'SPIRITUAL', 'Spiritual'
    PHYSICAL = 'PHYSICAL', 'Physical'
    INTELLECTUAL = 'INTELLECTUAL', 'Intellectual'
    CAREER = 'CAREER', 'Career'
    EMOTIONAL = 'EMOTIONAL', 'Emotional'
    SOCIAL = 'SOCIAL', 'Social'


class ActivityLevel(models.TextChoices):
    CAMPUS = 'CAMPUS', 'Campus'
    UNIVERSITY = 'UNIVERSITY', 'University'
    STATE = 'STATE', 'State'
    NATIONAL = 'NATIONAL', 'National'
    INTERNATIONAL = 'INTERNATIONAL', 'International'


class ClubType(models.TextChoices):
    """From the UniKL student club proposal template."""
    ACADEMIC = 'ACADEMIC', 'Academic'
    SPORTS = 'SPORTS', 'Sports'
    CULTURAL = 'CULTURAL', 'Cultural'
    VOLUNTEER = 'VOLUNTEER', 'Volunteer'
    OTHER = 'OTHER', 'Other'


# The UniKL DNA transferable skills each DNA category feeds (GHOC mapping document)
DNA_TO_SKILLS = {
    DnaCategory.ACTIVE_PROGRAMME: ('SC1', 'SC2', 'SC3'),
    DnaCategory.SPORTS_RECREATION: ('SC1', 'SC2', 'SC3'),
    DnaCategory.ENTREPRENEUR: ('SC4', 'SC5'),
    DnaCategory.GLOBAL: ('SC2', 'SC3'),
    DnaCategory.GRADUATE: ('SC2', 'SC3', 'SC4'),
    DnaCategory.LEADERSHIP: ('SC1', 'SC2', 'SC5'),
}


def clean_elements(values):
    """A list of S.P.I.C.E.S element codes, de-duplicated, in a fixed order; raises ValueError on an unknown one."""
    values = list(values or [])
    unknown = [v for v in values if v not in MeritElement.values]
    if unknown:
        raise ValueError(f'Unknown merit element: {", ".join(map(str, unknown))}')
    return [v for v in MeritElement.values if v in values]
