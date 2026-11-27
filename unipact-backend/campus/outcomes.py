"""What happens when an approval request is finished (approved, not approved, or withdrawn)."""
from django.utils import timezone

from users.models import User

from . import emails
from .clubs import add_to_club, appoint_staff
from .models import ApprovalRequest, CampusClub, ClubProposal, NewsPost, OrgUnit
from .models import CampusRole as R

S = ApprovalRequest.Status


def finished(request, decided_by=None):
    if request.kind == ApprovalRequest.Kind.CLUB_PROPOSAL:
        _club_proposal(request, decided_by)
    elif request.kind == ApprovalRequest.Kind.NEWS:
        _news(request)
    elif request.kind == ApprovalRequest.Kind.ACTIVITY:
        _activity(request)
    elif request.kind == ApprovalRequest.Kind.GHOCS_CLAIM:
        _ghocs_claim(request)
    if request.status != S.WITHDRAWN:
        emails.approval_finished(request)


def _club_proposal(request, decided_by):
    proposal = request.club_proposal
    if request.status == S.APPROVED:
        proposal.status = ClubProposal.Status.APPROVED
        unit = OrgUnit.objects.create(parent=proposal.section, kind=OrgUnit.Kind.CLUB, name=proposal.name)
        CampusClub.objects.create(
            unit=unit, club_type=proposal.club_type, description=proposal.description,
            objectives=proposal.objectives, dna_category=proposal.dna_category,
            merit_elements=proposal.merit_elements)
        proposal.created_club = unit
        # The proposer leads the new club, its named advisor advises it, and the founders are its first members
        appoint_staff(unit, proposal.proposed_advisor, R.ADVISOR, assigned_by=decided_by)
        add_to_club(unit, proposal.proposer, R.COMMITTEE, 'President', assigned_by=decided_by)
        founders = User.objects.filter(email__in=proposal.founding_members, role=User.Role.STUDENT, is_active=True) \
            .exclude(pk=proposal.proposer_id)
        for student in founders:
            add_to_club(unit, student, R.MEMBER, assigned_by=decided_by)
    elif request.status == S.REJECTED:
        proposal.status = ClubProposal.Status.REJECTED
    else:
        proposal.status = ClubProposal.Status.WITHDRAWN
    proposal.save()


def _news(request):
    post = request.news_post
    if request.status == S.APPROVED:
        post.status = NewsPost.Status.PUBLISHED
        post.published_at = timezone.now()
    elif request.status == S.REJECTED:
        post.status = NewsPost.Status.REJECTED
    else:
        post.status = NewsPost.Status.WITHDRAWN
    post.save()


def _activity(request):
    from .activities import issue_approval_number
    from .models import Activity

    activity = request.activity
    if request.status == S.APPROVED:
        activity.status = Activity.Status.APPROVED
        issue_approval_number(activity)
    elif request.status == S.REJECTED:
        activity.status = Activity.Status.REJECTED
    else:
        activity.status = Activity.Status.WITHDRAWN
    activity.save(update_fields=['status', 'approval_number'])


def _ghocs_claim(request):
    from .models import GhocsClaim
    from .points import award_claim

    claim = request.ghocs_claim
    if request.status == S.APPROVED:
        claim.status = GhocsClaim.Status.APPROVED
        award_claim(claim)
    elif request.status == S.REJECTED:
        claim.status = GhocsClaim.Status.REJECTED
    else:
        claim.status = GhocsClaim.Status.WITHDRAWN
    claim.save(update_fields=['status'])
