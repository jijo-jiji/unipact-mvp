import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, ClipboardCheck, MinusCircle, XCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  ACTIVITY_LEVELS, CLUB_TYPES, Card, CampusPage, DNA_CATEGORIES, Empty, ErrorNote, Loading, MERIT_ELEMENTS,
  StatusPill, Tabs, formatDate, labelOf, useLoad,
} from '../components/campus/CampusUI';

const STEP_ICON = {
  APPROVED: <CheckCircle2 className="text-emerald-600" size={20} aria-hidden="true" />,
  REJECTED: <XCircle className="text-red-600" size={20} aria-hidden="true" />,
  SKIPPED: <MinusCircle className="text-slate-400" size={20} aria-hidden="true" />,
  PENDING: <Circle className="text-[#5B6478]" size={20} aria-hidden="true" />,
};

const Row = ({ label, children }) => (children || children === 0 ? (
  <div className="grid sm:grid-cols-[180px_1fr] gap-1 py-1.5 text-sm">
    <dt className="text-[#5B6478]">{label}</dt><dd className="whitespace-pre-line">{children}</dd>
  </div>
) : null);

const Target = ({ target }) => {
  if (!target) return null;
  if (target.type === 'club_proposal') {
    return (
      <dl className="divide-y divide-[rgba(10,23,72,0.06)]">
        <Row label="Club name">{target.name}</Row>
        <Row label="Section">{target.section_detail?.name}</Row>
        <Row label="Type">{labelOf(CLUB_TYPES, target.club_type)}</Row>
        <Row label="UniKL DNA category">{labelOf(DNA_CATEGORIES, target.dna_category)}</Row>
        <Row label="S.P.I.C.E.S">{target.merit_elements?.map((m) => labelOf(MERIT_ELEMENTS, m)).join(', ')}</Row>
        <Row label="Description">{target.description}</Row>
        <Row label="Objectives">{target.objectives?.map((o, i) => `${i + 1}. ${o}`).join('\n')}</Row>
        <Row label="Activities">{target.proposed_activities?.map((a) => `${a.name}${a.date ? ` (${a.date})` : ''}${a.cost ? ` · RM ${a.cost}` : ''}`).join('\n')}</Row>
        <Row label="Target members">{[target.target_members, target.expected_members && `about ${target.expected_members}`].filter(Boolean).join(', ')}</Row>
        <Row label="Benefits">{target.benefits}</Row>
        <Row label="Budget">{target.budget_items?.length ? `${target.budget_items.map((b) => `${b.item}: RM ${b.cost}`).join('\n')}\nTotal: RM ${target.budget_items.reduce((s, b) => s + Number(b.cost || 0), 0).toFixed(2)}` : null}</Row>
        <Row label="Proposed advisor">{target.proposed_advisor?.name}</Row>
        <Row label="Founding members">{target.founding_members?.join(', ')}</Row>
        <Row label="Proposal document">{target.document && <a className="text-[#00729F] underline" href={target.document} target="_blank" rel="noopener noreferrer">Open</a>}</Row>
      </dl>
    );
  }
  if (target.type === 'activity') {
    const rm = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link to={`/campus/activities/${target.id}`} className="btn-secondary btn-sm">Open the activity</Link>
          <button type="button" className="btn-secondary btn-sm" onClick={async () => {
            const res = await api.get(`/campus/activities/${target.id}/saf.pdf`, { responseType: 'blob' });
            window.open(URL.createObjectURL(res.data), '_blank', 'noopener');
          }}>SAF form (PDF)</button>
        </div>
        <dl className="divide-y divide-[rgba(10,23,72,0.06)]">
          <Row label="Club">{target.club_detail?.name}</Row>
          <Row label="Programme">{target.title}</Row>
          <Row label="When">{`${formatDate(target.starts_at)} to ${formatDate(target.ends_at)}`}</Row>
          <Row label="Venue">{`${target.venue}${target.on_campus ? '' : ' (off campus)'}`}</Row>
          <Row label="Background">{target.background}</Row>
          <Row label="Objectives">{target.objectives?.map((o, i) => `${i + 1}. ${o}`).join('\n')}</Row>
          <Row label="Level">{labelOf(ACTIVITY_LEVELS, target.activity_level)}</Row>
          <Row label="UniKL DNA category">{labelOf(DNA_CATEGORIES, target.dna_category)}</Row>
          <Row label="S.P.I.C.E.S">{target.merit_elements?.map((m) => labelOf(MERIT_ELEMENTS, m)).join(', ')}</Row>
          <Row label="Expected participants">{target.expected_participants}</Row>
          <Row label="Budget">{Number(target.total_budget) > 0 ? `${target.budget_items.map((b) => `${b.item}: ${rm(Number(b.price) * Number(b.quantity))}`).join('\n')}\nTotal: ${rm(target.total_budget)}` : 'No budget'}</Row>
          <Row label="Funding">{Number(target.total_budget) > 0 ? `SAF ${rm(target.funding_saf)} · UniKL ${rm(target.funding_campus)} · Others ${rm(target.funding_other)}` : null}</Row>
          <Row label="Justification">{target.justification}</Row>
        </dl>
      </div>
    );
  }
  return (
    <dl className="divide-y divide-[rgba(10,23,72,0.06)]">
      <Row label="Title">{target.title}</Row>
      <Row label="Details">{target.body}</Row>
      <Row label="GHOCS-claimable">{target.ghocs_claimable ? 'Yes' : 'No'}</Row>
      <Row label="Level">{target.activity_level && labelOf(ACTIVITY_LEVELS, target.activity_level)}</Row>
      <Row label="UniKL DNA category">{target.dna_category && labelOf(DNA_CATEGORIES, target.dna_category)}</Row>
      <Row label="S.P.I.C.E.S">{target.merit_elements?.map((m) => labelOf(MERIT_ELEMENTS, m)).join(', ')}</Row>
      <Row label="Dates">{target.starts_on && `${formatDate(target.starts_on)}${target.ends_on ? ` to ${formatDate(target.ends_on)}` : ''}`}</Row>
      <Row label="Location">{target.location}</Row>
    </dl>
  );
};

const Detail = ({ id, onChanged }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { data, error, loading, setData } = useLoad(`/campus/approvals/${id}/`);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (path, body, ok) => {
    setBusy(true);
    try {
      const res = await api.post(`/campus/approvals/${id}/${path}/`, body);
      setData(res.data);
      setComment('');
      showToast(ok, 'success');
      onChanged();
    } catch (err) {
      const d = err?.response?.data;
      showToast(d?.comment?.[0] || getErrorMessage(err), 'error');
    } finally { setBusy(false); }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1"><span className="eyebrow-dot" /> {data.kind_label}</p>
        <h2 className="font-heading font-bold text-2xl">{data.title}</h2>
        <p className="text-sm text-[#5B6478]">From {data.submitted_by?.name} · {formatDate(data.created_at)} · <StatusPill status={data.status} label={data.status_label} /></p>
      </div>

      <ol className="space-y-3" aria-label="Sign-off steps">
        {data.steps.map((s) => (
          <li key={s.order} className={`flex gap-3 ${s.order === data.current_step ? 'font-semibold' : ''}`}>
            {STEP_ICON[s.decision]}
            <div className="text-sm">
              <p>{s.order}. {s.label}{s.order === data.current_step && <span className="ml-2 badge bg-amber-50 text-amber-800 border-amber-200">Waiting</span>}</p>
              <p className="text-[#5B6478] font-normal">
                {s.decided_by ? `${s.decision_label} by ${s.decided_by.name}, ${formatDate(s.decided_at)}` : s.assignee ? s.assignee.name : `${s.role_labels.join(' or ')} · ${s.scope_name}`}
              </p>
              {s.comment && <p className="text-[#5B6478] font-normal italic">"{s.comment}"</p>}
            </div>
          </li>
        ))}
      </ol>

      {data.can_sign && (
        <div className="rounded-lg bg-[#F5F7FC] p-4 space-y-3">
          <label className="field-label" htmlFor="decision-comment">Comment</label>
          <textarea id="decision-comment" className="input min-h-[72px]" placeholder="Required if you don't approve" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => send('decide', { approve: true, comment }, 'Approved.')}>Approve</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => send('decide', { approve: false, comment }, 'Marked as not approved.')}>Don't approve</button>
          </div>
        </div>
      )}
      {data.status === 'PENDING' && data.submitted_by?.id === user?.id && (
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => send('withdraw', {}, 'Withdrawn.')}>Withdraw</button>
      )}

      <div>
        <h3 className="font-heading font-bold text-lg mb-1">Details</h3>
        <Target target={data.target} />
      </div>
    </div>
  );
};

// Approvals: requests waiting for my signature, and the ones I sent, with the full sign-off trail.
const CampusApprovals = () => {
  usePageTitle('Approvals');
  const [params, setParams] = useSearchParams();
  const mine = params.get('mine') === '1';
  const open = params.get('open');
  const { data, error, loading, reload } = useLoad('/campus/approvals/', mine ? { mine: 1 } : {});

  const select = (id) => setParams({ ...(mine ? { mine: '1' } : {}), ...(id ? { open: String(id) } : {}) });

  return (
    <CampusPage title="Approvals" intro="Sign requests that are waiting for you. Every decision is recorded with your name and comment." back={{ to: '/campus', label: 'Campus' }}>
      <Tabs tabs={[['inbox', 'Waiting for me'], ['mine', 'Sent by me']]} value={mine ? 'mine' : 'inbox'} onChange={(k) => setParams(k === 'mine' ? { mine: '1' } : {})} label="Approval lists" />
      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <Card className="p-0 sm:p-0 overflow-hidden">
          {loading && !data && <Loading />}
          <ErrorNote>{error}</ErrorNote>
          {data && data.length === 0 && (
            <Empty icon={ClipboardCheck} title={mine ? "You haven't sent anything" : 'Nothing is waiting for you'} />
          )}
          <ul className="divide-y divide-[rgba(10,23,72,0.08)]">
            {(data || []).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => select(r.id)}
                  className={`w-full text-left px-5 py-4 hover:bg-[#F5F7FC] ${String(r.id) === open ? 'bg-[#00AEEF]/5 border-l-4 border-[#00AEEF]' : ''}`}>
                  <p className="text-xs text-[#5B6478]">{r.kind_label} · {formatDate(r.created_at)}</p>
                  <p className="font-semibold">{r.title}</p>
                  <div className="mt-1"><StatusPill status={r.status} label={r.status === 'PENDING' && r.current_step ? `Step ${r.current_step} of ${r.steps.length}` : r.status_label} /></div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          {open ? <Detail key={open} id={open} onChanged={reload} /> : <Empty icon={ClipboardCheck} title="Choose a request to see it" />}
        </Card>
      </div>
    </CampusPage>
  );
};

export default CampusApprovals;
