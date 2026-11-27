"""Create UniKL MIIT's structure for UniPact Campus, as shown on MIIT's "Template Proposal SAF 2026" forms.

    python manage.py seed_campus_miit

Safe to run again: it only adds what is missing. It creates units, not people. Staff are invited afterwards
(Campus → Staff), and their roles are given there, so no real names live in the code.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from campus.models import OrgUnit

K = OrgUnit.Kind

# (name, short name, kind, sector, children)
TREE = ('Universiti Kuala Lumpur', 'UniKL', K.UNIVERSITY, '', [
    ('UniKL Malaysian Institute of Information Technology', 'MIIT', K.CAMPUS, '', [
        ('Management and Finance', 'HOMF', K.OFFICE, '', []),
        ('Deputy Dean (A&T)', 'DD A&T', K.OFFICE, '', []),
        ('Deputy Dean (IIIP)', 'DD IIIP', K.OFFICE, '', []),
        ('Deputy Dean (Student Development & Campus Lifestyle)', 'DD SDCL', K.OFFICE, '', [
            ('Student Development Section', 'SD', K.SECTION, OrgUnit.Sector.SD, []),
            ('Campus Lifestyle Section', 'CL', K.SECTION, OrgUnit.Sector.CL, []),
        ]),
        ('Student Representative Committee', 'SRC', K.BODY, '', []),
    ]),
])


class Command(BaseCommand):
    help = "Create UniKL MIIT's offices, sections and SRC for UniPact Campus (idempotent; no people)."

    @transaction.atomic
    def handle(self, *args, **options):
        created = []

        def build(node, parent):
            name, short, kind, sector, children = node
            unit, made = OrgUnit.objects.get_or_create(
                parent=parent, name=name, defaults={'short_name': short, 'kind': kind, 'sector': sector})
            if made:
                created.append(unit)
            for child in children:
                build(child, unit)

        build(TREE, None)
        if created:
            for unit in created:
                self.stdout.write(f'  + {unit.get_kind_display()}: {unit.name}')
            self.stdout.write(self.style.SUCCESS(f'Created {len(created)} unit(s).'))
        else:
            self.stdout.write('Everything already exists; nothing to add.')
        self.stdout.write('Next: invite staff and give them roles under Campus → Staff, then add clubs '
                          'under the SD or CL section.')
