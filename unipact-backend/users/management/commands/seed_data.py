import random
from faker import Faker
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError
from users.models import CompanyProfile, ClubProfile
from campaigns.models import Campaign, Application

User = get_user_model()
fake = Faker()

# Constants
MALAYSIAN_UNIVERSITIES = [
    "Universiti Malaya (UM)",
    "Universiti Sains Malaysia (USM)",
    "Universiti Kebangsaan Malaysia (UKM)",
    "Sunway University",
    "Taylor's University",
    "Monash University Malaysia",
    "APU",
    "UiTM",
]

CLUB_TYPES = [
    "Business Club", "Robotics Society", "Esports Club", "Debate Team",
    "Cultural Society", "Coding Club", "Volunteer Society", "Music Club"
]

INDUSTRIES = ["Tech", "FMCG", "Finance", "Energy", "Retail", "Healthcare"]

COMPANY_NAMES = [
    "Maxis", "Petronas", "Grab", "TechStart PLT", "Maybank", "CIMB",
    "Axiata", "Genting", "IOI Properties", "Sunway Group", "Touch 'n Go",
    "FoodPanda", "Shopee", "Lazada", "AirAsia"
]

class Command(BaseCommand):
    help = 'Seeds the database with realistic mock data for UniPact'

    def handle(self, *args, **options):
        self.stdout.write("🌱 Starting User Seed Process...")
        
        self.create_companies()
        self.create_clubs()
        self.run_campaigns_logic()
        
        self.stdout.write(self.style.SUCCESS("✅ Seeding Complete!"))

    def create_companies(self):
        self.stdout.write(".. Generating 50 Companies")
        count = 0
        for i in range(50):
            try:
                # 1. Create User
                email = f"company_{i}_{fake.unique.random_number(digits=4)}@example.com"
                user, created = User.objects.get_or_create(
                    username=email,
                    email=email,
                    defaults={
                        'role': User.Role.COMPANY,
                        'is_verified': random.choice([True, False])
                    }
                )
                if created:
                    user.set_password('password123')
                    user.save()

                    # 2. Create CompanyProfile
                    # Use real names list or fallback to fake
                    if i < len(COMPANY_NAMES):
                        comp_name = COMPANY_NAMES[i]
                    else:
                        comp_name = f"{fake.company()} {random.choice(['Sdn Bhd', 'PLT', 'Group'])}"

                    tier = CompanyProfile.Tier.PRO if random.random() < 0.2 else CompanyProfile.Tier.FREE
                    
                    CompanyProfile.objects.create(
                        user=user,
                        company_name=comp_name,
                        company_details=fake.bs(),
                        tier=tier,
                        verification_status=CompanyProfile.VerificationStatus.VERIFIED if user.is_verified else CompanyProfile.VerificationStatus.PENDING_REVIEW
                    )
                    count += 1
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f"Skipped duplicate company {i}"))
                continue
        
        self.stdout.write(f"Created {count} Companies.")

    def create_clubs(self):
        self.stdout.write(".. Generating 10 Student Clubs (Presidents)")
        count = 0
        for i in range(10):
            try:
                # 1. Create User
                email = f"club_{i}_{fake.unique.random_number(digits=4)}@student.edu.my"
                user, created = User.objects.get_or_create(
                    username=email,
                    email=email,
                    defaults={
                        'role': User.Role.CLUB,
                        'is_verified': True
                    }
                )
                if created:
                    user.set_password('password123')
                    user.save()

                    # 2. Create ClubProfile
                    univ = random.choice(MALAYSIAN_UNIVERSITIES)
                    c_type = random.choice(CLUB_TYPES)
                    
                    ClubProfile.objects.create(
                        user=user,
                        club_name=f"{univ} {c_type}",
                        university=univ,
                        rank=random.choice(ClubProfile.Rank.choices)[0], # Get the value e.g. 'S'
                        verification_status=ClubProfile.VerificationStatus.VERIFIED
                    )
                    count += 1
            except IntegrityError:
                continue
        self.stdout.write(f"Created {count} Clubs.")

    def run_campaigns_logic(self):
        self.stdout.write(".. Generating Campaigns & Applications")
        companies = CompanyProfile.objects.all()
        clubs = ClubProfile.objects.all()
        
        if not companies.exists() or not clubs.exists():
            self.stdout.write(self.style.WARNING("Not enough data to generate campaigns."))
            return

        total_campaigns = 0
        total_apps = 0

        for company in companies:
            # Create 1-5 Campaigns
            num_campaigns = random.randint(1, 5)
            for _ in range(num_campaigns):
                status_choice = random.choice([
                    Campaign.Status.OPEN, 
                    Campaign.Status.IN_PROGRESS, 
                    Campaign.Status.COMPLETED
                ])
                
                # Mock Titles
                adjective = random.choice(["Global", "Campus", "Future", "Innovative", "Creative"])
                noun = random.choice(["Ambassador", "Hackathon", "Challenge", "Survey", "Focus Group"])
                title = f"{company.company_name}: {adjective} {noun}"

                campaign = Campaign.objects.create(
                    company=company,
                    title=title,
                    description=fake.paragraph(nb_sentences=3),
                    type=random.choice(Campaign.Type.choices)[0],
                    budget=random.randint(5, 100) * 100, # 500 to 10000
                    status=status_choice,
                    deadline=fake.future_date(end_date='+30d'),
                    requirements=["Must be active", "Submit screenshot"]
                )
                total_campaigns += 1

                # Generate Applications logic
                # Random clubs apply
                if status_choice != Campaign.Status.DRAFT:
                    # Random subset of clubs apply (0 to 3)
                    applicants = random.sample(list(clubs), k=random.randint(0, min(3, len(clubs))))
                    
                    for club in applicants:
                        app_status = Application.Status.PENDING
                        if status_choice == Campaign.Status.IN_PROGRESS:
                            # If campaign is in progress, some might be awarded
                            app_status = random.choice([Application.Status.PENDING, Application.Status.AWARDED])
                        elif status_choice == Campaign.Status.COMPLETED:
                            app_status = Application.Status.COMPLETED

                        Application.objects.create(
                            campaign=campaign,
                            club=club,
                            message=fake.sentence(),
                            status=app_status
                        )
                        total_apps += 1

        self.stdout.write(f"Created {total_campaigns} Campaigns and {total_apps} Applications.")
