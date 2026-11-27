import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { CalendarDays, Download, EyeOff, Maximize2, MapPin, RefreshCw, Users, X } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  ACTIVITY_LEVELS, Card, CampusPage, ChoiceChips, DNA_CATEGORIES, Empty, ErrorNote, Field, Loading, MERIT_ELEMENTS,
  StatusPill, Tabs, formatDate, labelOf, useLoad,
} from '../components/campus/CampusUI';

const rm = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (a) => {
  const s = new Date(a.starts_at);
  const e = new Date(a.ends_at);
  const time = (d) => d.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' });
  return s.toDateString() === e.toDateString()
    ? `${formatDate(a.starts_at)}, ${time(s)} to ${time(e)}`
    : `${formatDate(a.starts_at)} ${time(s)} to ${formatDate(a.ends_at)} ${time(e)}`;
};
const errorText = (err) => {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    const [k, v] = Object.entries(d)[0] || [];
    if (k) return k === 'detail' ? String(v) : `${k.replaceAll('_', ' ')}: ${[].concat(v)[0]}`;
  }
  return getErrorMessage(err);
};

const openPdf = async (id, showToast) => {
  try {
    const res = await api.get(`/campus/activities/${id}/saf.pdf`, { responseType: 'blob' });
    window.open(URL.createObjectURL(res.data), '_blank', 'noopener');
  } catch (err) { showToast(errorText(err), 'error'); }
};

// --- Details -------------------------------------------------------------------------------------------------
const Details = ({ a }) => (
  <div className="grid lg:grid-cols-[1fr_340px] gap-6">
    <Card className="space-y-4">
      <div><h2 className="font-heading font-bold text-xl">Background</h2><p className="text-[#5B6478] mt-1 whitespace-pre-line">{a.background}</p></div>
      {a.objectives?.length > 0 && (
        <div><h3 className="font-semibold">Objectives</h3><ol className="list-decimal pl-5 text-[#5B6478] mt-1 space-y-0.5">{a.objectives.map((o) => <li key={o}>{o}</li>)}</ol></div>
      )}
      {a.justification && <div><h3 className="font-semibold">Justification</h3><p className="text-[#5B6478] mt-1 whitespace-pre-line">{a.justification}</p></div>}
      {Number(a.total_budget) > 0 && (
        <div>
          <h3 className="font-semibold">Budget</h3>
          <table className="w-full text-sm mt-2">
            <thead><tr className="text-left text-[#5B6478] border-b border-[rgba(10,23,72,0.12)]"><th className="py-1.5 font-semibold">Item</th><th className="font-semibold text-right">Price</th><th className="font-semibold text-right">Qty</th><th className="font-semibold text-right">Total</th></tr></thead>
            <tbody>
              {a.budget_items.map((r) => (
                <tr key={r.item} className="border-b border-[rgba(10,23,72,0.06)]"><td className="py-1.5">{r.item}</td><td className="text-right">{rm(r.price)}</td><td className="text-right">{Number(r.quantity)}</td><td className="text-right">{rm(Number(r.price) * Number(r.quantity))}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total</td><td /><td /><td className="text-right">{rm(a.total_budget)}</td></tr>
            </tbody>
          </table>
          <p className="text-sm text-[#5B6478] mt-2">Funded by: Student Activity Fund {rm(a.funding_saf)} · UniKL MIIT {rm(a.funding_campus)} · Others {rm(a.funding_other)}</p>
        </div>
      )}
    </Card>
    <Card className="space-y-3 h-fit text-sm">
      <p className="flex gap-2"><CalendarDays size={16} className="text-[#00AEEF] shrink-0 mt-0.5" aria-hidden="true" />{when(a)}</p>
      <p className="flex gap-2"><MapPin size={16} className="text-[#00AEEF] shrink-0 mt-0.5" aria-hidden="true" />{a.venue}{a.on_campus ? '' : ' (off campus)'}</p>
      {a.expected_participants && <p className="flex gap-2"><Users size={16} className="text-[#00AEEF] shrink-0 mt-0.5" aria-hidden="true" />{a.expected_participants} expected · {a.attendance_count} checked in</p>}
      <dl className="pt-2 border-t border-[rgba(10,23,72,0.08)] space-y-2">
        <div><dt className="text-[#5B6478]">Level</dt><dd className="font-semibold">{labelOf(ACTIVITY_LEVELS, a.activity_level)}</dd></div>
        <div><dt className="text-[#5B6478]">UniKL DNA category</dt><dd className="font-semibold">{labelOf(DNA_CATEGORIES, a.dna_category)}</dd></div>
        <div><dt className="text-[#5B6478]">S.P.I.C.E.S</dt><dd className="font-semibold">{a.merit_elements.map((m) => labelOf(MERIT_ELEMENTS, m)).join(', ')}</dd></div>
        {a.approval_number && <div><dt className="text-[#5B6478]">Approval number</dt><dd className="font-semibold">{a.approval_number}</dd></div>}
      </dl>
    </Card>
  </div>
);

// --- Check-in ------------------------------------------------------------------------------------------------
const CheckIn = ({ a, onChanged }) => {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useLoad(`/campus/activities/${a.id}/attendance/`);
  const [email, setEmail] = useState('');
  const [big, setBig] = useState(false);
  const link = data?.checkin_code ? `${window.location.origin}/campus/checkin/${data.checkin_code}` : '';

  const control = async (body, ok) => {
    try { await api.post(`/campus/activities/${a.id}/checkin/`, body); await reload(); onChanged(); if (ok) showToast(ok, 'success'); } catch (err) { showToast(errorText(err), 'error'); }
  };
  const add = async (e) => {
    e.preventDefault();
    try { await api.post(`/campus/activities/${a.id}/attendance/`, { email }); setEmail(''); reload(); onChanged(); } catch (err) { showToast(errorText(err), 'error'); }
  };
  const setRole = async (row, role) => {
    try { await api.patch(`/campus/activities/${a.id}/attendance/${row.id}/`, { role }); reload(); } catch (err) { showToast(errorText(err), 'error'); }
  };
  const remove = async (row) => {
    try { await api.delete(`/campus/activities/${a.id}/attendance/${row.id}/`); reload(); onChanged(); } catch (err) { showToast(errorText(err), 'error'); }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
      <Card className="space-y-4 text-center">
        <h2 className="font-heading font-bold text-xl">QR check-in</h2>
        {data.checkin_open ? (
          <>
            <div className="mx-auto w-fit p-3 bg-white rounded-lg border border-[rgba(10,23,72,0.12)]">
              <QRCodeCanvas value={link} size={512} marginSize={2} fgColor="#0A1748" style={{ width: 220, height: 220 }} />
            </div>
            <p className="text-sm text-[#5B6478]">Students scan this with their phone camera and tap Check in.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button type="button" className="btn-primary btn-sm" onClick={() => setBig(true)}><Maximize2 size={15} aria-hidden="true" /> Show full screen</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => control({ open: false }, 'Check-in closed.')}>Close check-in</button>
            </div>
            <button type="button" className="text-xs text-[#5B6478] hover:text-[#0A1748] inline-flex items-center gap-1"
              onClick={() => window.confirm('Make a new QR code? The old one stops working.') && control({ new_code: true, open: true }, 'New QR code made.')}>
              <RefreshCw size={12} aria-hidden="true" /> New code (if the QR was shared outside the room)
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[#5B6478]">Open check-in when the activity starts. Close it when it ends.</p>
            <button type="button" className="btn-primary" onClick={() => control({ open: true }, 'Check-in is open.')}>Open check-in</button>
          </>
        )}
      </Card>
      <Card>
        <h2 className="font-heading font-bold text-xl">Attendance <span className="text-[#5B6478] text-base font-normal">({data.attendance.length})</span></h2>
        <p className="text-sm text-[#5B6478]">Set each person's role: it decides their GHOCS points later.</p>
        <form onSubmit={add} className="flex gap-2 mt-3">
          <input className="input" type="email" required placeholder="Add someone who didn't scan (student email)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Student email" />
          <button className="btn-secondary btn-sm" type="submit">Add</button>
        </form>
        <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-3">
          {data.attendance.map((row) => (
            <li key={row.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div><p className="font-semibold">{row.person.name}</p><p className="text-xs text-[#5B6478]">{row.method_label} · {new Date(row.checked_in_at).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}</p></div>
              <div className="flex gap-2 items-center">
                <select className="input w-auto" value={row.role} onChange={(e) => setRole(row, e.target.value)} aria-label={`Role of ${row.person.name}`}>
                  <option value="PARTICIPANT">Participant</option><option value="COMMITTEE">Committee / AJK</option><option value="ORGANISER">Program director</option>
                </select>
                <button type="button" className="text-[#5B6478] hover:text-red-600" aria-label={`Remove ${row.person.name}`} onClick={() => remove(row)}><X size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {big && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center" role="dialog" aria-label="Check-in QR code">
          <button type="button" className="absolute top-4 right-4 btn-secondary btn-sm" onClick={() => setBig(false)}><X size={15} aria-hidden="true" /> Close</button>
          <p className="eyebrow mb-2"><span className="eyebrow-dot" /> Check in</p>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-6">{a.title}</h2>
          <QRCodeCanvas value={link} size={1024} marginSize={2} fgColor="#0A1748" style={{ width: 'min(70vh, 80vw)', height: 'min(70vh, 80vw)' }} />
          <p className="mt-6 text-lg text-[#5B6478]">Scan with your phone camera, then tap Check in.</p>
        </div>
      )}
    </div>
  );
};

// --- Discussion ----------------------------------------------------------------------------------------------
const Discussion = ({ a }) => {
  const { showToast } = useToast();
  const url = `/campus/activities/${a.id}/comments/`;
  const { data, error, loading, reload } = useLoad(url);
  const [body, setBody] = useState('');
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    try { await api.post(url, { body }); setBody(''); reload(); } catch (err) { showToast(errorText(err), 'error'); }
  };
  const hide = async (c) => {
    try { await api.post(`/campus/activities/${a.id}/comments/${c.id}/hide/`, { hidden: !c.is_hidden }); reload(); } catch (err) { showToast(errorText(err), 'error'); }
  };
  return (
    <Card className="space-y-3">
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && data.length === 0 && <p className="text-sm text-[#5B6478]">No comments yet. Ask a question or share something about the activity.</p>}
      {(data || []).map((c) => (
        <div key={c.id} className={`flex gap-2 ${c.is_hidden ? 'opacity-60' : ''}`}>
          <div className="flex-1"><p className="text-sm"><span className="font-semibold">{c.author?.name}</span> <span className="text-xs text-[#5B6478]">{formatDate(c.created_at)}</span>{c.is_hidden && <span className="text-xs text-[#5B6478]"> (hidden)</span>}</p><p className="whitespace-pre-line">{c.body}</p></div>
          {a.me?.can_manage && <button type="button" onClick={() => hide(c)} className="text-[#5B6478] hover:text-[#0A1748]" aria-label={c.is_hidden ? 'Show comment' : 'Hide comment'}><EyeOff size={15} /></button>}
        </div>
      ))}
      <form onSubmit={send} className="flex gap-2 pt-2 border-t border-[rgba(10,23,72,0.08)]">
        <input className="input" placeholder="Write a comment" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Comment" />
        <button className="btn-secondary btn-sm" type="submit">Send</button>
      </form>
    </Card>
  );
};

// --- Report --------------------------------------------------------------------------------------------------
const Report = ({ a, onChanged }) => {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useLoad(`/campus/activities/${a.id}/report/`);
  const report = data?.report;
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const ended = new Date(a.ends_at) < new Date();
  const editing = form ?? { summary: report?.summary || '', budget_used: report?.budget_used || '', merit_elements: report?.merit_elements || a.merit_elements };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = new FormData();
    body.append('summary', editing.summary);
    if (editing.budget_used !== '' && editing.budget_used !== null) body.append('budget_used', editing.budget_used);
    body.append('merit_elements', JSON.stringify(editing.merit_elements));
    files.forEach((f) => body.append('files', f));
    try {
      await api.put(`/campus/activities/${a.id}/report/`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(null); setFiles([]); await reload(); onChanged();
      showToast('Report sent to your advisor.', 'success');
    } catch (err) { showToast(errorText(err), 'error'); } finally { setBusy(false); }
  };
  const review = async (accept) => {
    setBusy(true);
    try {
      await api.post(`/campus/activities/${a.id}/report/review/`, { accept, remarks });
      setRemarks(''); await reload(); onChanged();
      showToast(accept ? 'Report accepted. The activity is complete.' : 'Changes requested.', 'success');
    } catch (err) { showToast(errorText(err), 'error'); } finally { setBusy(false); }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  const canWrite = a.me?.can_manage && a.status === 'PUBLISHED' && ended && report?.status !== 'ACCEPTED';

  return (
    <div className="space-y-4">
      {report && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading font-bold text-xl">Activity report</h2>
            <StatusPill status={report.status === 'ACCEPTED' ? 'APPROVED' : report.status === 'CHANGES' ? 'REJECTED' : 'PENDING'} label={report.status_label} />
          </div>
          <p className="whitespace-pre-line">{report.summary}</p>
          <p className="text-sm text-[#5B6478]">{report.budget_used ? `Spent ${rm(report.budget_used)} of ${rm(a.total_budget)} · ` : ''}By {report.submitted_by?.name}, {formatDate(report.submitted_at)}</p>
          {report.files.length > 0 && (
            <div className="flex flex-wrap gap-2">{report.files.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">{f.name}</a>)}</div>
          )}
          {report.advisor_remarks && <p className="text-sm rounded-lg bg-[#F5F7FC] p-3"><span className="font-semibold">Advisor:</span> {report.advisor_remarks}</p>}
          {a.me?.can_review_report && report.status === 'SUBMITTED' && (
            <div className="rounded-lg bg-[#F5F7FC] p-4 space-y-2">
              <label className="field-label" htmlFor="remarks">Remarks</label>
              <textarea id="remarks" className="input min-h-[72px]" placeholder="Required if you ask for changes" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => review(true)}>Accept report</button>
                <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => review(false)}>Ask for changes</button>
              </div>
            </div>
          )}
        </Card>
      )}
      {!report && !canWrite && (
        <Card><Empty title={ended ? 'No report yet' : 'The report comes after the activity'}>
          {ended ? `The committee writes it. Due ${formatDate(data.due_on)}.` : `The committee writes it once the activity ends. Due ${formatDate(data.due_on)}.`}
        </Empty></Card>
      )}
      {canWrite && (
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <h2 className="font-heading font-bold text-xl">{report ? 'Update the report' : 'Write the report'}</h2>
            {!report && <p className="text-sm text-[#5B6478]">Due {formatDate(data.due_on)}. Your advisor reviews it.</p>}
            <Field label="Summary" hint="What happened, how many took part, what went well, what to improve." htmlFor="summary">
              <textarea id="summary" className="input min-h-[130px]" required value={editing.summary} onChange={(e) => setForm({ ...editing, summary: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Budget used (RM)" htmlFor="budget_used"><input id="budget_used" type="number" min="0" step="0.01" className="input" value={editing.budget_used} onChange={(e) => setForm({ ...editing, budget_used: e.target.value })} /></Field>
              <Field label="Photos and documents" hint="Up to 10 files: images or PDF." htmlFor="files"><input id="files" type="file" multiple accept="image/*,.pdf" className="text-sm" onChange={(e) => setFiles([...e.target.files])} /></Field>
            </div>
            <Field label="S.P.I.C.E.S elements">
              <ChoiceChips label="S.P.I.C.E.S elements" options={MERIT_ELEMENTS} value={editing.merit_elements} onChange={(v) => setForm({ ...editing, merit_elements: v })} />
            </Field>
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send to advisor'}</button>
          </form>
        </Card>
      )}
    </div>
  );
};

// --- Page ----------------------------------------------------------------------------------------------------
const CampusActivity = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const { data: a, error, loading, reload } = useLoad(`/campus/activities/${id}/`);
  usePageTitle(a?.title || 'Activity');
  const [busy, setBusy] = useState(false);

  const live = a && ['PUBLISHED', 'COMPLETED'].includes(a.status);
  const tabs = [['details', 'Details']];
  if (a?.me?.can_manage && live) tabs.push(['checkin', 'Check-in']);
  if (a?.me?.can_discuss && live) tabs.push(['discussion', 'Discussion']);
  if (live && (a?.me?.can_manage || a?.me?.can_review_report)) tabs.push(['report', 'Report']);
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'details';

  const act = async (path, ok, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try { await api.post(`/campus/activities/${id}/${path}/`); await reload(); showToast(ok, 'success'); } catch (err) { showToast(errorText(err), 'error'); } finally { setBusy(false); }
  };

  const actions = a && (
    <>
      {a.me?.can_manage && a.status === 'APPROVED' && <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => act('publish', 'Published. Members can see it now.')}>Publish</button>}
      {a.me?.can_manage && ['APPROVED', 'PUBLISHED'].includes(a.status) && (
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => act('cancel', 'Activity cancelled.', 'Cancel this activity? Members will no longer be able to check in.')}>Cancel activity</button>
      )}
      {a.me?.can_manage && <button type="button" className="btn-secondary btn-sm" onClick={() => openPdf(a.id, showToast)}><Download size={15} aria-hidden="true" /> SAF form (PDF)</button>}
    </>
  );

  return (
    <CampusPage
      eyebrow={a ? a.club_detail.name : 'Activity'}
      title={a?.title || 'Activity'}
      intro={a && <span className="inline-flex flex-wrap items-center gap-2"><StatusPill status={a.status} label={a.status_label} />{a.approval_number && <span>Approval no. {a.approval_number}</span>}{a.approval_id && ['PENDING', 'REJECTED', 'WITHDRAWN'].includes(a.status) && <Link to={`/campus/approvals?${a.me?.can_manage ? 'mine=1&' : ''}open=${a.approval_id}`} className="text-[#00729F] font-semibold">See the approval trail</Link>}</span>}
      back={a ? { to: `/campus/clubs/${a.club_detail.id}?tab=activities`, label: a.club_detail.name } : { to: '/campus', label: 'Campus' }}
      actions={actions}
    >
      {loading && !a && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {a && (
        <>
          {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={(k) => setParams(k === 'details' ? {} : { tab: k })} label="Activity sections" />}
          {tab === 'details' && <Details a={a} />}
          {tab === 'checkin' && <CheckIn a={a} onChanged={reload} />}
          {tab === 'discussion' && <Discussion a={a} />}
          {tab === 'report' && <Report a={a} onChanged={reload} />}
        </>
      )}
    </CampusPage>
  );
};

export default CampusActivity;
