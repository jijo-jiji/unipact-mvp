import React from 'react';
import { Activity, ArrowRight, CheckCircle2, Clock, Flag, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDateTime } from '../utils/projectHistory';

// The first tab of a project page (the client's and the student's): the numbers, the latest activity and
// the team and milestones at a glance. The page works out `stats` and `events` for whoever is viewing.
const ProjectOverview = ({ campaign, stats, events, isClubFlow = false, myProfileId = null, noTeamText, onOpenTab }) => {
  const team = campaign.assigned_students_details || [];
  const milestones = campaign.milestones || [];
  const offerStatus = Object.fromEntries((campaign.match_offers || []).map((o) => [o.student, o.status]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] mb-1">{stat.label}</div>
            <div className={`font-heading text-xl sm:text-2xl font-extrabold break-words ${stat.className}`}>{stat.value}</div>
            {stat.note && <div className="text-xs text-[#5B6478] mt-1">{stat.note}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card p-6 sm:p-8 lg:col-span-2">
          <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-4">
            <Activity size={18} className="text-[#00AEEF]" /> Latest activity
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-[#5B6478]">Nothing has happened yet.</p>
          ) : (
            <ol className="space-y-3">
              {events.map((event, i) => (
                <li key={i} className="flex flex-col sm:flex-row sm:gap-4 text-sm pb-3 border-b border-[rgba(10,23,72,0.06)] last:border-0 last:pb-0">
                  <span className="sm:w-40 shrink-0 text-xs text-[#5B6478] sm:pt-0.5">{formatDateTime(event.at)}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{event.text}</span>
                    {event.detail && <span className="block text-[#5B6478] break-words">{event.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-[#5B6478] mt-4">Select a phase in the progress bar above to see everything that happened in it.</p>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-3">
              <Users size={18} className="text-[#00AEEF]" /> {isClubFlow ? 'Clubs' : 'Project team'}
            </h2>
            {team.length === 0 ? (
              <p className="text-sm text-[#5B6478]">{noTeamText}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {team.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className="font-medium min-w-0 break-words">
                      {s.full_name}
                      {s.id === myProfileId && <span className="badge bg-[#00AEEF]/15 border-transparent text-[#0090C6] px-1.5 py-0 text-[10px] ml-1.5 align-middle">You</span>}
                    </span>
                    {campaign.status === 'MATCHED' && offerStatus[s.id] && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${offerStatus[s.id] === 'ACCEPTED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {offerStatus[s.id] === 'ACCEPTED' ? <><CheckCircle2 size={12} /> Accepted</> : <><Clock size={12} /> Waiting</>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => onOpenTab('team')} className="text-sm font-semibold text-[#0090C6] hover:underline inline-flex items-center gap-1 mt-4">
              Open team <ArrowRight size={14} />
            </button>
          </section>

          {!isClubFlow && (
            <section className="card p-6">
              <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-3">
                <Flag size={18} className="text-[#00AEEF]" /> Milestones
              </h2>
              {milestones.length === 0 ? (
                <p className="text-sm text-[#5B6478]">The milestone plan appears here once UniPact has set it up.</p>
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="font-medium min-w-0 break-words">{m.step_number}. {m.title}</span>
                      <StatusBadge status={m.status} />
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => onOpenTab('work')} className="text-sm font-semibold text-[#0090C6] hover:underline inline-flex items-center gap-1 mt-4">
                Open milestones &amp; work <ArrowRight size={14} />
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectOverview;
