import shutil
import tempfile
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from campaigns.models import Application, Campaign, MatchOffer, ProjectMessage, ProjectMessageRead
from users.models import ClubProfile, CompanyProfile, StudentProfile, User

STRONG = 'Blue-Kettle-Run-88'


def make_user(email, role, **extra):
    return User.objects.create_user(username=email, email=email, password=STRONG, role=role, email_verified=True, **extra)


def make_student(email, name):
    user = make_user(email, User.Role.STUDENT)
    return user, StudentProfile.objects.create(user=user, full_name=name, university='UM', verification_status='VERIFIED')


class ConversationTestCase(APITestCase):
    """A project that has started, with its client, one student on the team and one who is not."""

    def setUp(self):
        cache.clear()  # posting limits are counted in the cache, and account ids repeat between tests
        self.admin = User.objects.create_superuser(username='ops@unipact.my', email='ops@unipact.my', password=STRONG, role=User.Role.ADMIN)
        self.client_user = make_user('hr@megacorp.my', User.Role.COMPANY)
        self.company = CompanyProfile.objects.create(user=self.client_user, company_name='MegaCorp', verification_status='VERIFIED')
        self.ali_user, self.ali = make_student('ali@siswa.my', 'Ali bin Abu')
        self.mei_user, self.mei = make_student('mei@siswa.my', 'Mei Ling')
        self.campaign = Campaign.objects.create(company=self.company, title='Booking site', description='d', type='SOFTWARE_DEVELOPMENT',
                                                budget=4000, status=Campaign.Status.IN_PROGRESS, is_match_finalized=True,
                                                started_at=timezone.now())
        self.campaign.assigned_students.add(self.ali)
        MatchOffer.objects.create(campaign=self.campaign, student=self.ali, status=MatchOffer.Status.ACCEPTED)
        self.url = reverse('project_messages', kwargs={'campaign_id': self.campaign.id})
        self.read_url = reverse('project_messages_read', kwargs={'campaign_id': self.campaign.id})

    def say(self, user, body):
        self.client.force_authenticate(user)
        # Emails go out when the transaction commits
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.url, {'body': body}, format='json')

    def fetch(self, user, **params):
        self.client.force_authenticate(user)
        return self.client.get(self.url, params)


class ProjectConversationTests(ConversationTestCase):
    """One conversation per project: the client, the student team and UniPact, once the project has started."""

    # --- talking -------------------------------------------------------
    def test_client_and_student_talk_and_see_who_said_what(self):
        self.assertEqual(self.say(self.client_user, 'When can we see a first draft?').status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.say(self.ali_user, '  Friday morning.  ').status_code, status.HTTP_201_CREATED)

        data = self.fetch(self.ali_user).data
        self.assertEqual((data['state'], data['can_post']), ('OPEN', True))
        self.assertEqual([(m['sender_name'], m['sender_role'], m['mine'], m['body']) for m in data['messages']], [
            ('MegaCorp', 'CLIENT', False, 'When can we see a first draft?'),
            ('Ali bin Abu', 'STUDENT', True, 'Friday morning.'),
        ])

    def test_unipact_can_read_and_reply(self):
        self.say(self.client_user, 'Can we change the scope?')
        res = self.say(self.admin, 'Scope changes go through us. We will send you a quote.')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual((res.data['sender_name'], res.data['sender_role']), ('UniPact', 'UNIPACT'))
        self.assertEqual(len(self.fetch(self.admin).data['messages']), 2)

    def test_empty_and_overlong_messages_are_refused(self):
        self.assertEqual(self.say(self.client_user, '   ').status_code, status.HTTP_400_BAD_REQUEST)
        with override_settings(PROJECT_MESSAGE_MAX_LENGTH=10):
            self.assertEqual(self.say(self.client_user, 'x' * 11).status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(self.say(self.client_user, 'x' * 10).status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProjectMessage.objects.count(), 1)

    @override_settings(REST_FRAMEWORK={'DEFAULT_THROTTLE_RATES': {'project_message': '2/min'}})
    def test_posting_is_rate_limited_per_account(self):
        self.assertEqual(self.say(self.client_user, 'one').status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.say(self.client_user, 'two').status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.say(self.client_user, 'three').status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        # The limit is per account: the student is not held back by the client's messages
        self.assertEqual(self.say(self.ali_user, 'hello').status_code, status.HTTP_201_CREATED)

    # --- who is in it --------------------------------------------------
    def test_people_outside_the_project_cannot_read_or_post(self):
        self.say(self.client_user, 'Private to this project')
        other_company = make_user('boss@other.my', User.Role.COMPANY)
        CompanyProfile.objects.create(user=other_company, company_name='Other')
        club = make_user('club@um.my', User.Role.CLUB)
        ClubProfile.objects.create(user=club, club_name='Robotics', university='UM')

        for outsider in (other_company, self.mei_user, club):
            self.assertEqual(self.fetch(outsider).status_code, status.HTTP_404_NOT_FOUND)
            self.assertEqual(self.say(outsider, 'Let me in').status_code, status.HTTP_404_NOT_FOUND)
            self.client.force_authenticate(outsider)
            self.assertEqual(self.client.post(self.read_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(ProjectMessage.objects.count(), 1)

    def test_signed_out_visitors_are_refused(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_a_teammate_who_joins_sees_the_conversation(self):
        self.say(self.client_user, 'Welcome')
        self.campaign.assigned_students.add(self.mei)  # joined by a teammate's invitation: no offer of her own
        self.assertEqual(len(self.fetch(self.mei_user).data['messages']), 1)

    # --- when it is open -----------------------------------------------
    def test_no_conversation_before_the_project_starts(self):
        """Matched but not confirmed: nothing is paid yet, so the client and the team don't talk yet."""
        self.campaign.status = Campaign.Status.MATCHED
        self.campaign.is_match_finalized = False
        self.campaign.save()

        data = self.fetch(self.client_user).data
        self.assertEqual((data['state'], data['can_post'], data['messages']), ('NOT_STARTED', False, []))
        refused = self.say(self.client_user, 'Hello?')
        self.assertEqual((refused.status_code, refused.data['code']), (status.HTTP_403_FORBIDDEN, 'conversation_not_started'))

    def test_a_student_still_deciding_on_an_offer_is_not_in_it(self):
        self.campaign.assigned_students.add(self.mei)
        MatchOffer.objects.create(campaign=self.campaign, student=self.mei)  # pending
        self.assertEqual(self.fetch(self.mei_user).status_code, status.HTTP_404_NOT_FOUND)

    def test_stays_open_for_a_while_after_completion_then_becomes_read_only(self):
        self.say(self.client_user, 'Thanks for the work')
        self.campaign.status = Campaign.Status.COMPLETED
        self.campaign.completed_at = timezone.now() - timedelta(days=5)
        self.campaign.save()

        still_open = self.fetch(self.ali_user).data
        self.assertEqual((still_open['state'], still_open['can_post']), ('OPEN', True))
        self.assertEqual(still_open['closes_at'], self.campaign.completed_at + timedelta(days=30))
        self.assertEqual(self.say(self.ali_user, 'A quick fix is deployed').status_code, status.HTTP_201_CREATED)

        self.campaign.completed_at = timezone.now() - timedelta(days=31)
        self.campaign.save()
        closed = self.fetch(self.ali_user).data
        self.assertEqual((closed['state'], closed['can_post'], len(closed['messages'])), ('CLOSED', False, 2))
        refused = self.say(self.ali_user, 'One more thing')
        self.assertEqual((refused.status_code, refused.data['code']), (status.HTTP_403_FORBIDDEN, 'conversation_closed'))

    def test_club_sponsorships_have_no_conversation(self):
        """SRS v2.2.1 projects have applications instead of a student team: nobody to talk to here."""
        quest = Campaign.objects.create(company=self.company, title='Campus booth', description='d', type='BRAND_AMBASSADOR',
                                        budget=1000, status=Campaign.Status.IN_PROGRESS)
        club_user = make_user('club@um.my', User.Role.CLUB)
        club = ClubProfile.objects.create(user=club_user, club_name='Robotics', university='UM')
        Application.objects.create(campaign=quest, club=club, message='We can do it', status=Application.Status.AWARDED)
        url = reverse('project_messages', kwargs={'campaign_id': quest.id})

        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.get(url).data['state'], 'NOT_STARTED')
        self.assertEqual(self.client.post(url, {'body': 'Hi'}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(club_user)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    # --- unread counts and paging ---------------------------------------
    def test_unread_counts_other_peoples_messages_until_they_are_read(self):
        self.say(self.client_user, 'First')
        self.say(self.client_user, 'Second')
        self.say(self.ali_user, 'Got it')

        # The client wrote the first two, so only the student's reply is new to them
        self.assertEqual(self.fetch(self.client_user).data['unread'], 1)
        # The student read everything up to their own reply by writing it
        self.assertEqual(self.fetch(self.ali_user).data['unread'], 0)

        self.say(self.client_user, 'Third')
        self.assertEqual(self.fetch(self.ali_user).data['unread'], 1)
        self.client.force_authenticate(self.ali_user)
        self.assertEqual(self.client.post(self.read_url).data['unread'], 0)
        self.assertEqual(self.fetch(self.ali_user).data['unread'], 0)

    def test_marking_read_never_moves_backwards(self):
        first = self.say(self.client_user, 'First').data['id']
        self.say(self.client_user, 'Second')
        self.client.force_authenticate(self.ali_user)
        self.client.post(self.read_url)
        # An older tab reporting an earlier message must not make the later one unread again
        self.assertEqual(self.client.post(self.read_url, {'last_id': first}, format='json').data['unread'], 0)

    def test_polling_returns_only_what_is_new(self):
        first = self.say(self.client_user, 'First').data['id']
        self.say(self.ali_user, 'Second')
        self.assertEqual([m['body'] for m in self.fetch(self.client_user, after=first).data['messages']], ['Second'])
        self.assertEqual(self.fetch(self.client_user, after='not-a-number').status_code, status.HTTP_200_OK)

    def test_long_conversations_load_a_page_at_a_time(self):
        ProjectMessage.objects.bulk_create([ProjectMessage(campaign=self.campaign, sender=self.client_user, body=f'Message {i}') for i in range(1, 61)])

        latest = self.fetch(self.ali_user).data
        self.assertEqual((len(latest['messages']), latest['has_earlier']), (50, True))
        self.assertEqual((latest['messages'][0]['body'], latest['messages'][-1]['body']), ('Message 11', 'Message 60'))

        earlier = self.fetch(self.ali_user, before=latest['messages'][0]['id']).data
        self.assertEqual(([m['body'] for m in earlier['messages']][0], len(earlier['messages']), earlier['has_earlier']), ('Message 1', 10, False))

    def test_project_data_carries_the_unread_count_for_people_in_the_conversation(self):
        self.say(self.client_user, 'Hello team')
        detail_url = reverse('campaign_detail', kwargs={'pk': self.campaign.id})

        self.client.force_authenticate(self.ali_user)
        self.assertEqual(self.client.get(detail_url).data['unread_messages'], 1)
        assigned = self.client.get(reverse('student_assigned_jobs')).data
        self.assertEqual([j['unread_messages'] for j in assigned], [1])

        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.get(detail_url).data['unread_messages'], 0)
        # Someone who is not on the team can load the public brief, but gets no count
        self.client.force_authenticate(self.mei_user)
        self.assertIsNone(self.client.get(detail_url).data['unread_messages'])

    def test_messages_survive_their_senders_account_being_removed(self):
        self.say(self.ali_user, 'Handing over to Mei')
        self.campaign.assigned_students.remove(self.ali)
        self.ali_user.delete()

        [message] = self.fetch(self.client_user).data['messages']
        self.assertEqual((message['sender_name'], message['sender_role'], message['mine']), ('Former member', 'FORMER', False))


class NewMessageEmailTests(ConversationTestCase):
    """A new message emails the people it is for, without burying them in one email per message."""

    def emails_to(self, address):
        return [m for m in mail.outbox if address in m.to + m.bcc]

    def place(self, user):
        return ProjectMessageRead.objects.get(campaign=self.campaign, user=user)

    def leaves_the_page(self, user):
        """Two minutes pass since this person last had the conversation open."""
        place = self.place(user)
        place.seen_at = timezone.now() - timedelta(minutes=2)
        place.save()

    def test_the_other_side_is_emailed_with_a_link_to_the_conversation(self):
        self.say(self.client_user, 'When can we see a first draft?')

        [email] = mail.outbox
        self.assertEqual(email.to, ['ali@siswa.my'])
        self.assertIn('New message on "Booking site"', email.subject)
        self.assertIn('MegaCorp wrote in the conversation', email.body)
        self.assertIn('When can we see a first draft?', email.body)
        self.assertIn(f'/student/projects/{self.campaign.id}?tab=messages', email.body)

        mail.outbox.clear()
        self.leaves_the_page(self.client_user)
        self.say(self.ali_user, 'Friday morning.')
        [reply] = mail.outbox
        self.assertEqual(reply.to, ['hr@megacorp.my'])
        self.assertIn('Ali bin Abu wrote in the conversation', reply.body)
        self.assertIn(f'/manage-campaign/{self.campaign.id}?tab=messages', reply.body)

    def test_at_most_one_email_an_hour_per_person_per_project(self):
        self.say(self.client_user, 'One')
        self.say(self.client_user, 'Two')
        self.say(self.client_user, 'Three')
        self.assertEqual(len(self.emails_to('ali@siswa.my')), 1)

        # An hour later the next message is worth another email
        place = self.place(self.ali_user)
        place.notified_at = timezone.now() - timedelta(minutes=61)
        place.save()
        self.say(self.client_user, 'Four')
        self.assertEqual(len(self.emails_to('ali@siswa.my')), 2)

    @override_settings(PROJECT_MESSAGE_EMAIL_INTERVAL_MINUTES=5)
    def test_the_gap_between_emails_can_be_changed(self):
        self.say(self.client_user, 'One')
        place = self.place(self.ali_user)
        place.notified_at = timezone.now() - timedelta(minutes=6)
        place.save()
        self.say(self.client_user, 'Two')
        self.assertEqual(len(self.emails_to('ali@siswa.my')), 2)
        self.assertIn('every 5 minutes', mail.outbox[-1].body)

    def test_someone_with_the_conversation_open_is_not_emailed(self):
        self.fetch(self.ali_user, open=1)
        self.say(self.client_user, 'Are you there?')
        self.assertEqual(mail.outbox, [])

        # A minute after they last had it open, they are no longer looking
        self.leaves_the_page(self.ali_user)
        self.say(self.client_user, 'Hello?')
        self.assertEqual(len(self.emails_to('ali@siswa.my')), 1)

    def test_checking_for_new_messages_in_the_background_is_not_having_it_open(self):
        self.fetch(self.ali_user)  # the badge on another tab of the page, not the conversation itself
        self.say(self.client_user, 'Quick question')
        self.assertEqual(len(self.emails_to('ali@siswa.my')), 1)

    def test_writing_counts_as_having_it_open(self):
        self.say(self.ali_user, 'Deployed the fix')
        mail.outbox.clear()
        self.say(self.client_user, 'Thanks!')  # seconds later, while the student is still on the page
        self.assertEqual(self.emails_to('ali@siswa.my'), [])

    def test_the_whole_team_hears_from_the_client_but_never_the_sender(self):
        self.campaign.assigned_students.add(self.mei)
        self.say(self.client_user, 'Welcome, both of you')

        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['ali@siswa.my', 'mei@siswa.my'])
        mail.outbox.clear()
        self.leaves_the_page(self.client_user)
        self.say(self.mei_user, 'Glad to join')
        self.assertEqual([m.to for m in mail.outbox], [['hr@megacorp.my']])  # Ali was emailed moments ago; Mei wrote it

    def test_unipact_writing_emails_the_client_and_team_and_admins_are_never_emailed(self):
        self.say(self.admin, 'Reminder: milestone 1 is due on Friday.')
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['ali@siswa.my', 'hr@megacorp.my'])
        self.assertTrue(all('UniPact wrote in the conversation' in m.body for m in mail.outbox))

        mail.outbox.clear()
        for place in ProjectMessageRead.objects.filter(campaign=self.campaign):
            place.notified_at = place.seen_at = None
            place.save()
        self.say(self.client_user, 'Understood')
        self.assertEqual(self.emails_to('ops@unipact.my'), [])

    def test_students_still_deciding_and_blocked_accounts_are_not_emailed(self):
        self.campaign.assigned_students.add(self.mei)
        MatchOffer.objects.create(campaign=self.campaign, student=self.mei)  # hasn't accepted
        self.ali_user.is_active = False
        self.ali_user.save()

        self.say(self.client_user, 'Anyone?')
        self.assertEqual(mail.outbox, [])

    def test_a_long_message_is_shortened_in_the_email(self):
        self.say(self.client_user, 'word ' * 200)
        body = mail.outbox[0].body
        self.assertIn('…', body)
        self.assertNotIn('word ' * 80, body)

    def test_a_refused_message_emails_nobody(self):
        self.say(self.client_user, '   ')
        self.campaign.status = Campaign.Status.MATCHED
        self.campaign.save()
        self.say(self.client_user, 'Too early')
        self.assertEqual(mail.outbox, [])


class AdminConversationListTests(ConversationTestCase):
    """The Admin hub's Messages tab: every project conversation, newest first, with what the admin hasn't read."""

    def setUp(self):
        super().setUp()
        self.list_url = reverse('project_conversations')

    def listing(self):
        self.client.force_authenticate(self.admin)
        return self.client.get(self.list_url)

    def test_only_admins_can_list_conversations(self):
        for user in (self.client_user, self.ali_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.listing().status_code, status.HTTP_200_OK)

    def test_lists_started_projects_with_the_newest_message_first(self):
        quiet = Campaign.objects.create(company=self.company, title='Quiet project', description='d', type='DIGITAL_MARKETING',
                                        budget=1000, status=Campaign.Status.IN_PROGRESS, started_at=timezone.now())
        quiet.assigned_students.add(self.mei)
        not_started = Campaign.objects.create(company=self.company, title='Still matching', description='d', type='SOFTWARE_DEVELOPMENT',
                                              budget=1000, status=Campaign.Status.MATCHED)
        not_started.assigned_students.add(self.mei)
        Campaign.objects.create(company=self.company, title='Club quest', description='d', type='BRAND_AMBASSADOR',
                                budget=1000, status=Campaign.Status.IN_PROGRESS)

        self.campaign.assigned_students.add(self.mei)  # two on the team must not double the message count
        self.say(self.client_user, 'First')
        self.say(self.ali_user, 'Second  message,\nover two lines')

        data = self.listing().data
        self.assertEqual([c['title'] for c in data], ['Booking site', 'Quiet project'])
        busy, silent = data
        self.assertEqual((busy['company_name'], sorted(busy['team']), busy['message_count'], busy['unread'], busy['state']),
                         ('MegaCorp', ['Ali bin Abu', 'Mei Ling'], 2, 2, 'OPEN'))
        self.assertEqual((busy['last_message']['sender_name'], busy['last_message']['sender_role'], busy['last_message']['body']),
                         ('Ali bin Abu', 'STUDENT', 'Second message, over two lines'))
        self.assertEqual((silent['message_count'], silent['unread'], silent['last_message']), (0, 0, None))

    def test_unread_clears_when_the_admin_reads_and_counts_only_other_peoples_messages(self):
        self.say(self.client_user, 'Can UniPact confirm the deadline?')
        self.assertEqual(self.listing().data[0]['unread'], 1)

        self.client.force_authenticate(self.admin)
        self.client.post(self.read_url)
        self.assertEqual(self.listing().data[0]['unread'], 0)

        self.say(self.admin, 'Confirmed: Friday.')
        self.assertEqual(self.listing().data[0]['unread'], 0)
        self.say(self.ali_user, 'Thanks')
        self.assertEqual(self.listing().data[0]['unread'], 1)

    def test_a_long_last_message_is_shortened_in_the_list(self):
        self.say(self.client_user, 'x' * 500)
        preview = self.listing().data[0]['last_message']['body']
        self.assertEqual((len(preview), preview[-1]), (138, '…'))


class MessageAttachmentTests(ConversationTestCase):
    """One file can travel with a message. It is downloaded through the API, by people in the conversation only."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.media = tempfile.mkdtemp()
        cls.media_override = override_settings(MEDIA_ROOT=cls.media)
        cls.media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls.media_override.disable()
        shutil.rmtree(cls.media, ignore_errors=True)
        super().tearDownClass()

    def send_file(self, user, upload, body=''):
        self.client.force_authenticate(user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.url, {'body': body, 'attachment': upload}, format='multipart')

    def pdf(self, name='brand-guide.pdf', content=b'%PDF-1.4 brand guide'):
        return SimpleUploadedFile(name, content, content_type='application/pdf')

    def test_a_file_can_be_sent_with_or_without_text(self):
        with_text = self.send_file(self.client_user, self.pdf(), body='Here is our brand guide')
        alone = self.send_file(self.ali_user, self.pdf('wireframes.pdf'))

        self.assertEqual((with_text.status_code, alone.status_code), (status.HTTP_201_CREATED, status.HTTP_201_CREATED))
        self.assertEqual((with_text.data['body'], with_text.data['attachment']['name'], with_text.data['attachment']['size']),
                         ('Here is our brand guide', 'brand-guide.pdf', len(b'%PDF-1.4 brand guide')))
        self.assertEqual((alone.data['body'], alone.data['attachment']['name']), ('', 'wireframes.pdf'))

        listed = self.fetch(self.ali_user).data['messages']
        self.assertEqual([m['attachment']['name'] for m in listed], ['brand-guide.pdf', 'wireframes.pdf'])
        # The link is the API's own, not the storage address
        self.assertIn(f"/api/campaigns/{self.campaign.id}/messages/{with_text.data['id']}/attachment/", listed[0]['attachment']['url'])

    def test_only_people_in_the_conversation_can_download_the_file(self):
        message_id = self.send_file(self.client_user, self.pdf()).data['id']
        url = reverse('project_message_attachment', kwargs={'campaign_id': self.campaign.id, 'message_id': message_id})

        for participant in (self.client_user, self.ali_user, self.admin):
            self.client.force_authenticate(participant)
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_302_FOUND)
            self.assertIn('project_messages/brand-guide', res['Location'])

        self.client.force_authenticate(self.mei_user)  # not on this project
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(url).status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_a_message_without_a_file_has_nothing_to_download(self):
        message_id = self.say(self.client_user, 'No file here').data['id']
        self.assertIsNone(self.fetch(self.client_user).data['messages'][0]['attachment'])
        url = reverse('project_message_attachment', kwargs={'campaign_id': self.campaign.id, 'message_id': message_id})
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_a_file_from_another_project_cannot_be_reached_through_this_one(self):
        other = Campaign.objects.create(company=self.company, title='Other project', description='d', type='SOFTWARE_DEVELOPMENT',
                                        budget=1000, status=Campaign.Status.IN_PROGRESS)
        other.assigned_students.add(self.mei)
        self.client.force_authenticate(self.mei_user)
        with self.captureOnCommitCallbacks(execute=True):
            theirs = self.client.post(reverse('project_messages', kwargs={'campaign_id': other.id}),
                                      {'attachment': self.pdf('secret.pdf')}, format='multipart').data['id']

        # Ali is on "Booking site", not on "Other project": asking for that file under his own project finds nothing
        self.client.force_authenticate(self.ali_user)
        url = reverse('project_message_attachment', kwargs={'campaign_id': self.campaign.id, 'message_id': theirs})
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_dangerous_empty_and_oversized_files_are_refused(self):
        program = self.send_file(self.client_user, SimpleUploadedFile('setup.exe', b'MZ binary'))
        disguised = self.send_file(self.client_user, SimpleUploadedFile('notes.pdf', b'<html><script>alert(1)</script></html>'))
        empty = self.send_file(self.client_user, SimpleUploadedFile('empty.pdf', b''))
        with override_settings(PROJECT_MESSAGE_MAX_ATTACHMENT_MB=1):
            too_big = self.send_file(self.client_user, self.pdf('huge.pdf', b'%PDF-1.4' + b'x' * (1024 * 1024)))

        for res in (program, disguised, empty, too_big):
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIsInstance(res.data['error'], str)
        self.assertIn('at most 1 MB', too_big.data['error'])
        self.assertEqual(ProjectMessage.objects.count(), 0)
        self.assertEqual(mail.outbox, [])

    def test_the_email_and_the_admin_list_name_the_file(self):
        self.send_file(self.client_user, self.pdf())  # a file on its own

        [email] = mail.outbox
        self.assertIn('Attached file: brand-guide.pdf', email.body)
        self.assertNotIn('“”', email.body)  # no empty quotation where the text would be

        self.client.force_authenticate(self.admin)
        last = self.client.get(reverse('project_conversations')).data[0]['last_message']
        self.assertEqual(last['body'], 'Sent a file: brand-guide.pdf')

    def test_the_conversation_says_how_big_a_file_may_be(self):
        with override_settings(PROJECT_MESSAGE_MAX_ATTACHMENT_MB=10):
            self.assertEqual(self.fetch(self.client_user).data['max_attachment_mb'], 10)
