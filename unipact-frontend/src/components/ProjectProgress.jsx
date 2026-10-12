import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, X } from 'lucide-react';
import { formatDateTime, phaseEvents } from '../utils/projectHistory';

const STEPS = [
  { status: 'OPEN', label: 'Posted' },
  { status: 'MATCHED', label: 'Matched' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'COMPLETED', label: 'Completed' },
];

// The project's four phases. A phase the project has reached opens a dated history of what happened in it.
// `viewer` ('client' or 'student') and `myProfileId` word the history for whoever is reading it.
const ProjectProgress = ({ campaign, viewer = 'client', myProfileId = null }) => {
  const [open, setOpen] = useState(null);
  const { status } = campaign;
  const current = STEPS.findIndex((s) => s.status === status);
  const openStep = STEPS.find((s) => s.status === open);
  const events = openStep ? phaseEvents(campaign, { viewer, myProfileId })[openStep.status] : [];

  return (
    <div>
      <ol className="flex items-center gap-2 sm:gap-3 overflow-x-auto overflow-y-hidden" aria-label="Project progress">
        {STEPS.map((step, i) => {
          const done = i < current || status === 'COMPLETED';
          const active = i === current && status !== 'COMPLETED';
          const isOpen = open === step.status;
          const content = (
            <>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'bg-[#00AEEF] border-[#00AEEF] text-white' : 'bg-white border-[rgba(10,23,72,0.2)] text-[#5B6478]'
              }`}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </span>
              <span className={`text-sm ${active || isOpen ? 'font-semibold text-[#0A1748]' : 'text-[#5B6478]'}`}>{step.label}</span>
            </>
          );
          return (
            <li key={step.status} className="flex items-center gap-2 sm:gap-3 shrink-0">
              {done || active ? (
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : step.status)}
                  aria-expanded={isOpen}
                  title={`See what happened in "${step.label}"`}
                  className={`flex items-center gap-2 rounded-full p-1 pr-2.5 transition-colors hover:bg-[#F5F7FC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] ${isOpen ? 'bg-[#F5F7FC]' : ''}`}
                >
                  {content}
                  <ChevronDown size={14} className={`text-[#5B6478] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <span className="flex items-center gap-2 p-1">{content}</span>
              )}
              {i < STEPS.length - 1 && <span className="w-6 sm:w-10 h-px bg-[rgba(10,23,72,0.2)]" />}
            </li>
          );
        })}
      </ol>

      {openStep && (
        <div className="mt-4 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-heading font-bold text-base">{openStep.label}: what happened</h2>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="p-1.5 rounded-md text-[#5B6478] hover:text-[#0A1748] hover:bg-white">
              <X size={16} />
            </button>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-[#5B6478]">Nothing has happened in this step yet.</p>
          ) : (
            <ol className="space-y-3">
              {events.map((event, i) => (
                <li key={i} className="flex flex-col sm:flex-row sm:gap-4 text-sm">
                  <span className="sm:w-40 shrink-0 text-xs text-[#5B6478] sm:pt-0.5">{event.at ? formatDateTime(event.at) : event.when || '—'}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{event.text}</span>
                    {event.detail && <span className="block text-[#5B6478] break-words">{event.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectProgress;
