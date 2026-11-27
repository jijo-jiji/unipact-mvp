import React, { useState } from 'react';
import { Download } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import { Card, CampusPage, ErrorNote, Field, Loading, useLoad } from '../components/campus/CampusUI';

// The pilot dashboard: whether UniPact Campus fixed UniKLSKILL's problems (P1 scattered club information,
// P2 rejected claims, P3 slow GHOCS approval, P4 an opaque skills web), plus approval times and the survey.

// Likert diverging palette (validated: CVD and normal-vision separation pass; contrast WARN → every segment
// that's wide enough carries its percentage, and the table below repeats all of them).
const LIKERT = [
  { value: 1, label: 'Strongly disagree', color: '#c4343a', text: '#fff' },
  { value: 2, label: 'Disagree', color: '#ef8586', text: '#0A1748' },
  { value: 3, label: 'Neutral', color: '#dfe2e8', text: '#0A1748' },
  { value: 4, label: 'Agree', color: '#519ced', text: '#0A1748' },
  { value: 5, label: 'Strongly agree', color: '#17549f', text: '#fff' },
];
const BAR = '#00AEEF';

const num = (v, digits = 1) => (v === null || v === undefined ? '-' : Number(v).toLocaleString('en-MY', { maximumFractionDigits: digits }));
// Under a day reads better in hours: approvals at a pilot are often signed the same day
const days = (v) => {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (n < 1) return n * 24 < 1 ? 'under 1 h' : `${Math.round(n * 24)} h`;
  return `${num(n)} day${n === 1 ? '' : 's'}`;
};
const plural = (n, one, many) => `${num(n, 0)} ${Number(n) === 1 ? one : many}`;

const Stat = ({ label, value, note }) => (
  <div className="card p-4 bg-white border border-[rgba(10,23,72,0.1)]">
    <p className="text-sm text-[#5B6478]">{label}</p>
    <p className="font-heading font-extrabold text-3xl mt-1">{value}</p>
    {note && <p className="text-xs text-[#5B6478] mt-0.5">{note}</p>}
  </div>
);

// One measure across a few items: single-hue horizontal bars, largest first, value written beside each bar.
const Bars = ({ rows, value, label, format, extra }) => {
  const max = Math.max(...rows.map((r) => Number(value(r)) || 0), 0);
  if (!rows.length) return <p className="text-sm text-[#5B6478]">Nothing yet in this period.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const v = Number(value(r)) || 0;
        return (
          <li key={label(r)} className="grid grid-cols-[minmax(0,42%)_1fr] gap-3 items-center text-sm" title={`${label(r)}: ${format(v)}${extra ? ` · ${extra(r)}` : ''}`}>
            <span className="text-[#0A1748] leading-snug">{label(r)}</span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="h-3 rounded-r-[4px]" style={{ width: `${max ? Math.max((v / max) * 100, v ? 2 : 0) : 0}%`, background: BAR, maxWidth: '75%' }} />
              <span className="text-[#0A1748] whitespace-nowrap">{format(v)}{extra && <span className="text-[#5B6478]"> · {extra(r)}</span>}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
};

// 100% diverging stacked bar for Likert answers; 2px surface gaps between segments.
const LikertBar = ({ shares, label, sub }) => (
  <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[170px_1fr] gap-3 items-center">
    <div className="text-sm"><p className="font-semibold leading-tight">{label}</p>{sub && <p className="text-xs text-[#5B6478]">{sub}</p>}</div>
    <div className="flex h-7 gap-[2px] rounded overflow-hidden bg-white" role="img"
      aria-label={`${label}: ${LIKERT.map((l) => `${l.label} ${shares[l.value] || 0}%`).join(', ')}`}>
      {LIKERT.map((l) => {
        const share = Number(shares[l.value]) || 0;
        if (!share) return null;
        return (
          <span key={l.value} title={`${l.label}: ${share}%`} className="flex items-center justify-center text-[11px] font-semibold"
            style={{ width: `${share}%`, background: l.color, color: l.text }}>
            {share >= 8 ? `${Math.round(share)}%` : ''}
          </span>
        );
      })}
    </div>
  </div>
);

const Survey = ({ survey, campusId, isOpen, canManage, onChanged }) => {
  const { showToast } = useToast();
  const toggle = async () => {
    try { await api.patch('/campus/survey/settings/', { campus: campusId, is_open: !isOpen }); onChanged(); showToast(isOpen ? 'Survey closed.' : 'Survey open. Pilot users see it on Campus home.', 'success'); } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };
  const base = survey.baseline;
  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl">Pilot survey</h2>
          <p className="text-sm text-[#5B6478]">UniKLSKILL's 15 acceptance questions, so the pilot compares with its baseline ({base.label}).
            {' '}{survey.n} response{survey.n === 1 ? '' : 's'}{survey.n ? `: ${Object.entries(survey.by_type).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ')}` : ''}.</p>
        </div>
        {canManage && <button type="button" className={isOpen ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={toggle}>{isOpen ? 'Close the survey' : 'Open the survey'}</button>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
        {LIKERT.map((l) => <span key={l.value} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />{l.label}</span>)}
      </div>
      <div className="space-y-4">
        {survey.categories.map((c) => (
          <div key={c.key} className="space-y-1.5">
            <LikertBar shares={c.shares} label={c.label} sub={survey.n ? `Pilot · mean ${num(c.mean, 2)}` : 'Pilot · no answers yet'} />
            <LikertBar shares={base[c.key]} label="" sub={`Baseline (n=${base.n})`} />
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-left text-[#5B6478] border-b border-[rgba(10,23,72,0.12)]"><th className="py-1.5 font-semibold">Category</th>{LIKERT.map((l) => <th key={l.value} className="font-semibold text-right">{l.label}</th>)}</tr></thead>
          <tbody>
            {survey.categories.flatMap((c) => [
              <tr key={c.key} className="border-b border-[rgba(10,23,72,0.06)]"><td className="py-1.5 font-semibold">{c.label} (pilot)</td>{LIKERT.map((l) => <td key={l.value} className="text-right">{num(c.shares[l.value])}%</td>)}</tr>,
              <tr key={`${c.key}-b`} className="border-b border-[rgba(10,23,72,0.06)] text-[#5B6478]"><td className="py-1.5">{c.label} (baseline)</td>{LIKERT.map((l) => <td key={l.value} className="text-right">{num(base[c.key][l.value])}%</td>)}</tr>,
            ])}
          </tbody>
        </table>
      </div>
      {survey.comments.length > 0 && (
        <div>
          <h3 className="font-semibold">Comments</h3>
          <ul className="mt-2 space-y-2">{survey.comments.map((c) => <li key={c} className="text-sm rounded-lg bg-[#F5F7FC] p-3">"{c}"</li>)}</ul>
        </div>
      )}
    </Card>
  );
};

const CampusDashboard = () => {
  usePageTitle('Pilot dashboard');
  const { showToast } = useToast();
  const [range, setRange] = useState({ start: '', end: '' });
  const params = Object.fromEntries(Object.entries(range).filter(([, v]) => v));
  const { data, error, loading, reload } = useLoad('/campus/dashboard/', params);

  const exportCsv = async (table) => {
    try {
      const res = await api.get('/campus/dashboard/', { params: { ...params, campus: data.campus.id, export: table }, responseType: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(res.data);
      link.download = `unipact-campus-${table}.csv`;
      link.click();
    } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };

  const a = data?.activities;
  const g = data?.ghocs;
  return (
    <CampusPage
      title="Pilot dashboard"
      intro={data ? `${data.campus.name} · ${data.period.start} to ${data.period.end}` : 'What the pilot shows so far.'}
      back={{ to: '/campus', label: 'Campus' }}
      actions={data && (
        <div className="flex flex-wrap gap-2">
          {[['activities', 'Activities'], ['claims', 'GHOCS claims'], ['approvals', 'Approvals']].map(([k, l]) => (
            <button key={k} type="button" className="btn-secondary btn-sm" onClick={() => exportCsv(k)}><Download size={15} aria-hidden="true" /> {l} CSV</button>
          ))}
        </div>
      )}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From" htmlFor="from"><input id="from" type="date" className="input w-auto" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></Field>
        <Field label="To" htmlFor="to"><input id="to" type="date" className="input w-auto" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></Field>
        {(range.start || range.end) && <button type="button" className="btn-secondary btn-sm mb-0.5" onClick={() => setRange({ start: '', end: '' })}>Whole pilot</button>}
      </div>
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Students in clubs" value={num(data.clubs.students_in_clubs, 0)} note={`${plural(data.clubs.clubs, 'club', 'clubs')}${data.clubs.join_median_hours === null ? '' : ` · join requests decided in ${num(data.clubs.join_median_hours)} h (median)`}`} />
            <Stat label="Activities held" value={num(a.held, 0)} note={`${plural(a.attendance, 'check-in', 'check-ins')} · ${plural(a.unique_students, 'student', 'students')}`} />
            <Stat label="GHOCS claim decision" value={days(g.claims.median_days)} note={`median · ${g.claims.pending} waiting`} />
            <Stat label="Points with no claim needed" value={g.automatic_share === null ? '-' : `${num(g.automatic_share)}%`} note={`${g.automatic} from club activities · ${g.from_claims} from claims`} />
            <Stat label="Reports on time" value={a.reports.on_time_rate === null ? '-' : `${num(a.reports.on_time_rate)}%`} note={`${a.reports.late} late · ${a.reports.missing} missing (due ${a.reports.due_days} days after)`} />
          </div>

          <Card>
            <h2 className="font-heading font-bold text-xl">Approvals</h2>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm min-w-[620px]">
                <thead><tr className="text-left text-[#5B6478] border-b border-[rgba(10,23,72,0.12)]"><th className="py-2 font-semibold">Request</th><th className="font-semibold text-right">Sent</th><th className="font-semibold text-right">Approved</th><th className="font-semibold text-right">Not approved</th><th className="font-semibold text-right">Waiting</th><th className="font-semibold text-right">Median time to decision</th><th className="font-semibold text-right">Oldest waiting</th></tr></thead>
                <tbody>
                  {data.approvals.length === 0 && <tr><td colSpan={7} className="py-3 text-[#5B6478]">No requests in this period.</td></tr>}
                  {data.approvals.map((r) => (
                    <tr key={r.kind} className="border-b border-[rgba(10,23,72,0.06)]"><td className="py-2 font-semibold">{r.label}</td><td className="text-right">{r.submitted}</td><td className="text-right">{r.approved}</td><td className="text-right">{r.rejected}</td><td className="text-right">{r.pending}</td><td className="text-right">{days(r.median_days)}</td><td className="text-right">{days(r.oldest_pending_days)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <Card>
              <h2 className="font-heading font-bold text-xl">Where activity approvals wait</h2>
              <p className="text-sm text-[#5B6478] mb-4">Median time each signature took after the one before it. The longest is where to follow up.</p>
              <Bars rows={data.step_times} value={(r) => r.median_days} label={(r) => r.step} format={(v) => days(v)} extra={(r) => `${r.signed} signed`} />
            </Card>
            <Card>
              <h2 className="font-heading font-bold text-xl">Participation by UniKL DNA category</h2>
              <p className="text-sm text-[#5B6478] mb-4">Check-ins at activities held in this period.</p>
              <Bars rows={[...a.by_category].sort((x, y) => y.attendance - x.attendance)} value={(r) => r.attendance} label={(r) => r.category}
                format={(v) => `${num(v, 0)} check-in${v === 1 ? '' : 's'}`} extra={(r) => `${r.activities} activit${r.activities === 1 ? 'y' : 'ies'}`} />
            </Card>
          </div>

          <Card>
            <h2 className="font-heading font-bold text-xl">GHOCS</h2>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
              <div><dt className="text-[#5B6478]">Students with points</dt><dd className="font-heading font-bold text-2xl">{num(g.students_with_points, 0)}</dd></div>
              <div><dt className="text-[#5B6478]">Webs covering all five skills</dt><dd className="font-heading font-bold text-2xl">{num(g.balanced_webs, 0)}</dd></div>
              <div><dt className="text-[#5B6478]">Claims sent / approved / not approved</dt><dd className="font-heading font-bold text-2xl">{g.claims.submitted} / {g.claims.approved} / {g.claims.rejected}</dd></div>
              <div><dt className="text-[#5B6478]">Claims not approved</dt><dd className="font-heading font-bold text-2xl">{g.claims.rejection_rate === null ? '-' : `${num(g.claims.rejection_rate)}%`}</dd></div>
            </dl>
          </Card>

          <Survey survey={data.survey} campusId={data.campus.id} isOpen={data.survey_open} canManage={data.can_manage} onChanged={reload} />
        </>
      )}
    </CampusPage>
  );
};

export default CampusDashboard;
