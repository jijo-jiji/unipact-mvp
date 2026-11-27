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
    if request.kind == request.Kind.GHOCS_CLAIM:
        path = '/campus/ghocs'
        if approved and getattr(request.ghocs_claim, 'entry', None):
            lines.append(f'{request.ghocs_claim.entry.points.normalize():f} points were added to your GHOCS record.')
    if request.kind == request.Kind.ACTIVITY:
        path = f'/campus/activities/{request.activity_id}'
        if approved:
            lines.append(f'Approval number: {request.activity.approval_number}. Publish it on its page when '
                         "you're ready for members to see it and check in.")
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


def activity_report_reminder(activity, people, days_late):
    for person in people:
        send_email(
            person.email, f'Activity report due: {activity.title}', 'Please submit your activity report',
            [f'"{activity.title}" ended and its activity report is '
             f'{"due" if days_late <= 0 else f"{days_late} day{"s" if days_late != 1 else ""} late"}.',
             'Add a summary, the amount spent and photos on the activity page. Your advisor reviews it.'],
            details=[('Club', activity.club.name), ('Approval number', activity.approval_number or '-')],
            action_label='Write the report', action_path=f'/campus/activities/{activity.pk}?tab=report',
        )


def activity_report_submitted(report, advisors):
    activity = report.activity
    for person in advisors:
        send_email(
            person.email, f'Activity report to review: {activity.title}', 'An activity report needs your review',
            [f'{activity.club.name} submitted the report for "{activity.title}".'],
            action_label='Review the report', action_path=f'/campus/activities/{activity.pk}?tab=report',
        )


def activity_report_reviewed(report, committee):
    activity = report.activity
    accepted = report.status == report.Status.ACCEPTED
    lines = [f'The advisor {"accepted" if accepted else "asked for changes to"} the report for "{activity.title}".']
    if report.advisor_remarks:
        lines.append(f'Remarks: {report.advisor_remarks}')
    for person in committee:
        send_email(person.email, f'{"Report accepted" if accepted else "Changes requested"}: {activity.title}',
                   'Your activity report was reviewed', lines,
                   action_label='Open the activity', action_path=f'/campus/activities/{activity.pk}?tab=report')


def claim_waiting(claim, people, days):
    for person in people:
        send_email(
            person.email, f'GHOCS claim waiting {days} days: {claim.title}', 'A GHOCS claim is still waiting',
            [f'{display_name(claim.student)} sent this claim {days} days ago and is waiting for your decision.'],
            details=[('Claim', claim.title), ('Type', claim.get_kind_display())],
            action_label='Review it', action_path=f'/campus/approvals?open={claim.approval.pk}',
        )
