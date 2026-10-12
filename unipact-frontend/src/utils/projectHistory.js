// What has happened on a project so far, built from what the project already records.
// Used by the progress bar's phase history and the overview's latest activity, on both the client's
// project page and the student's.
import { formatDate, formatMoney } from './format';

export const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Events per phase, oldest first. `viewer` is 'client' (the company that owns the project) or 'student'
// (someone on its team, identified by `myProfileId`). Wording stays neutral where a UniPact admin can act
// for the client (confirming a team, approving a milestone).
export const phaseEvents = (campaign, { viewer = 'client', myProfileId = null } = {}) => {
  const forStudent = viewer === 'student';
  const events = { OPEN: [], MATCHED: [], IN_PROGRESS: [], COMPLETED: [] };
  const add = (phase, at, text, detail, when) => events[phase].push({ at: at || null, text, detail: detail || null, when });
  const started = campaign.started_at ? new Date(campaign.started_at) : null;
  const note = campaign.match_notes && `${forStudent ? 'Why you were matched' : 'UniPact\'s note'}: ${campaign.match_notes}`;

  // Posted
  const deliverableCount = (campaign.requirements || []).length;
  add('OPEN', campaign.created_at, forStudent ? `${campaign.company_name || 'The client'} posted this project` : 'You posted this project', [
    forStudent ? `Team pay ${formatMoney(campaign.student_pool ?? campaign.budget)}` : `Budget ${formatMoney(campaign.budget)}`,
    `due ${formatDate(campaign.deadline, 'date flexible')}`,
    deliverableCount > 0 && `${plural(deliverableCount, 'deliverable')} requested`,
  ].filter(Boolean).join(' · '));

  // Matched: who was proposed, who accepted, and (for the client) the payment that confirmed it
  const offers = campaign.match_offers || [];
  const team = campaign.assigned_students_details || [];
  offers.forEach((o, i) => {
    const mine = forStudent && o.student === myProfileId;
    const offered = !forStudent ? `UniPact proposed ${o.student_name} for your team`
      : mine ? 'UniPact offered you this project' : `UniPact offered the project to ${o.student_name}`;
    add('MATCHED', o.offered_at, offered, i === 0 && note);
    if (o.status === 'ACCEPTED' && o.responded_at) add('MATCHED', o.responded_at, mine ? 'You accepted the project' : `${o.student_name} accepted the project`);
    if (o.status === 'PENDING') add('MATCHED', null, mine ? 'You have not answered yet' : `${o.student_name} has not answered yet`, null, 'Waiting');
  });
  if (offers.length === 0 && team.length > 0) {
    add('MATCHED', null, `UniPact matched ${team.map((s) => s.full_name).join(', ')} to ${forStudent ? 'this' : 'your'} project`, note);
  }
  (campaign.escrow?.payments || []).forEach((p) => {
    // A payment made after work began (a project billed in parts) belongs to the In progress phase
    const phase = started && new Date(p.created_at) > started ? 'IN_PROGRESS' : 'MATCHED';
    add(phase, p.created_at, `Payment of ${formatMoney(p.amount)} received${p.is_test ? ' (test payment)' : ''}`, p.reference && `Reference ${p.reference}`);
  });

  // In progress: the start, then each milestone and shared file
  if (started) add('IN_PROGRESS', campaign.started_at, forStudent ? 'The client confirmed the team and work started' : 'Team confirmed and work started');
  (campaign.team_invitations || []).filter((inv) => inv.status === 'ACCEPTED' && inv.invitee_student_name).forEach((inv) => {
    add('IN_PROGRESS', inv.updated_at, `${inv.invitee_student_name} joined the team${inv.role_in_project ? ` as ${inv.role_in_project}` : ''}`);
  });
  (campaign.milestones || []).forEach((m) => {
    const name = `Milestone ${m.step_number} (${m.title})`;
    const round = `revision ${m.revisions_used} of ${m.max_revisions}`;
    if (m.status === 'REVISION_REQUESTED') {
      if (m.submitted_at) add('IN_PROGRESS', m.submitted_at, `${name} was submitted for review`);
      add('IN_PROGRESS', null, forStudent ? `The client asked for changes on ${name} (${round})` : `Changes were requested on ${name} (${round})`, m.deliverable_notes, 'Waiting');
    } else if (m.submitted_at) {
      add('IN_PROGRESS', m.submitted_at, m.revisions_used > 0 ? `${name} was resubmitted with the requested changes (${round})` : `${name} was submitted for review`);
    }
    if (m.status === 'APPROVED') {
      add('IN_PROGRESS', m.approved_at, m.auto_approved ? `${name} was accepted automatically when the review period ended` : `${name} was approved`,
        `${formatMoney(m.amount)} released to ${forStudent ? 'the' : 'your'} team`);
    }
  });
  (campaign.student_deliverables || []).forEach((d) => {
    add('IN_PROGRESS', d.submitted_at, `${d.student_name} shared “${d.title}”`);
  });

  // Completed
  if (campaign.status === 'COMPLETED') add('COMPLETED', campaign.completed_at, 'Project completed');

  // Oldest first; anything without a recorded date keeps its place at the end
  Object.values(events).forEach((list) => {
    const dated = list.filter((e) => e.at).sort((a, b) => new Date(a.at) - new Date(b.at));
    list.splice(0, list.length, ...dated, ...list.filter((e) => !e.at));
  });
  return events;
};

// The most recent dated events across every phase, newest first
export const latestEvents = (campaign, options, limit = 6) =>
  Object.values(phaseEvents(campaign, options)).flat().filter((e) => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
