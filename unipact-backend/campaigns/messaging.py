"""A project's conversation: who is in it, when it is open, and the endpoints behind the Messages tab.

One conversation per project, shared by the client, every student on the team and UniPact admins. The
agreements have talent and clients communicate through UniPact, so it is not a private channel: admins
can read it and reply, and the page says so.

It opens when the project starts (the client has confirmed the team and paid), stays open for
PROJECT_CHAT_DAYS_AFTER_COMPLETION days after completion, and is read-only after that.

A new message emails the client and the team, but sparingly: not the person who wrote it, not someone
who has the conversation open, and not anyone already emailed about this project within
PROJECT_MESSAGE_EMAIL_INTERVAL_MINUTES. Admins are not emailed; they follow conversations in the Admin hub.
"""
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Max
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView

from unipact_backend import notifications
from unipact_backend.throttling import ProjectMessageThrottle
from unipact_backend.validators import validate_message_attachment

from .models import Campaign, ProjectMessage, ProjectMessageRead

NOT_STARTED, OPEN, CLOSED = 'NOT_STARTED', 'OPEN', 'CLOSED'
PAGE_SIZE = 50
# Someone whose page asked for the open conversation this recently is looking at it right now. Kept short:
# a person who closes the page and is written to within this window gets no email for that message.
PRESENT_SECONDS = 20
# The page polls every 5 seconds while the conversation is open; this is how often that is written down
# (it must stay comfortably below PRESENT_SECONDS, or people who are present would look absent)
PRESENCE_WRITE_SECONDS = 10
STARTED_STATUSES = (Campaign.Status.IN_PROGRESS, Campaign.Status.COMPLETED, Campaign.Status.ARCHIVED)


def is_participant(user, campaign):
    """The owning client, students who are on the team (not ones still deciding on an offer) and admins."""
    from .serializers import can_view_workspace  # serializers imports this module for unread counts

    return can_view_workspace(user, campaign)


def closes_at(campaign):
    """When a completed project's conversation stops taking new messages. None while it is running."""
    if campaign.status != Campaign.Status.COMPLETED or not campaign.completed_at:
        return None
    return campaign.completed_at + timedelta(days=settings.PROJECT_CHAT_DAYS_AFTER_COMPLETION)


def conversation_state(campaign, now=None):
    # Club sponsorships have no student team to talk to. (A conversation that already has messages stays
    # readable even if its team is later emptied.)
    if not campaign.assigned_students.exists() and not campaign.messages.exists():
        return NOT_STARTED
    if campaign.status == Campaign.Status.IN_PROGRESS:
        return OPEN
    if campaign.status == Campaign.Status.COMPLETED:
        end = closes_at(campaign)
        return OPEN if end and (now or timezone.now()) <= end else CLOSED
    if campaign.status == Campaign.Status.ARCHIVED:
        return CLOSED
    return NOT_STARTED  # posted or matched: nothing is paid yet, so the client and the team don't talk yet


def last_read_id(user, campaign):
    return ProjectMessageRead.objects.filter(campaign=campaign, user=user).values_list('last_read_id', flat=True).first() or 0


def unread_count(user, campaign):
    """Messages from other people that this participant hasn't seen yet."""
    return ProjectMessage.objects.filter(campaign=campaign, id__gt=last_read_id(user, campaign)).exclude(sender=user).count()


def mark_read(user, campaign, up_to=None):
    latest = campaign.messages.order_by('-id').values_list('id', flat=True).first() or 0
    target = min(up_to, latest) if up_to else latest
    read, _ = ProjectMessageRead.objects.get_or_create(campaign=campaign, user=user)
    # Never moves backwards: an older tab catching up must not make read messages unread again
    if target > read.last_read_id:
        read.last_read_id = target
        read.save(update_fields=['last_read_id', 'updated_at'])
    return read.last_read_id


def touch_presence(user, campaign, now=None):
    """Note that this person has the conversation on screen (at most one write every few polls)."""
    now = now or timezone.now()
    place, _ = ProjectMessageRead.objects.get_or_create(campaign=campaign, user=user)
    if place.seen_at is None or (now - place.seen_at).total_seconds() >= PRESENCE_WRITE_SECONDS:
        place.seen_at = now
        place.save(update_fields=['seen_at', 'updated_at'])


def _recipients(campaign):
    """(user, link) for everyone a new message should reach: the client and the students on the team.
    Admins are left out: they watch every conversation from the Admin hub."""
    people = [(campaign.company.user, f'/manage-campaign/{campaign.id}?tab=messages')]
    for student in campaign.assigned_students.select_related('user'):
        if campaign.is_active_member(student):
            people.append((student.user, f'/student/projects/{campaign.id}?tab=messages'))
    return people


def notify_new_message(message, now=None):
    """Email the people who should know about this message and wouldn't otherwise. Returns who was emailed."""
    campaign = message.campaign
    now = now or timezone.now()
    present_since = now - timedelta(seconds=PRESENT_SECONDS)
    quiet_since = now - timedelta(minutes=settings.PROJECT_MESSAGE_EMAIL_INTERVAL_MINUTES)
    sender_name, _role = _sender(message.sender)

    emailed = []
    for user, path in _recipients(campaign):
        if user.id == message.sender_id or not user.is_active or not user.email:
            continue
        place, _ = ProjectMessageRead.objects.get_or_create(campaign=campaign, user=user)
        if place.seen_at and place.seen_at >= present_since:
            continue  # they have the conversation open and will see it within seconds
        if place.notified_at and place.notified_at > quiet_since:
            continue  # already told there is something new here; it will be waiting with the rest
        place.notified_at = now
        place.save(update_fields=['notified_at', 'updated_at'])
        notifications.project_message(campaign, user, sender_name, message.body, path, message.attachment_name)
        emailed.append(user)
    return emailed


def _sender(user):
    """(name, role) as the conversation shows them. Admins speak as UniPact."""
    if user is None:
        return 'Former member', 'FORMER'
    if user.role == 'ADMIN':
        return 'UniPact', 'UNIPACT'
    if user.role == 'COMPANY':
        return getattr(getattr(user, 'company_profile', None), 'company_name', None) or user.email, 'CLIENT'
    return getattr(getattr(user, 'student_profile', None), 'full_name', None) or user.get_full_name() or user.email, 'STUDENT'


def preview(message, limit):
    """One line standing in for a message, for the admin's list: its text, or the file it carried."""
    text = ' '.join(message.body.split()) or (f'Sent a file: {message.attachment_name}' if message.attachment_name else '')
    return text if len(text) <= limit else text[:limit - 3].rstrip() + '…'


def serialize(message, request):
    name, role = _sender(message.sender)
    attachment = None
    if message.attachment:
        attachment = {
            'name': message.attachment_name or message.attachment.name.rsplit('/', 1)[-1],
            'size': message.attachment_size,
            # Through the API, not the storage link: access is checked on every download and never goes stale
            'url': reverse('project_message_attachment', kwargs={'campaign_id': message.campaign_id, 'message_id': message.id}, request=request),
        }
    return {
        'id': message.id,
        'body': message.body,
        'attachment': attachment,
        'created_at': message.created_at,
        'sender_name': name,
        'sender_role': role,
        'mine': message.sender_id == request.user.id,
    }


def _positive_int(value):
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return 0


class ProjectConversationMixin:
    permission_classes = [permissions.IsAuthenticated]

    def get_campaign(self, request, campaign_id):
        campaign = get_object_or_404(Campaign.objects.select_related('company'), pk=campaign_id)
        # 404, not 403: someone outside the project isn't told whether it exists
        if not is_participant(request.user, campaign):
            raise Http404
        return campaign


class ProjectMessagesView(ProjectConversationMixin, APIView):
    """GET: the conversation (the latest page, messages `after` an id, or a page `before` one).
    POST {body}: add a message."""

    def get_throttles(self):
        return [ProjectMessageThrottle()] if self.request.method == 'POST' else []

    def get(self, request, campaign_id):
        campaign = self.get_campaign(request, campaign_id)
        state = conversation_state(campaign)
        after = _positive_int(request.query_params.get('after'))
        before = _positive_int(request.query_params.get('before'))

        queryset = campaign.messages.select_related('sender', 'sender__company_profile', 'sender__student_profile')
        has_earlier = False
        if state == NOT_STARTED:
            messages = []
        elif after:
            # Polling: only what arrived since the last message the page already has
            messages = list(queryset.filter(id__gt=after)[:PAGE_SIZE * 4])
        else:
            # The newest page, or the page before the oldest message the page already has
            if before:
                queryset = queryset.filter(id__lt=before)
            newest_first = list(queryset.order_by('-id')[:PAGE_SIZE + 1])
            has_earlier = len(newest_first) > PAGE_SIZE
            messages = list(reversed(newest_first[:PAGE_SIZE]))

        # The page says so while the conversation itself is on screen (not when it only polls for the badge)
        if state != NOT_STARTED and request.query_params.get('open'):
            touch_presence(request.user, campaign)

        return Response({
            'state': state,
            'can_post': state == OPEN,
            'closes_at': closes_at(campaign),
            'messages': [serialize(m, request) for m in messages],
            'has_earlier': has_earlier,
            'unread': unread_count(request.user, campaign) if state != NOT_STARTED else 0,
            'max_length': settings.PROJECT_MESSAGE_MAX_LENGTH,
            'max_attachment_mb': settings.PROJECT_MESSAGE_MAX_ATTACHMENT_MB,
        })

    def post(self, request, campaign_id):
        campaign = self.get_campaign(request, campaign_id)
        state = conversation_state(campaign)
        if state == NOT_STARTED:
            return Response({'error': 'Messages open once the project has started.', 'code': 'conversation_not_started'},
                            status=status.HTTP_403_FORBIDDEN)
        if state == CLOSED:
            return Response({'error': 'This conversation is closed. Contact UniPact if you need anything further on this project.',
                             'code': 'conversation_closed'}, status=status.HTTP_403_FORBIDDEN)

        body = str(request.data.get('body') or '').strip()
        upload = request.FILES.get('attachment')
        if not body and not upload:
            return Response({'error': 'Write a message or attach a file first.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(body) > settings.PROJECT_MESSAGE_MAX_LENGTH:
            return Response({'error': f'Messages can be at most {settings.PROJECT_MESSAGE_MAX_LENGTH:,} characters.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if upload:
            try:
                validate_message_attachment(upload)
            except serializers.ValidationError as exc:
                return Response({'error': str(exc.detail[0])}, status=status.HTTP_400_BAD_REQUEST)

        message = ProjectMessage.objects.create(
            campaign=campaign, sender=request.user, body=body,
            attachment=upload, attachment_name=(upload.name[:255] if upload else ''), attachment_size=(upload.size if upload else None),
        )
        # Whoever writes has the conversation open: everything up to their own message is read
        mark_read(request.user, campaign, up_to=message.id)
        touch_presence(request.user, campaign)
        notify_new_message(message)
        return Response(serialize(message, request), status=status.HTTP_201_CREATED)


class ProjectMessageAttachmentView(ProjectConversationMixin, APIView):
    """GET: the file sent with a message, for people in the conversation. Redirects to the stored file
    (a short-lived private link when files are in cloud storage)."""

    def get(self, request, campaign_id, message_id):
        campaign = self.get_campaign(request, campaign_id)
        message = get_object_or_404(ProjectMessage, pk=message_id, campaign=campaign)
        if not message.attachment:
            raise Http404
        return HttpResponseRedirect(message.attachment.url)


class ProjectMessagesReadView(ProjectConversationMixin, APIView):
    """POST {last_id?}: this participant has seen the conversation up to last_id (default: all of it)."""

    def post(self, request, campaign_id):
        campaign = self.get_campaign(request, campaign_id)
        mark_read(request.user, campaign, up_to=_positive_int(request.data.get('last_id')) or None)
        return Response({'unread': unread_count(request.user, campaign)})


class AdminConversationListView(APIView):
    """GET: every project conversation, for the Admin hub's Messages tab. The ones with the newest
    messages come first; each carries how many messages this admin hasn't read."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'ADMIN':
            raise exceptions.PermissionDenied("Admin access required.")

        started = Campaign.objects.filter(status__in=STARTED_STATUSES)
        # Projects with a student team, plus any that already have messages (a team can be emptied later).
        # Looked up separately so the team join doesn't multiply the message counts below.
        ids = set(started.filter(assigned_students__isnull=False).values_list('id', flat=True))
        ids |= set(ProjectMessage.objects.filter(campaign__in=started).values_list('campaign_id', flat=True))
        campaigns = list(
            Campaign.objects.filter(id__in=ids).select_related('company').prefetch_related('assigned_students')
            .annotate(last_message_id=Max('messages__id'), message_count=Count('messages'))
        )

        last_messages = {
            m.id: m for m in ProjectMessage.objects.filter(id__in=[c.last_message_id for c in campaigns if c.last_message_id])
            .select_related('sender', 'sender__company_profile', 'sender__student_profile')
        }
        read_up_to = dict(ProjectMessageRead.objects.filter(user=request.user, campaign_id__in=ids).values_list('campaign_id', 'last_read_id'))

        conversations = []
        for campaign in campaigns:
            last = last_messages.get(campaign.last_message_id)
            # Only count where there can be something new: most conversations are read up to their last message
            has_new = bool(last) and campaign.last_message_id > read_up_to.get(campaign.id, 0)
            last_message = None
            if last:
                name, role = _sender(last.sender)
                last_message = {'sender_name': name, 'sender_role': role, 'created_at': last.created_at, 'body': preview(last, 140)}
            conversations.append({
                'id': campaign.id,
                'title': campaign.title,
                'company_name': campaign.company.company_name,
                'status': campaign.status,
                'state': conversation_state(campaign),
                'team': [student.full_name for student in campaign.assigned_students.all()],
                'message_count': campaign.message_count,
                'unread': unread_count(request.user, campaign) if has_new else 0,
                'last_message': last_message,
                'started_at': campaign.started_at,
            })

        # Newest message first; conversations nobody has written in yet follow, newest project first
        epoch = timezone.now() - timedelta(days=36500)
        conversations.sort(key=lambda c: (c['last_message'] is not None,
                                          (c['last_message'] or {}).get('created_at') or c['started_at'] or epoch), reverse=True)
        return Response(conversations)
