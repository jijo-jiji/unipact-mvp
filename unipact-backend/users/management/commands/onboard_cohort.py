import csv
import datetime
import json
import os
import secrets
import string

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from campaigns.models import Campaign
from users.models import CompanyProfile, StudentProfile

User = get_user_model()


def generate_secure_password(length=14):
    """Generates a secure, readable password meeting strong complexity criteria."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    prefix = "Pact" + str(datetime.date.today().year) + "-"
    random_part = "".join(secrets.choice(alphabet) for _ in range(length - len(prefix)))
    return prefix + random_part


class Command(BaseCommand):
    help = "Onboard a pioneer cohort of students and client companies from a structured JSON file for launch."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            required=True,
            help="Path to the cohort JSON definition file (e.g. cohort_softlaunch_template.json).",
        )
        parser.add_argument(
            "--credentials-output",
            type=str,
            default=None,
            help="Optional path to output a CSV file containing generated login credentials.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate data and preview onboarding without writing to the database.",
        )
        parser.add_argument(
            "--domain-url",
            type=str,
            default="http://localhost:5173",
            help="Base URL for the UniPact frontend (default: http://localhost:5173).",
        )

    def handle(self, *args, **options):
        file_path = options["file"]
        credentials_output = options.get("credentials_output")
        dry_run = options.get("dry_run", False)
        domain_url = options.get("domain_url", "http://localhost:5173").rstrip("/")

        if not os.path.exists(file_path):
            raise CommandError(f"Cohort file not found: {file_path}")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON format in {file_path}: {exc}")
        except Exception as exc:
            raise CommandError(f"Error reading file {file_path}: {exc}")

        students_data = data.get("students", [])
        companies_data = data.get("companies", [])

        if not students_data and not companies_data:
            raise CommandError("Cohort file must contain at least one student or company.")

        self.stdout.write(self.style.NOTICE(f"[INFO] Loaded {len(students_data)} students and {len(companies_data)} companies from {file_path}"))
        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY-RUN] Running in preview mode. No database records will be modified."))

        # Validate entries
        self._validate_cohort_data(students_data, companies_data)

        if dry_run:
            self.stdout.write(self.style.SUCCESS("[SUCCESS] Cohort structure and validation passed successfully! (Dry-run complete)"))
            return

        credentials_records = []

        with transaction.atomic():
            now = timezone.now()

            # 1. Onboard Students
            created_students_count = 0
            for item in students_data:
                email = item["email"].strip().lower()
                full_name = item["full_name"].strip()
                university = item.get("university", "Universiti Malaya (UM)").strip()
                major = item.get("major", "").strip()
                domain_focus = item.get("domain_focus", StudentProfile.DomainFocus.SOFTWARE_DEV)
                skills = item.get("skills", [])
                bio = item.get("bio", "").strip()

                password = item.get("password")
                if not password or not password.strip():
                    password = generate_secure_password()
                else:
                    password = password.strip()

                username = email.split("@")[0]
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exclude(email=email).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                user, user_created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "username": username,
                        "role": User.Role.STUDENT,
                        "is_verified": True,
                        # The admin collected this address from the participant directly
                        "email_verified": True,
                        "terms_accepted_at": now,
                    },
                )
                if not user_created:
                    user.role = User.Role.STUDENT
                    user.is_verified = True
                    user.email_verified = True
                    if not user.terms_accepted_at:
                        user.terms_accepted_at = now

                user.set_password(password)
                user.save()

                StudentProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "full_name": full_name,
                        "university": university,
                        "major": major,
                        "domain_focus": domain_focus,
                        "skills": skills,
                        "bio": bio,
                        "verification_status": StudentProfile.VerificationStatus.VERIFIED,
                    },
                )
                created_students_count += 1

                credentials_records.append({
                    "Role": "Student",
                    "Entity / Name": full_name,
                    "Email": email,
                    "Temporary Password": password,
                    "Login URL": f"{domain_url}/login",
                    "Domain / Notes": domain_focus,
                })

            # 2. Onboard Companies & Initial Campaigns
            created_companies_count = 0
            created_campaigns_count = 0

            for comp in companies_data:
                email = comp["email"].strip().lower()
                company_name = comp["company_name"].strip()
                tier = comp.get("tier", CompanyProfile.Tier.PRO)
                if tier not in CompanyProfile.Tier.values:
                    tier = CompanyProfile.Tier.PRO
                industry = comp.get("industry", "").strip()

                password = comp.get("password")
                if not password or not password.strip():
                    password = generate_secure_password()
                else:
                    password = password.strip()

                username = email.split("@")[0]
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exclude(email=email).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                user, user_created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "username": username,
                        "role": User.Role.COMPANY,
                        "is_verified": True,
                        # The admin collected this address from the participant directly
                        "email_verified": True,
                        "terms_accepted_at": now,
                    },
                )
                if not user_created:
                    user.role = User.Role.COMPANY
                    user.is_verified = True
                    user.email_verified = True
                    if not user.terms_accepted_at:
                        user.terms_accepted_at = now

                user.set_password(password)
                user.save()

                company_profile, _ = CompanyProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "company_name": company_name,
                        "company_details": f"Industry: {industry}" if industry else "",
                        "tier": tier,
                        "verification_status": CompanyProfile.VerificationStatus.VERIFIED,
                    },
                )
                created_companies_count += 1

                # 3. Create Campaign if attached
                campaign_data = comp.get("campaign")
                campaign_title = "None"
                if campaign_data:
                    c_title = campaign_data["title"].strip()
                    c_type = campaign_data["type"].strip()
                    c_budget = campaign_data.get("budget", 1500.00)
                    c_desc = campaign_data.get("description", "").strip()
                    c_reqs = campaign_data.get("requirements", [])
                    c_sub_type = campaign_data.get("software_sub_type", "")
                    c_skills = campaign_data.get("required_skills", [])
                    c_outcome = campaign_data.get("project_outcome", "")
                    c_objective = campaign_data.get("campaign_objective", "")
                    c_platforms = campaign_data.get("target_platforms", [])
                    deadline_str = campaign_data.get("deadline")
                    deadline = None
                    if deadline_str:
                        try:
                            deadline = datetime.date.fromisoformat(deadline_str)
                        except ValueError:
                            deadline = None

                    Campaign.objects.update_or_create(
                        company=company_profile,
                        title=c_title,
                        defaults={
                            "type": c_type,
                            "budget": c_budget,
                            "description": c_desc,
                            "requirements": c_reqs,
                            "software_sub_type": c_sub_type,
                            "required_skills": c_skills,
                            "project_outcome": c_outcome,
                            "campaign_objective": c_objective,
                            "target_platforms": c_platforms,
                            "deadline": deadline,
                            "status": Campaign.Status.OPEN,
                        },
                    )
                    created_campaigns_count += 1
                    campaign_title = c_title

                credentials_records.append({
                    "Role": "Company",
                    "Entity / Name": company_name,
                    "Email": email,
                    "Temporary Password": password,
                    "Login URL": f"{domain_url}/login",
                    "Domain / Notes": f"Project: {campaign_title}",
                })

        # Output credentials CSV if requested
        if credentials_output:
            try:
                out_dir = os.path.dirname(os.path.abspath(credentials_output))
                if out_dir and not os.path.exists(out_dir):
                    os.makedirs(out_dir, exist_ok=True)

                fieldnames = ["Role", "Entity / Name", "Email", "Temporary Password", "Login URL", "Domain / Notes"]
                with open(credentials_output, "w", newline="", encoding="utf-8") as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                    writer.writeheader()
                    for row in credentials_records:
                        writer.writerow(row)
                self.stdout.write(self.style.SUCCESS(f"[OK] Credentials exported to: {credentials_output}"))
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"Failed to export credentials CSV: {exc}"))

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Cohort Onboarding Completed!"))
        self.stdout.write(f"   - Students onboarded:  {created_students_count}")
        self.stdout.write(f"   - Companies onboarded: {created_companies_count}")
        self.stdout.write(f"   - Campaigns published: {created_campaigns_count}")

    def _validate_cohort_data(self, students, companies):
        seen_emails = set()

        for idx, s in enumerate(students):
            email = s.get("email", "").strip().lower()
            if not email or "@" not in email:
                raise CommandError(f"Student #{idx+1}: Missing or invalid email: '{email}'")
            if email in seen_emails:
                raise CommandError(f"Duplicate email found in cohort file: '{email}'")
            seen_emails.add(email)

            if not s.get("full_name", "").strip():
                raise CommandError(f"Student '{email}': full_name is required.")

            focus = s.get("domain_focus", StudentProfile.DomainFocus.SOFTWARE_DEV)
            if focus not in StudentProfile.DomainFocus.values:
                raise CommandError(f"Student '{email}': Invalid domain_focus '{focus}'. Must be one of {StudentProfile.DomainFocus.values}")

        for idx, c in enumerate(companies):
            email = c.get("email", "").strip().lower()
            if not email or "@" not in email:
                raise CommandError(f"Company #{idx+1}: Missing or invalid email: '{email}'")
            if email in seen_emails:
                raise CommandError(f"Duplicate email found in cohort file: '{email}'")
            seen_emails.add(email)

            if not c.get("company_name", "").strip():
                raise CommandError(f"Company '{email}': company_name is required.")

            camp = c.get("campaign")
            if camp:
                if not camp.get("title", "").strip():
                    raise CommandError(f"Company '{email}' campaign missing title.")
                c_type = camp.get("type", "").strip()
                if c_type not in Campaign.Type.values:
                    raise CommandError(f"Company '{email}' campaign invalid type '{c_type}'. Must be one of {Campaign.Type.values}")
                if "budget" not in camp:
                    raise CommandError(f"Company '{email}' campaign missing budget.")
