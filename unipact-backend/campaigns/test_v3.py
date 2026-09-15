from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import User, CompanyProfile, StudentProfile
from campaigns.models import Campaign, ClientAsset, StudentDeliverable

class V3TalentMarketplaceTests(APITestCase):
    def setUp(self):
        # Create Admin
        self.admin_user = User.objects.create_superuser(
            username='admin@unipact.my',
            email='admin@unipact.my',
            password='AdminPassword123!',
            role=User.Role.ADMIN
        )

        # Create Company
        self.company_user = User.objects.create_user(
            username='client@techventures.com',
            email='client@techventures.com',
            password='ClientPassword123!',
            role=User.Role.COMPANY
        )
        self.company_profile = CompanyProfile.objects.create(
            user=self.company_user,
            company_name='TechVentures Sdn Bhd',
            tier=CompanyProfile.Tier.FREE,
            verification_status=CompanyProfile.VerificationStatus.VERIFIED
        )

    def test_student_registration_and_admin_verification(self):
        # 1. Register student
        url = reverse('register_student')
        payload = {
            'accept_terms': True,
            'full_name': 'Sarah Tan',
            'email': 'sarah@siswa.um.edu.my',
            'password': 'StudentPassword123!',
            'university': 'Universiti Malaya',
            'major': 'Computer Science',
            'domain_focus': 'SOFTWARE_DEV',
            'club_affiliation_name': 'UM Computer Club',
            'club_affiliation_role': 'President'
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['user']['role'], 'STUDENT')
        self.assertEqual(res.data['user']['verification_status'], 'PENDING_VERIFICATION')

        student_user = User.objects.get(email='sarah@siswa.um.edu.my')
        student_profile = student_user.student_profile
        self.assertEqual(student_profile.university, 'Universiti Malaya')
        self.assertEqual(student_profile.club_affiliation_name, 'UM Computer Club')

        # 2. Admin verifies student
        self.client.force_authenticate(user=self.admin_user)
        verify_url = reverse('admin_verify', kwargs={'entity_type': 'STUDENT', 'entity_id': student_profile.id})
        verify_res = self.client.post(verify_url, {'action': 'approve'}, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)

        student_profile.refresh_from_db()
        student_user.refresh_from_db()
        self.assertEqual(student_profile.verification_status, 'VERIFIED')
        self.assertTrue(student_user.is_verified)

    def test_full_v3_matchmaking_and_completion_lifecycle(self):
        # 1. Create Verified Student
        student_user = User.objects.create_user(
            username='dev@siswa.um.edu.my',
            email='dev@siswa.um.edu.my',
            password='DevPassword123!',
            role=User.Role.STUDENT,
            is_verified=True
        )
        student_profile = StudentProfile.objects.create(
            user=student_user,
            full_name='Ali Dev',
            university='Universiti Malaya',
            domain_focus='SOFTWARE_DEV',
            verification_status='VERIFIED'
        )

        # 2. Company posts Software Dev Job
        self.client.force_authenticate(user=self.company_user)
        job_url = reverse('campaign_list_create')
        job_payload = {
            'title': 'CRM Lead Pipeline Tool',
            'description': 'Build CRM automation backend and React frontend.',
            'type': 'SOFTWARE_DEVELOPMENT',
            'software_sub_type': 'CRM',
            'required_skills': ['React', 'Django', 'PostgreSQL'],
            'project_outcome': 'Automate lead scoring.',
            'budget': '3500.00',
            'requirements': ['GitHub repo link', 'Deployed demo URL']
        }
        job_res = self.client.post(job_url, job_payload, format='json')
        self.assertEqual(job_res.status_code, status.HTTP_201_CREATED)
        job_id = job_res.data['id']
        self.assertEqual(job_res.data['type'], 'SOFTWARE_DEVELOPMENT')

        # 3. Admin Matches Student to Job
        self.client.force_authenticate(user=self.admin_user)
        match_url = reverse('admin_matchmaking_assign', kwargs={'campaign_id': job_id})
        match_res = self.client.post(match_url, {
            'student_ids': [student_profile.id],
            'match_notes': 'Ali is top developer in UM.'
        }, format='json')
        self.assertEqual(match_res.status_code, status.HTTP_200_OK)
        self.assertEqual(match_res.data['campaign']['status'], 'MATCHED')

        # 4. Company Finalizes Match (Paying Finder Fee)
        self.client.force_authenticate(user=self.company_user)
        finalize_url = reverse('finalize_match', kwargs={'campaign_id': job_id})
        fin_res = self.client.post(finalize_url, {'mock_pay': True}, format='json')
        self.assertEqual(fin_res.status_code, status.HTTP_200_OK)
        self.assertEqual(fin_res.data['campaign']['status'], 'IN_PROGRESS')

        # 5. Student views assigned job and submits deliverables
        self.client.force_authenticate(user=student_user)
        assigned_url = reverse('student_assigned_jobs')
        assigned_res = self.client.get(assigned_url)
        self.assertEqual(assigned_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(assigned_res.data), 1)

        deliverable_url = reverse('student_submit_deliverable', kwargs={'campaign_id': job_id})
        deliv_res = self.client.post(deliverable_url, {
            'title': 'Completed CRM Repo',
            'external_url': 'https://github.com/siswa-dev/crm',
            'contribution_role': 'Full Stack Engineer',
            'contribution_summary': 'Built Django APIs and React dashboard.'
        }, format='json')
        self.assertEqual(deliv_res.status_code, status.HTTP_201_CREATED)

        # 6. Company Approves Deliverables & Marks Completed
        self.client.force_authenticate(user=self.company_user)
        complete_url = reverse('campaign_complete', kwargs={'campaign_id': job_id})
        comp_res = self.client.post(complete_url, {
            'rating': 5,
            'feedback': 'Outstanding work by student!'
        }, format='json')
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)

        job = Campaign.objects.get(id=job_id)
        self.assertEqual(job.status, 'COMPLETED')
        self.assertTrue(hasattr(job, 'report'))

    def test_student_peer_collaboration_team_invitations(self):
        # 1. Setup Student A (Lead) and Student B (Peer)
        lead_user = User.objects.create_user(
            username='lead@siswa.um.edu.my',
            email='lead@siswa.um.edu.my',
            password='LeadPassword123!',
            role=User.Role.STUDENT,
            is_verified=True
        )
        lead_profile = StudentProfile.objects.create(
            user=lead_user,
            full_name='Lead Student',
            university='Universiti Malaya',
            domain_focus='SOFTWARE_DEV',
            verification_status='VERIFIED'
        )

        peer_user = User.objects.create_user(
            username='designer@siswa.um.edu.my',
            email='designer@siswa.um.edu.my',
            password='DesignerPassword123!',
            role=User.Role.STUDENT,
            is_verified=True
        )
        peer_profile = StudentProfile.objects.create(
            user=peer_user,
            full_name='UI Designer Student',
            university='Universiti Malaya',
            domain_focus='DIGITAL_MARKETING',
            verification_status='VERIFIED'
        )

        # 2. Company creates Campaign and assigns Lead Student
        campaign = Campaign.objects.create(
            company=self.company_profile,
            title='Mobile Banking App Redesign',
            description='3-person squad needed for full redesign and backend integration.',
            type='SOFTWARE_DEVELOPMENT',
            budget=4500.00,
            status=Campaign.Status.IN_PROGRESS
        )
        campaign.assigned_students.add(lead_profile)

        # 3. Lead Student invites Peer Student to join project team
        self.client.force_authenticate(user=lead_user)
        invite_url = reverse('project_team_invite', kwargs={'campaign_id': campaign.id})
        invite_res = self.client.post(invite_url, {
            'email': 'designer@siswa.um.edu.my',
            'role_in_project': 'UI/UX Designer',
            'payout_share_percentage': 30,
            'notes': 'Please handle the Figma wireframes and mobile component design.'
        }, format='json')
        self.assertEqual(invite_res.status_code, status.HTTP_201_CREATED)
        invitation_id = invite_res.data['id']
        self.assertEqual(invite_res.data['role_in_project'], 'UI/UX Designer')
        self.assertEqual(invite_res.data['status'], 'PENDING')

        # 4. Peer Student checks received team invitations
        self.client.force_authenticate(user=peer_user)
        my_invites_url = reverse('my_team_invitations')
        my_invites_res = self.client.get(my_invites_url)
        self.assertEqual(my_invites_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(my_invites_res.data), 1)
        self.assertEqual(my_invites_res.data[0]['campaign_title'], 'Mobile Banking App Redesign')

        # 5. Peer Student accepts the invitation
        respond_url = reverse('respond_team_invitation', kwargs={'invitation_id': invitation_id})
        respond_res = self.client.post(respond_url, {'action': 'accept'}, format='json')
        self.assertEqual(respond_res.status_code, status.HTTP_200_OK)

        # 6. Verify Campaign now has both students assigned
        campaign.refresh_from_db()
        self.assertEqual(campaign.assigned_students.count(), 2)
        self.assertTrue(campaign.assigned_students.filter(id=peer_profile.id).exists())

        # 7. Peer student now sees project in assigned jobs
        peer_jobs_url = reverse('student_assigned_jobs')
        peer_jobs_res = self.client.get(peer_jobs_url)
        self.assertEqual(peer_jobs_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(peer_jobs_res.data), 1)
        self.assertEqual(peer_jobs_res.data[0]['id'], campaign.id)

        # 8. Check team list endpoint returns both members
        team_url = reverse('project_team_list', kwargs={'campaign_id': campaign.id})
        team_res = self.client.get(team_url)
        self.assertEqual(team_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(team_res.data['team_members']), 2)
        self.assertEqual(len(team_res.data['pending_invitations']), 0)
