"""M1 endpoints: clubs, membership, join requests, club proposals, announcements, news and approvals."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import SystemLog, User
from users.utils import log_event

from . import approvals, emails
from .clubs import ADVISOR_ROLES, COMMITTEE_POSITIONS, MEMBERSHIP_ROLES, add_to_club, current_membership
from .models import (
    AcademicSession, Announcement, AnnouncementComment, ApprovalRequest, CampusClub, ClubProposal, JoinRequest,
    NewsPost, OrgUnit, RoleAssignment,
)
from .models import CampusRole as R
from .permissions import Action, CampusEnabled, can, is_platform_admin
from .serializers import (
    AnnouncementSerializer, ApprovalRequestSerializer, ClubCardSerializer, ClubProposalSerializer,
    ClubUpdateSerializer, CommentSerializer, JoinRequestSerializer, MemberSerializer, NewsSerializer,
    PersonSerializer, SessionSerializer, UnitBriefSerializer,
)
from .views import CAMPUS, require

PUBLIC = [permissions.AllowAny, CampusEnabled]
UPLOADS = [JSONParser, MultiPartParser, FormParser]


def get_club(pk):
    return get_object_or_404(OrgUnit.objects.select_related('parent', 'club'), pk=pk, kind=OrgUnit.Kind.CLUB)


def require_student(user):
    if user.role != User.Role.STUDENT:
        raise exceptions.PermissionDenied('Only student accounts can do this.')


def club_managers(club):
    """Who decides join requests: the committee and the advisors."""
    roles = (R.COMMITTEE, R.ADVISOR, R.CO_ADVISOR)
    return [a.user for a in RoleAssignment.objects.current().filter(unit=club, role__in=roles).select_related('user')]


# --- Campuses and sessions -----------------------------------------------------------------------------------

class CampusListView(APIView):
    """Campuses and their sections, for sign-up style pickers (proposing a club, posting news)."""
    permission_classes = PUBLIC

    def get(self, request):
        campuses = OrgUnit.objects.filter(kind=OrgUnit.Kind.CAMPUS, is_active=True).order_by('name')
        sections = OrgUnit.objects.filter(kind=OrgUnit.Kind.SECTION, is_active=True).select_related('parent')
        by_campus = {}
        for section in sections:
            campus = section.campus
            if campus:
                by_campus.setdefault(campus.pk, []).append(UnitBriefSerializer(section).data)
        return Response([{**UnitBriefSerializer(c).data, 'sections': by_campus.get(c.pk, [])} for c in campuses])


class SessionListView(generics.ListCreateAPIView):
    permission_classes = CAMPUS
    serializer_class = SessionSerializer
    pagination_class = None

    def get_queryset(self):
        campus = self.request.query_params.get('campus')
        sessions = AcademicSession.objects.all()
        return sessions.filter(campus_id=campus) if campus else sessions

    def perform_create(self, serializer):
        require(self.request.user, Action.MANAGE_UNITS, serializer.validated_data['campus'])
        serializer.save()


# --- Clubs ---------------------------------------------------------------------------------------------------

class ClubListView(APIView):
    """The club directory. Anyone can browse it (UniKLSKILL F019); ?mine=1 lists the clubs I belong to."""
    permission_classes = PUBLIC

    def get(self, request):
        clubs = OrgUnit.objects.filter(kind=OrgUnit.Kind.CLUB, is_active=True).select_related('parent', 'club')
        params = request.query_params
        if params.get('campus'):
            campus = get_object_or_404(OrgUnit, pk=params['campus'], kind=OrgUnit.Kind.CAMPUS)
            clubs = [c for c in clubs if c.campus == campus]
        if params.get('sector'):
            clubs = [c for c in clubs if c.sector == params['sector']]
        if params.get('q'):
            q = params['q'].strip().lower()
            clubs = [c for c in clubs if q in c.name.lower() or q in (getattr(c, 'club', None) and c.club.description
                                                                         or '').lower()]
        if params.get('mine') in ('1', 'true'):
            if not request.user.is_authenticated:
                return Response([])
            mine = set(RoleAssignment.objects.current().filter(user=request.user, unit__kind=OrgUnit.Kind.CLUB)
                       .values_list('unit_id', flat=True))
            clubs = [c for c in clubs if c.pk in mine]
        clubs = sorted(clubs, key=lambda c: c.name.lower())
        return Response(ClubCardSerializer(clubs, many=True, context={'request': request}).data)


class ClubDetailView(APIView):
    """GET: the club page (anyone). PATCH: the committee, advisors or SDCL edit it."""
    permission_classes = PUBLIC
    parser_classes = UPLOADS

    def get(self, request, pk):
        club = get_club(pk)
        user = request.user
        data = ClubCardSerializer(club, context={'request': request}).data
        info = CampusClub.for_unit(club)
        leaders = RoleAssignment.objects.current().filter(unit=club, role__in=(R.COMMITTEE, R.ADVISOR, R.CO_ADVISOR)) \
            .select_related('user')
        data.update({
            'objectives': info.objectives,
            'merit_elements': info.merit_elements,
            'location': info.location,
            'joining_criteria': info.joining_criteria,
            'socials': info.socials,
            'advisors': [{'id': a.pk, 'name': PersonSerializer(a.user).data['name'], 'role': a.role,
                          'role_label': a.get_role_display()} for a in leaders if a.role in ADVISOR_ROLES],
            'committee': [{'id': a.pk, 'name': PersonSerializer(a.user).data['name'], 'position': a.position}
                          for a in sorted((a for a in leaders if a.role == R.COMMITTEE),
                                          key=lambda a: (COMMITTEE_POSITIONS.index(a.position)
                                                         if a.position in COMMITTEE_POSITIONS else 99))],
            'me': self.me(user, club),
        })
        return Response(data)

    def me(self, user, club):
        if not user.is_authenticated:
            return None
        membership = current_membership(club, user)
        pending = JoinRequest.objects.filter(club=club, student=user, status=JoinRequest.Status.PENDING).first()
        return {
            'membership': MemberSerializer(membership).data if membership else None,
            'pending_request': pending.pk if pending else None,
            'can_join': user.role == User.Role.STUDENT and not membership and not pending,
            'can_manage': can(user, Action.MANAGE_CLUB, club),
            'can_view_internal': can(user, Action.VIEW_CLUB, club),
            'can_assign': can(user, Action.ASSIGN_STUDENT_ROLES, club),
        }

    def patch(self, request, pk):
        club = get_club(pk)
        if not request.user.is_authenticated:
            raise exceptions.NotAuthenticated()
        require(request.user, Action.MANAGE_CLUB, club)
        serializer = ClubUpdateSerializer(CampusClub.for_unit(club), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self.get(request, pk)


class ClubMembersView(APIView):
    """GET: current members (the full list for members and staff; committee and advisors for everyone else).
    POST: add a student by email, as a member or a committee member with a position."""
    permission_classes = CAMPUS

    def get(self, request, pk):
        club = get_club(pk)
        roles = MEMBERSHIP_ROLES + ADVISOR_ROLES if can(request.user, Action.VIEW_CLUB, club) \
            else (R.COMMITTEE,) + ADVISOR_ROLES
        members = RoleAssignment.objects.current().filter(unit=club, role__in=roles).select_related('user')
        return Response(MemberSerializer(members.order_by('role', 'position', 'starts_on'), many=True).data)

    def post(self, request, pk):
        club = get_club(pk)
        require(request.user, Action.ASSIGN_STUDENT_ROLES, club)
        email = str(request.data.get('email') or '').strip().lower()
        student = User.objects.filter(email__iexact=email, role=User.Role.STUDENT, is_active=True).first()
        if not student:
            raise exceptions.ValidationError({'email': ['No student account uses this email. Ask them to sign up '
                                                        'first, or to send a join request.']})
        role, position = self.role_from(request.data)
        assignment = add_to_club(club, student, role, position, assigned_by=request.user)
        JoinRequest.objects.filter(club=club, student=student, status=JoinRequest.Status.PENDING).update(
            status=JoinRequest.Status.APPROVED, decided_by=request.user, decided_at=timezone.now())
        emails.role_given(assignment)
        return Response(MemberSerializer(assignment).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def role_from(data):
        role = data.get('role') or R.MEMBER
        if role not in MEMBERSHIP_ROLES:
            raise exceptions.ValidationError({'role': ['Choose member or committee.']})
        position = str(data.get('position') or '').strip()[:100]
        if role == R.COMMITTEE and not position:
            raise exceptions.ValidationError({'position': ['Give the committee position, e.g. Secretary.']})
        return role, position


class ClubMemberDetailView(APIView):
    """PATCH: promote, demote or change a position (the old term is closed and kept). DELETE: remove."""
    permission_classes = CAMPUS

    def get_assignment(self, request, pk, assignment_id):
        club = get_club(pk)
        assignment = get_object_or_404(RoleAssignment.objects.current().select_related('user', 'unit'),
                                       pk=assignment_id, unit=club, role__in=MEMBERSHIP_ROLES)
        require(request.user, Action.ASSIGN_STUDENT_ROLES, club)
        return club, assignment

    def patch(self, request, pk, assignment_id):
        club, assignment = self.get_assignment(request, pk, assignment_id)
        role, position = ClubMembersView.role_from(request.data)
        updated = add_to_club(club, assignment.user, role, position, assigned_by=request.user)
        if updated.pk != assignment.pk:
            emails.role_given(updated)
        return Response(MemberSerializer(updated).data)

    def delete(self, request, pk, assignment_id):
        club, assignment = self.get_assignment(request, pk, assignment_id)
        assignment.end(f'Removed by {request.user.email}')
        return Response(status=status.HTTP_204_NO_CONTENT)


class LeaveClubView(APIView):
    permission_classes = CAMPUS

    def post(self, request, pk):
        club = get_club(pk)
        membership = current_membership(club, request.user)
        if not membership:
            raise exceptions.ValidationError({'detail': "You're not a member of this club."})
        membership.end('Left the club')
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- Join requests -------------------------------------------------------------------------------------------

class JoinView(APIView):
    """POST: a student asks to join (UniKLSKILL F006). DELETE: they cancel their pending request."""
    permission_classes = CAMPUS

    def post(self, request, pk):
        club = get_club(pk)
        require_student(request.user)
        info = CampusClub.for_unit(club)
        if not info.joining_open or info.status != CampusClub.Status.ACTIVE:
            raise exceptions.ValidationError({'detail': 'This club is not taking new members right now.'})
        if current_membership(club, request.user):
            raise exceptions.ValidationError({'detail': "You're already a member."})
        if JoinRequest.objects.filter(club=club, student=request.user, status=JoinRequest.Status.PENDING).exists():
            raise exceptions.ValidationError({'detail': 'Your request is already waiting for the committee.'})
        join_request = JoinRequest.objects.create(club=club, student=request.user,
                                                  message=str(request.data.get('message') or '')[:1000])
        emails.join_request_received(join_request, club_managers(club))
        return Response(JoinRequestSerializer(join_request).data, status=status.HTTP_201_CREATED)

    def delete(self, request, pk):
        club = get_club(pk)
        updated = JoinRequest.objects.filter(club=club, student=request.user, status=JoinRequest.Status.PENDING) \
            .update(status=JoinRequest.Status.CANCELLED, decided_at=timezone.now())
        if not updated:
            raise exceptions.ValidationError({'detail': 'You have no pending request for this club.'})
        return Response(status=status.HTTP_204_NO_CONTENT)


class JoinRequestListView(generics.ListAPIView):
    permission_classes = CAMPUS
    serializer_class = JoinRequestSerializer
    pagination_class = None

    def get_queryset(self):
        club = get_club(self.kwargs['pk'])
        require(self.request.user, Action.MANAGE_CLUB, club)
        return JoinRequest.objects.filter(club=club, status=JoinRequest.Status.PENDING).select_related('student')


class JoinRequestDecideView(APIView):
    """Approve or reject (UniKLSKILL F005). Approving makes them a member for the current session."""
    permission_classes = CAMPUS

    def post(self, request, pk, request_id):
        club = get_club(pk)
        require(request.user, Action.MANAGE_CLUB, club)
        with transaction.atomic():
            join_request = get_object_or_404(JoinRequest.objects.select_for_update(), pk=request_id, club=club)
            if join_request.status != JoinRequest.Status.PENDING:
                raise exceptions.ValidationError({'detail': 'This request has already been decided.'})
            approve = str(request.data.get('approve')).lower() in ('true', '1', 'yes')
            join_request.status = JoinRequest.Status.APPROVED if approve else JoinRequest.Status.REJECTED
            join_request.reason = str(request.data.get('reason') or '')[:255]
            join_request.decided_by = request.user
            join_request.decided_at = timezone.now()
            join_request.save()
            if approve:
                add_to_club(club, join_request.student, R.MEMBER, assigned_by=request.user)
        emails.join_request_decided(join_request)
        return Response(JoinRequestSerializer(join_request).data)


class MyClubsView(APIView):
    """My memberships now, my past terms (for my record), and my pending join requests."""
    permission_classes = CAMPUS

    def get(self, request):
        mine = RoleAssignment.objects.filter(user=request.user, unit__kind=OrgUnit.Kind.CLUB) \
            .select_related('unit', 'unit__parent')
        current_ids = set(mine.current().values_list('pk', flat=True))
        pending = JoinRequest.objects.filter(student=request.user, status=JoinRequest.Status.PENDING) \
            .select_related('club')

        def row(a):
            return {**MemberSerializer(a).data, 'club': {'id': a.unit_id, 'name': a.unit.name, 'sector': a.unit.sector}}
        return Response({
            'current': [row(a) for a in mine if a.pk in current_ids],
            'history': [row(a) for a in mine if a.pk not in current_ids],
            'pending_requests': JoinRequestSerializer(pending, many=True).data,
        })


# --- Club proposals ------------------------------------------------------------------------------------------

def club_proposal_steps(proposal):
    section = proposal.section
    office = section.parent if section.parent and section.parent.kind == OrgUnit.Kind.OFFICE else section.campus
    return [
        {'label': 'Endorsed by the proposed advisor', 'roles': [R.ADVISOR], 'scope': section,
         'assignee': proposal.proposed_advisor},
        {'label': 'Reviewed by the Head of Section', 'roles': [R.HEAD_OF_SECTION], 'scope': section},
        {'label': 'Approved by the Deputy Dean', 'roles': [R.DEPUTY_DEAN], 'scope': office},
    ]


class ClubProposalListView(generics.ListCreateAPIView):
    """GET: my proposals. POST: propose a new club (UniKLSKILL F015)."""
    permission_classes = CAMPUS
    serializer_class = ClubProposalSerializer
    parser_classes = UPLOADS
    pagination_class = None

    def get_queryset(self):
        return ClubProposal.objects.filter(proposer=self.request.user).select_related(
            'section', 'proposed_advisor', 'proposer')

    def create(self, request, *args, **kwargs):
        require_student(request.user)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        with transaction.atomic():
            proposal = serializer.save(proposer=self.request.user)
            approvals.start(ApprovalRequest.Kind.CLUB_PROPOSAL, proposal.section.campus, proposal.name,
                            self.request.user, club_proposal_steps(proposal), club_proposal=proposal)
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Club proposed: {proposal.name} by {self.request.user.email}')


class ClubProposalDetailView(generics.RetrieveAPIView):
    permission_classes = CAMPUS
    serializer_class = ClubProposalSerializer

    def get_object(self):
        proposal = get_object_or_404(ClubProposal.objects.select_related('section', 'proposed_advisor', 'proposer'),
                                     pk=self.kwargs['pk'])
        if proposal.proposer_id != self.request.user.pk and not can_see_request(self.request.user, proposal.approval):
            raise exceptions.PermissionDenied()
        return proposal


# --- Announcements -------------------------------------------------------------------------------------------

class AnnouncementListView(generics.ListCreateAPIView):
    """Club announcements: members read and comment; the committee and advisors post (UniKLSKILL)."""
    permission_classes = CAMPUS
    serializer_class = AnnouncementSerializer
    pagination_class = None

    def club(self):
        return get_club(self.kwargs['pk'])

    def get_queryset(self):
        club = self.club()
        require(self.request.user, Action.VIEW_CLUB, club)
        return Announcement.objects.filter(club=club).select_related('author')

    def perform_create(self, serializer):
        club = self.club()
        require(self.request.user, Action.MANAGE_CLUB, club)
        serializer.save(club=club, author=self.request.user)


class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = CAMPUS
    serializer_class = AnnouncementSerializer

    def get_object(self):
        announcement = get_object_or_404(Announcement.objects.select_related('club', 'author'),
                                         pk=self.kwargs['announcement_id'], club_id=self.kwargs['pk'])
        action = Action.VIEW_CLUB if self.request.method == 'GET' else Action.MANAGE_CLUB
        require(self.request.user, action, announcement.club)
        return announcement


class CommentListView(generics.ListCreateAPIView):
    permission_classes = CAMPUS
    serializer_class = CommentSerializer
    pagination_class = None

    def announcement(self):
        announcement = get_object_or_404(Announcement.objects.select_related('club'),
                                         pk=self.kwargs['announcement_id'], club_id=self.kwargs['pk'])
        require(self.request.user, Action.VIEW_CLUB, announcement.club)
        return announcement

    def get_queryset(self):
        announcement = self.announcement()
        comments = announcement.comments.select_related('author')
        if not can(self.request.user, Action.MANAGE_CLUB, announcement.club):
            comments = comments.filter(Q(is_hidden=False) | Q(author=self.request.user))
        return comments

    def perform_create(self, serializer):
        serializer.save(announcement=self.announcement(), author=self.request.user)


class CommentHideView(APIView):
    """The committee or an advisor hides (or shows again) a comment (UniKLSKILL F014)."""
    permission_classes = CAMPUS

    def post(self, request, pk, comment_id):
        comment = get_object_or_404(AnnouncementComment.objects.select_related('announcement__club'),
                                    pk=comment_id, announcement__club_id=pk)
        require(request.user, Action.MANAGE_CLUB, comment.announcement.club)
        comment.is_hidden = str(request.data.get('hidden', 'true')).lower() in ('true', '1', 'yes')
        comment.save(update_fields=['is_hidden'])
        return Response(CommentSerializer(comment).data)


# --- News ----------------------------------------------------------------------------------------------------

NEWS_APPROVERS = [R.CAMPUS_ADMIN, R.HEAD_OF_SECTION, R.SECTION_EXECUTIVE]


class NewsListView(generics.ListCreateAPIView):
    """GET: published campus news (anyone). POST: anyone signed in proposes a post; SDCL approves it. Posts by
    someone who could approve it themselves go up straight away."""
    serializer_class = NewsSerializer
    parser_classes = UPLOADS
    pagination_class = None

    def get_permissions(self):
        return [p() for p in (PUBLIC if self.request.method == 'GET' else CAMPUS)]

    def get_queryset(self):
        posts = NewsPost.objects.filter(status=NewsPost.Status.PUBLISHED).select_related('author', 'campus')
        if self.request.query_params.get('campus'):
            posts = posts.filter(campus_id=self.request.query_params['campus'])
        if self.request.query_params.get('claimable') in ('1', 'true'):
            posts = posts.filter(ghocs_claimable=True)
        return posts[:100]

    def perform_create(self, serializer):
        if self.request.user.role not in (User.Role.STUDENT, User.Role.STAFF, User.Role.ADMIN):
            raise exceptions.PermissionDenied('Campus news comes from students and staff.')
        campus = serializer.validated_data['campus']
        steps = [{'label': 'Approved by SDCL', 'roles': NEWS_APPROVERS, 'scope': campus}]
        with transaction.atomic():
            post = serializer.save(author=self.request.user)
            probe = approvals.ApprovalStep(roles=NEWS_APPROVERS, scope=campus)
            if approvals.can_sign(self.request.user, probe):
                post.status = NewsPost.Status.PUBLISHED
                post.published_at = timezone.now()
                post.save(update_fields=['status', 'published_at'])
            else:
                approvals.start(ApprovalRequest.Kind.NEWS, campus, post.title, self.request.user, steps,
                                news_post=post)


class MyNewsView(generics.ListAPIView):
    permission_classes = CAMPUS
    serializer_class = NewsSerializer
    pagination_class = None

    def get_queryset(self):
        return NewsPost.objects.filter(author=self.request.user).select_related('campus')


class NewsDetailView(generics.RetrieveAPIView):
    permission_classes = PUBLIC
    serializer_class = NewsSerializer

    def get_object(self):
        post = get_object_or_404(NewsPost.objects.select_related('author', 'campus'), pk=self.kwargs['pk'])
        if post.status != NewsPost.Status.PUBLISHED:
            user = self.request.user
            if not user.is_authenticated or (post.author_id != user.pk and not can_see_request(user, getattr(post, 'approval', None))):
                raise exceptions.NotFound()
        return post


# --- Approvals -----------------------------------------------------------------------------------------------

def can_see_request(user, request):
    """The sender, anyone who signs or signed one of its steps, and campus oversight roles can open a request."""
    if request is None or not user.is_authenticated:
        return False
    if is_platform_admin(user) or request.submitted_by_id == user.pk:
        return True
    for step in request.steps.select_related('scope'):
        if user.pk in (step.decided_by_id, step.assignee_id):
            return True
        # Would this person be able to sign the step if it were waiting? (covers steps not reached yet)
        if not step.assignee_id and approvals.can_sign(
                user, approvals.ApprovalStep(roles=step.roles, scope=step.scope)):
            return True
    return can(user, Action.VIEW_STRUCTURE, request.campus)


class ApprovalListView(APIView):
    """GET: requests waiting for me (my approvals inbox), or ?mine=1 for what I sent."""
    permission_classes = CAMPUS

    def get(self, request):
        if request.query_params.get('mine') in ('1', 'true'):
            items = ApprovalRequest.objects.filter(submitted_by=request.user).order_by('-created_at') \
                .select_related('campus', 'submitted_by').prefetch_related('steps')
        else:
            items = approvals.inbox(request.user)
        return Response(ApprovalRequestSerializer(items, many=True, context={'request': request}).data)


class ApprovalDetailView(APIView):
    permission_classes = CAMPUS

    def get_object(self, request, pk):
        item = get_object_or_404(ApprovalRequest.objects.select_related('campus', 'submitted_by'), pk=pk)
        if not can_see_request(request.user, item):
            raise exceptions.PermissionDenied()
        return item

    def get(self, request, pk):
        item = self.get_object(request, pk)
        return Response(ApprovalRequestSerializer(item, context={'request': request, 'with_target': True}).data)


class ApprovalDecideView(APIView):
    permission_classes = CAMPUS

    def post(self, request, pk):
        item = get_object_or_404(ApprovalRequest, pk=pk)
        approve = str(request.data.get('approve')).lower() in ('true', '1', 'yes')
        item = approvals.decide(item, request.user, approve, str(request.data.get('comment') or ''))
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'Campus approval #{item.pk} {"approved" if approve else "rejected"} step by {request.user.email}')
        return Response(ApprovalRequestSerializer(item, context={'request': request, 'with_target': True}).data)


class ApprovalWithdrawView(APIView):
    permission_classes = CAMPUS

    def post(self, request, pk):
        item = approvals.withdraw(get_object_or_404(ApprovalRequest, pk=pk), request.user)
        return Response(ApprovalRequestSerializer(item, context={'request': request}).data)


# --- Pilot list ----------------------------------------------------------------------------------------------

class PilotListView(APIView):
    """GET ?campus=<id>: the students allowed into the closed pilot. POST {campus, emails, note}: add students
    (a list, or text with one email per line or comma); each new one is emailed. Campus administrators only."""
    permission_classes = CAMPUS

    def campus(self, value):
        campus = get_object_or_404(OrgUnit, pk=value, kind=OrgUnit.Kind.CAMPUS)
        require(self.request.user, Action.MANAGE_STAFF, campus)
        return campus

    def get(self, request):
        from .models import PilotAccess
        campus = self.campus(request.query_params.get('campus'))
        rows = PilotAccess.objects.filter(campus=campus)
        accounts = {u.email.lower(): u for u in User.objects.filter(email__in=[r.email for r in rows])}
        return Response([{'id': r.pk, 'email': r.email, 'note': r.note, 'created_at': r.created_at,
                          'signed_up': r.email in accounts,
                          'name': PersonSerializer(accounts[r.email]).data['name'] if r.email in accounts else None}
                         for r in rows])

    def post(self, request):
        import re

        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError

        from .models import PilotAccess
        campus = self.campus(request.data.get('campus'))
        raw = request.data.get('emails') or []
        if isinstance(raw, str):
            raw = re.split(r'[\s,;]+', raw)
        addresses, invalid = [], []
        for value in raw:
            value = str(value).strip().lower()
            if not value:
                continue
            try:
                validate_email(value)
                addresses.append(value)
            except DjangoValidationError:
                invalid.append(value)
        if invalid:
            raise exceptions.ValidationError({'emails': [f'Not an email address: {", ".join(invalid[:5])}']})
        if not addresses or len(addresses) > 500:
            raise exceptions.ValidationError({'emails': ['Give between 1 and 500 email addresses.']})
        taken = {e: c for e, c in PilotAccess.objects.filter(email__in=addresses).values_list('email', 'campus__name')}
        not_students = set(User.objects.filter(email__in=addresses).exclude(role=User.Role.STUDENT)
                           .values_list('email', flat=True))
        added = []
        for email in dict.fromkeys(addresses):
            if email in taken or email in not_students:
                continue
            access = PilotAccess.objects.create(campus=campus, email=email, added_by=request.user,
                                                note=str(request.data.get('note') or '')[:255])
            emails.pilot_invited(access, has_account=User.objects.filter(email__iexact=email).exists())
            added.append(email)
        log_event(SystemLog.Category.GROWTH, SystemLog.Level.INFO,
                  f'{len(added)} student(s) added to the {campus.name} Campus pilot by {request.user.email}')
        return Response({'added': added, 'already_listed': sorted(taken),
                         'not_student_accounts': sorted(not_students)}, status=status.HTTP_201_CREATED)


class PilotDetailView(APIView):
    """Take a student off the pilot list. Roles they already hold stay (end those under Structure and roles)."""
    permission_classes = CAMPUS

    def delete(self, request, pk):
        from .models import PilotAccess
        access = get_object_or_404(PilotAccess.objects.select_related('campus'), pk=pk)
        require(request.user, Action.MANAGE_STAFF, access.campus)
        access.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
