import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, Flag, MessageSquare, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { campaignTypeLabel, formatDate, formatMoney } from '../utils/format';
import { studentNextStep } from '../utils/projectSummary';

// One of a student's projects, in brief. Everything else (submitting work, the team, payouts, the
// client's files) is on the project's own page.
const StudentProjectCard = ({ job }) => {
  const milestones = job.milestones || [];
  const approved = milestones.filter((m) => m.status === 'APPROVED').length;
  const team = job.assigned_students_details || [];
  const step = studentNextStep(job);
  const path = `/student/projects/${job.id}`;

  return (
    <article className={`card p-5 sm:p-6 transition-colors hover:border-[#00AEEF] ${step.action ? 'border-2 border-[#00AEEF]' : ''}`}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6]">{campaignTypeLabel(job.type)}</span>
            <StatusBadge status={job.status} />
          </div>
          <h3 className="font-heading font-bold text-xl text-[#0A1748]">
            <Link to={path} className="hover:text-[#0090C6]">{job.title}</Link>
          </h3>
          <p className="text-[#5B6478] text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>Client: <strong className="text-[#0A1748]">{job.company_name}</strong></span>
            <span>Team pay: <strong className="text-[#0B1E63]">{formatMoney(job.student_pool ?? job.budget)}</strong>{job.student_pool && <span className="text-xs"> (after {job.service_fee_percent}% UniPact fee)</span>}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> Due {formatDate(job.deadline, 'flexible')}</span>
          </p>
        </div>
        <Link to={path} className={`${step.action ? 'btn-primary' : 'btn-secondary'} self-start shrink-0 whitespace-nowrap`}>
          Open project <ArrowRight size={15} />
        </Link>
      </div>

      {step.text && (
        <p className={`mt-4 text-sm rounded-lg p-3 flex items-start gap-2 ${step.action ? 'bg-[#E6F7FD] text-[#0A1748]' : 'bg-[#F5F7FC] text-[#5B6478]'}`}>
          {step.action ? <Flag size={16} className="text-[#0090C6] shrink-0 mt-0.5" /> : <Clock size={16} className="shrink-0 mt-0.5" />}
          <span>{step.text}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#5B6478]">
        {milestones.length > 0 && <span className="inline-flex items-center gap-1.5"><Flag size={13} className="text-[#00AEEF]" /> {approved} of {milestones.length} milestone{milestones.length === 1 ? '' : 's'} approved</span>}
        <span className="inline-flex items-center gap-1.5"><Users size={13} className="text-[#00AEEF]" /> Team of {team.length}</span>
        {job.unread_messages > 0 && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0090C6]">
            <MessageSquare size={13} /> {job.unread_messages} new message{job.unread_messages === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </article>
  );
};

export default StudentProjectCard;
