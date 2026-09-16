"""
Transactional emails.

Every email uses one branded layout (templates/emails/notification.html + .txt) so the wording lives
here in plain Python. Emails are sent after the database transaction commits, and a failing mail
server never breaks the request that triggered it: the error is logged instead.
"""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string

logger = logging.getLogger('unipact.email')


def site_url(path=''):
    return f'{settings.FRONTEND_URL}{path}'


def display_name(user):
    """The friendliest name we have for a user."""
    for attr, field in (('student_profile', 'full_name'), ('company_profile', 'company_name'), ('club_profile', 'club_name')):
        profile = getattr(user, attr, None) if hasattr(user, attr) else None
        if profile and getattr(profile, field, ''):
            return getattr(profile, field)
    return user.get_full_name() or user.email


def send_email(to, subject, heading, lines=(), details=(), action_label=None, action_path=None, note=None, preheader=None):
    recipients = sorted({email for email in ([to] if isinstance(to, str) else to) if email})
    if not recipients:
        return

    subject = ' '.join(str(subject).split())  # header injection safety: no newlines in the subject
    context = {
        'subject': subject,
        'heading': heading,
        'lines': list(lines),
        'details': [(label, value) for label, value in details if value not in (None, '')],
        'action_label': action_label,
        'action_url': site_url(action_path) if action_path is not None else None,
        'note': note,
        'preheader': preheader or (lines[0] if lines else ''),
        'support_email': settings.SUPPORT_EMAIL,
        'logo_url': site_url('/email-logo.png') if settings.FRONTEND_URL.startswith('https://') else '',
    }
    text_body = render_to_string('emails/notification.txt', context)
    html_body = render_to_string('emails/notification.html', context)

    def deliver():
        try:
            message = EmailMultiAlternatives(
                subject=f'{subject} | UniPact',
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                # One email per recipient so addresses are never exposed to each other
                to=recipients[:1],
                bcc=recipients[1:],
                reply_to=[settings.SUPPORT_EMAIL] if settings.SUPPORT_EMAIL else None,
            )
            message.attach_alternative(html_body, 'text/html')
            message.send()
        except Exception:  # noqa: BLE001 - email problems must never break the user's action
            logger.exception('Failed to send "%s" email to %s', subject, ', '.join(recipients))

    transaction.on_commit(deliver)


def _students(campaign):
    return list(campaign.assigned_students.select_related('user'))


# ------------------------------------------------------------------
# Accounts
# ------------------------------------------------------------------

def welcome(user):
    role = user.role
    if role == 'COMPANY':
        lines = [
            f'Thanks for joining UniPact, {display_name(user)}.',
            'Our team is reviewing your company details. You can already post your first project: it\'s free, '
            'and a UniPact admin will propose a team of verified university students for you to confirm.',
        ]
        action = ('Post a project', '/campaign/new')
    elif role == 'CLUB':
        lines = [
            f'Welcome to UniPact, {display_name(user)}.',
            'We\'re reviewing your club\'s details. In the meantime you can browse open quests from companies.',
        ]
        action = ('Browse quests', '/quests')
    else:
        lines = [
            f'Welcome to UniPact, {display_name(user)}.',
            'A UniPact admin will verify your student status shortly. Once you\'re verified you become eligible '
            'to be matched to paid client projects. Keeping your skills and bio up to date helps us match you well.',
        ]
        action = ('Complete your profile', '/settings')
    send_email(user.email, 'Welcome to UniPact', 'Your account is ready', lines, action_label=action[0], action_path=action[1])


def verification_result(user, approved):
    name = display_name(user)
    if approved:
        send_email(
            user.email, 'Your account is verified', 'You\'re verified',
            [f'Good news, {name}: your UniPact account has been verified.',
             'You now have full access to the marketplace.'],
            action_label='Open your dashboard', action_path='/login',
        )
    else:
        send_email(
            user.email, 'We couldn\'t verify your account', 'Verification unsuccessful',
            [f'Hi {name}, we weren\'t able to verify your account with the details provided.',
             'You can upload a clearer document from your account settings and we\'ll review it again.'],
            action_label='Update your details', action_path='/settings',
        )


def password_reset(user, reset_path):
    minutes = max(1, settings.PASSWORD_RESET_TIMEOUT // 60)
    send_email(
        user.email, 'Reset your password', 'Reset your password',
        [f'We received a request to reset the password for {user.email}.',
         f'Use the button below to choose a new password. The link works once and expires in {minutes} minutes.'],
        action_label='Choose a new password', action_path=reset_path,
        note='If you didn\'t ask for this, you can ignore this email: your password stays the same.',
    )


def password_changed(user):
    send_email(
        user.email, 'Your password was changed', 'Your password was changed',
        [f'The password for your UniPact account ({user.email}) was just changed.'],
        note='If this wasn\'t you, reset your password straight away using "Forgot password?" on the sign-in page, '
             'and contact us.',
        action_label='Sign in', action_path='/login',
    )


# ------------------------------------------------------------------
# V3.0 projects
# ------------------------------------------------------------------

def match_offered(campaign, students):
    """Step 1: the admin's pick goes to the students first."""
    send_email(
        [s.user.email for s in students], f'Project offer: "{campaign.title}"', 'You\'ve been offered a client project',
        ['A UniPact admin picked you for a client project. Review the brief and accept or decline it from your dashboard.',
         'The client is only asked to confirm once the team has accepted.'],
        details=[
            ('Project', campaign.title), ('Client', campaign.company.company_name),
            ('Budget', f'RM {campaign.budget}'),
            ('Deadline', campaign.deadline.strftime('%d %b %Y') if campaign.deadline else 'Flexible'),
            ('Why you were picked', campaign.match_notes),
        ],
        action_label='Review the offer', action_path='/student/dashboard',
    )


def match_ready(campaign):
    """Step 2: every student accepted, so the company can confirm."""
    students = _students(campaign)
    if not students:
        return
    send_email(
        campaign.company.user.email, f'Your team for "{campaign.title}" is ready', 'Your student team is ready',
        ['A UniPact admin picked verified students for your project and they have accepted. '
         'Review their profiles and confirm the match to start the project.'],
        details=[('Project', campaign.title), ('Team', ', '.join(s.full_name for s in students)), ('Note from admin', campaign.match_notes)],
        action_label='Review the match', action_path=f'/manage-campaign/{campaign.id}',
    )


def match_declined(offer):
    """Tell the admins so they can pick someone else."""
    from users.models import User  # local import: notifications is imported by the users app

    campaign = offer.campaign
    remaining = campaign.assigned_students.count()
    send_email(
        list(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list('email', flat=True)),
        f'{offer.student.full_name} declined "{campaign.title}"', 'A student declined a project offer',
        [f'{offer.student.full_name} declined the offer for "{campaign.title}".',
         'The project is back in the "Needs match" queue.' if remaining == 0
         else f'{remaining} student{"s" if remaining != 1 else ""} remain on the team. Add a replacement or leave the team as it is.'],
        details=[('Project', campaign.title), ('Client', campaign.company.company_name), ('Reason given', offer.decline_reason)],
        action_label='Open matchmaking', action_path='/admin',
    )


def match_withdrawn(campaign, students):
    send_email(
        [s.user.email for s in students], f'Update on "{campaign.title}"', 'A project offer was withdrawn',
        [f'The UniPact team changed the student team for "{campaign.title}", so this offer is no longer open for you.',
         'Nothing is needed from you. We\'ll be in touch when another project fits your skills.'],
        action_label='Open your dashboard', action_path='/student/dashboard',
    )


def match_confirmed(campaign):
    send_email(
        [s.user.email for s in _students(campaign)], f'"{campaign.title}" has started', 'Your project has started',
        [f'{campaign.company.company_name} confirmed the match. You can now see the client\'s files, '
         'invite teammates and submit your work from your workspace.'],
        details=[('Project', campaign.title), ('Deadline', campaign.deadline.strftime('%d %b %Y') if campaign.deadline else 'Flexible')],
        action_label='Open your workspace', action_path='/student/dashboard',
    )


def team_invitation(invitation):
    inviter = invitation.invited_by
    registered = invitation.invitee_student is not None
    send_email(
        invitation.invitee_email, f'{inviter.full_name} invited you to a project team', 'You\'re invited to join a project team',
        [f'{inviter.full_name} invited you to work with them on a UniPact client project.'],
        details=[
            ('Project', invitation.campaign.title),
            ('Client', invitation.campaign.company.company_name),
            ('Your role', invitation.role_in_project),
            ('Payout share', f'{invitation.payout_share_percentage}%'),
            ('Message', invitation.notes),
        ],
        action_label='Review the invitation' if registered else 'Create your student account',
        action_path='/student/dashboard' if registered else '/register/student',
        note=None if registered else f'Sign up with this email address ({invitation.invitee_email}) and the invitation will be waiting on your dashboard.',
    )


def team_invitation_answered(invitation, accepted):
    who = invitation.invitee_student.full_name if invitation.invitee_student else invitation.invitee_email
    send_email(
        invitation.invited_by.user.email,
        f'{who} {"joined" if accepted else "declined"} your team',
        'Your teammate joined the project' if accepted else 'Your invitation was declined',
        [f'{who} {"accepted" if accepted else "declined"} your invitation to "{invitation.campaign.title}".'],
        details=[('Role', invitation.role_in_project)],
        action_label='Open your workspace', action_path='/student/dashboard',
    )


def work_submitted(campaign, submitter_name, title):
    send_email(
        campaign.company.user.email, f'New work submitted for "{campaign.title}"', 'New work is ready for review',
        [f'{submitter_name} submitted work on your project.'],
        details=[('Project', campaign.title), ('Submission', title)],
        action_label='Review the work', action_path=f'/manage-campaign/{campaign.id}',
    )


def project_completed(campaign, rating=None):
    send_email(
        [s.user.email for s in _students(campaign)], f'"{campaign.title}" is complete', 'Project completed',
        [f'{campaign.company.company_name} approved the work and closed the project. Well done!',
         'The project now appears on your public portfolio.'],
        details=[('Project', campaign.title), ('Client rating', f'{rating} out of 5' if rating else None)],
        action_label='View your portfolio', action_path='/student/dashboard',
    )


# ------------------------------------------------------------------
# V2.2.1 club track
# ------------------------------------------------------------------

def club_member_invitation(shadow):
    club = shadow.invited_by
    send_email(
        shadow.email, f'{club.club_name} invited you to their committee', 'You\'re invited to join your club on UniPact',
        [f'{club.club_name} added you to their committee on UniPact.',
         'Accept the invitation to set up your account and appear on the club\'s roster.'],
        details=[('Club', club.club_name), ('University', club.university), ('Your role', shadow.role)],
        action_label='Accept invitation', action_path=f'/join-club?token={shadow.token}',
        note=f'The link expires in {settings.CLUB_INVITE_TTL_DAYS} days. If you weren\'t expecting this, you can ignore this email.',
    )


def club_member_joined(shadow):
    club = shadow.invited_by
    name = shadow.user.get_full_name() if shadow.user else shadow.email
    send_email(
        club.user.email, f'{name} joined {club.club_name}', 'A committee member joined',
        [f'{name} accepted your invitation and is now on your club\'s roster.'],
        details=[('Member', name), ('Email', shadow.email), ('Role', shadow.role)],
        action_label='View your committee', action_path='/student/dashboard',
    )


def club_application_received(application):
    campaign = application.campaign
    send_email(
        campaign.company.user.email, f'New proposal for "{campaign.title}"', 'A club sent a proposal',
        [f'{application.club.club_name} applied to your quest.'],
        details=[('Quest', campaign.title), ('Club', application.club.club_name), ('University', application.club.university)],
        action_label='Review proposals', action_path=f'/manage-campaign/{campaign.id}',
    )


def club_contract_awarded(application):
    send_email(
        application.club.user.email, f'You won "{application.campaign.title}"', 'Your club won the contract',
        [f'{application.campaign.company.company_name} awarded your club the contract. '
         'Upload your deliverable from your dashboard when the work is ready.'],
        details=[('Quest', application.campaign.title), ('Budget', f'RM {application.campaign.budget}')],
        action_label='Open your dashboard', action_path='/student/dashboard',
    )


# ------------------------------------------------------------------
# Payments
# ------------------------------------------------------------------

def payment_receipt(transaction_obj):
    company = transaction_obj.company
    if transaction_obj.transaction_type == 'SUBSCRIPTION':
        kind = 'Pro plan subscription' if transaction_obj.amount >= 499 else 'Card verification'
    else:
        kind = "Finder's fee"
    send_email(
        company.user.email, 'Payment receipt', 'Payment received',
        [f'Thanks, {company.company_name}. We received your payment.'],
        details=[
            ('Description', kind),
            ('Project', transaction_obj.related_campaign.title if transaction_obj.related_campaign else None),
            ('Amount', f'RM {transaction_obj.amount}'),
            ('Reference', f'TX-{transaction_obj.id}'),
            ('Date', transaction_obj.created_at.strftime('%d %b %Y')),
        ],
        action_label='View billing', action_path='/company/treasury',
    )
