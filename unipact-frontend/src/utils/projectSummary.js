// The headline numbers and "what's next" line of a project, for the client's and the student's pages.
import { formatDate, formatMoney } from './format';

const DAY = 24 * 60 * 60 * 1000;

export const deadlineNote = (campaign) => {
  if (campaign.status === 'COMPLETED') return campaign.completed_at ? `Completed ${formatDate(campaign.completed_at)}` : 'Completed';
  if (!campaign.deadline) return 'No fixed date';
  // Whole calendar days between today and the due date (the deadline is a date, not a time)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(`${campaign.deadline}T00:00:00`) - today) / DAY);
  if (Number.isNaN(days)) return null;
  if (days > 1) return `${days.toLocaleString('en-MY')} days left`;
  if (days === 1) return '1 day left';
  if (days === 0) return 'Due today';
  return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
};

const deadlineStat = (campaign) => ({
  label: 'Deadline',
  value: formatDate(campaign.deadline, 'Flexible'),
  className: 'text-[#0B1E63]',
  note: deadlineNote(campaign),
});

const milestoneCounts = (campaign) => {
  const milestones = campaign.milestones || [];
  return {
    total: milestones.length,
    approved: milestones.filter((m) => m.status === 'APPROVED').length,
    submitted: milestones.filter((m) => m.status === 'SUBMITTED').length,
  };
};

// The four cards at the top of the client's overview
export const clientStats = (campaign, isClubFlow) => {
  const escrow = campaign.escrow;
  const { total, approved, submitted } = milestoneCounts(campaign);
  const outstanding = Number(escrow?.outstanding || 0);
  const noEscrow = isClubFlow || !escrow;
  return [
    {
      label: 'Project fee',
      value: formatMoney(campaign.budget),
      className: 'text-[#0B1E63]',
      note: noEscrow
        ? null
        : campaign.status === 'OPEN'
          ? 'Nothing to pay until you confirm a team'
          : outstanding > 0
            ? `${formatMoney(escrow.client_paid)} paid · ${formatMoney(outstanding)} to pay`
            : 'Paid in full',
    },
    noEscrow
      ? { label: 'Club applications', value: (campaign.applications || []).length, className: 'text-[#00729F]', note: null }
      : {
        label: 'Paid to your team',
        value: formatMoney(escrow.released),
        className: 'text-emerald-600',
        note: `of their ${formatMoney(campaign.student_pool)} share`,
      },
    isClubFlow ? { label: 'Awarded to', value: campaign.guild || 'Not awarded yet', className: 'text-[#00729F]', note: null } : {
      label: 'Milestones approved',
      value: total > 0 ? `${approved} of ${total}` : '—',
      className: 'text-[#00729F]',
      note: total === 0
        ? 'No milestone plan yet'
        : submitted > 0
          ? `${submitted} waiting for your review`
          : approved === total ? 'All approved' : 'Team is working on the next one',
    },
    deadlineStat(campaign),
  ];
};

// The four cards at the top of a student's overview. `payouts` are this student's payouts for the project.
export const studentStats = (campaign, payouts) => {
  const { total, approved, submitted } = milestoneCounts(campaign);
  const sum = (list) => list.reduce((acc, p) => acc + Number(p.amount), 0);
  const paid = sum(payouts.filter((p) => p.status === 'PAID'));
  const onTheWay = sum(payouts.filter((p) => p.status !== 'PAID'));
  return [
    {
      label: 'Team pay',
      value: formatMoney(campaign.student_pool ?? campaign.budget),
      className: 'text-[#0B1E63]',
      note: campaign.student_pool ? `After the ${campaign.service_fee_percent}% UniPact fee` : null,
    },
    {
      label: 'Your payouts',
      value: formatMoney(paid + onTheWay),
      className: 'text-emerald-600',
      note: payouts.length === 0
        ? 'Released as each milestone is approved'
        : onTheWay > 0 ? `${formatMoney(paid)} paid · ${formatMoney(onTheWay)} on the way` : 'Paid in full',
    },
    {
      label: 'Milestones approved',
      value: total > 0 ? `${approved} of ${total}` : '—',
      className: 'text-[#00729F]',
      note: total === 0
        ? 'No milestone plan'
        : submitted > 0
          ? `${submitted} with the client for review`
          : approved === total ? 'All approved' : `${total - approved} still to submit`,
    },
    deadlineStat(campaign),
  ];
};

const canSubmit = (m) => ['PENDING', 'IN_PROGRESS', 'REVISION_REQUESTED'].includes(m.status);

// The milestone a student should hand in next: a requested revision first, then the next one still open
export const nextMilestoneToSubmit = (campaign) => {
  const milestones = campaign.milestones || [];
  return milestones.find((m) => m.status === 'REVISION_REQUESTED') || milestones.find(canSubmit) || null;
};

// One line telling a student where their project stands and what, if anything, they need to do.
// `action` is true when the next move is theirs.
export const studentNextStep = (campaign) => {
  const milestones = campaign.milestones || [];
  if (campaign.status === 'COMPLETED') return { text: 'Completed. Its Verified Impact Ledger is the record that goes on your portfolio.', action: false };
  if (campaign.status === 'MATCHED') {
    return {
      text: campaign.awaiting_student_acceptance
        ? 'You accepted. Waiting for the rest of the team to accept, then the client confirms and work starts.'
        : 'You accepted. Work starts as soon as the client confirms the team.',
      action: false,
    };
  }
  if (campaign.status !== 'IN_PROGRESS') return { text: '', action: false };

  const next = nextMilestoneToSubmit(campaign);
  if (next?.status === 'REVISION_REQUESTED') return { text: `The client asked for changes on milestone ${next.step_number} (${next.title}). Update it and resubmit.`, action: true };
  if (next) return { text: `Next: submit milestone ${next.step_number} (${next.title}).`, action: true };
  const waiting = milestones.find((m) => m.status === 'SUBMITTED');
  if (waiting) {
    return {
      text: `Milestone ${waiting.step_number} (${waiting.title}) is with the client for review${waiting.review_due_at ? `. It is accepted automatically if they don't respond by ${formatDate(waiting.review_due_at)}` : ''}.`,
      action: false,
    };
  }
  if (milestones.length > 0) return { text: 'Every milestone is approved. Waiting for the client to complete the project.', action: false };
  return { text: 'Share your work with the client when it is ready.', action: true };
};
