"""Emails for UniPact Campus, sent through the platform's shared mailer (after the transaction commits)."""
from unipact_backend.notifications import display_name, send_email


def approval_waiting(request, step, people):
    for person in people:
        send_email(
            person.email, f'Waiting for you: {request.title}', 'A request needs your decision',
            [f'{request.get_kind_display()} "{request.title}" is waiting for you to sign: {step.label}.'],
            details=[('From', display_name(request.submitted_by) if request.submitted_by else '-'),
                     ('Campus', request.campus.name), ('Step', f'{step.order}. {step.label}')],
            action_label='Review it', action_path=f'/campus/approvals?open={request.pk}',
        )


def approval_finished(request):
    if not request.submitted_by:
        return
    approved = request.status == request.Status.APPROVED
    last = request.steps.exclude(decision='SKIPPED').exclude(decision='PENDING').order_by('-order').first()
    lines = [f'Your {request.get_kind_display().lower()} "{request.title}" was '
             f'{"approved" if approved else "not approved"}.']
    if not approved and last and last.comment:
        lines.append(f'Reason: {last.comment}')
    path = '/campus/approvals?mine=1&open=' + str(request.pk)
    if approved and request.kind == request.Kind.CLUB_PROPOSAL and request.club_proposal.created_club_id:
        lines.append('Your club is now open on UniPact Campus, with you as its president.')
        path = f'/campus/clubs/{request.club_proposal.created_club_id}'
    send_email(request.submitted_by.email,
               f'{"Approved" if approved else "Not approved"}: {request.title}',
               'Your request was approved' if approved else 'Your request was not approved',
               lines, action_label='Open it', action_path=path)


def join_request_received(join_request, managers):
    club = join_request.club
    for person in managers:
        send_email(
            person.email, f'{display_name(join_request.student)} wants to join {club.name}', 'New join request',
            [f'{display_name(join_request.student)} asked to join {club.name}.'],
            details=[('Message', join_request.message or '-')],
            action_label='Review requests', action_path=f'/campus/clubs/{club.pk}?tab=manage',
        )


def join_request_decided(join_request):
    club = join_request.club
    approved = join_request.status == join_request.Status.APPROVED
    lines = ([f'Welcome to {club.name}! You can now see its announcements and activities.'] if approved else
             [f'Your request to join {club.name} was not approved.'] +
             ([f'Reason: {join_request.reason}'] if join_request.reason else []))
    send_email(join_request.student.email,
               f'{"Welcome to" if approved else "About your request to join"} {club.name}',
               'You joined a club' if approved else 'Your join request', lines,
               action_label='Open the club', action_path=f'/campus/clubs/{club.pk}')


def role_given(assignment):
    """Tell someone they were appointed (advisors are notified when SDCL assigns them, per UniKLSKILL F022)."""
    label = f'{assignment.position} ({assignment.get_role_display()})' if assignment.position \
        else assignment.get_role_display()
    path = f'/campus/clubs/{assignment.unit_id}' if assignment.unit.kind == 'CLUB' else '/campus'
    send_email(assignment.user.email, f'You are now {label} of {assignment.unit.name}', 'You have a new campus role',
               [f'You were appointed {label} of {assignment.unit.name} on UniPact Campus.'],
               details=[('Session', assignment.session or '-')], action_label='Open UniPact Campus', action_path=path)


def role_ended(assignment):
    send_email(assignment.user.email, f'Your role at {assignment.unit.name} has ended', 'A campus role ended',
               [f'Your role as {assignment.get_role_display()} of {assignment.unit.name} has ended.'] +
               ([f'Reason: {assignment.ended_reason}'] if assignment.ended_reason else []),
               action_label='Open UniPact Campus', action_path='/campus')


def pilot_invited(access, has_account):
    """A student was added to a campus's closed pilot."""
    lines = [f'{access.campus.name} added you to the UniPact Campus pilot: clubs, activity approvals and GHOCS '
             'points in one place.']
    if has_account:
        lines.append('Sign in to UniPact and open Campus from the menu.')
        label, path = 'Open UniPact Campus', '/campus'
    else:
        lines.append(f'Sign up as a student with this email address ({access.email}) and Campus will appear in '
                     'your menu.')
        label, path = 'Create your account', '/register/student'
    send_email(access.email, 'You are invited to the UniPact Campus pilot', "You're in the pilot", lines,
               action_label=label, action_path=path)
