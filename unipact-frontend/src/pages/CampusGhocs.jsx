import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, Download, Info, PlusCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import Modal from '../components/Modal';
import SkillsWeb from '../components/campus/SkillsWeb';
import {
  ACTIVITY_LEVELS, Card, CampusPage, ChoiceChips, DNA_CATEGORIES, Empty, ErrorNote, Field, Loading, MERIT_ELEMENTS,
  StatusPill, Tabs, formatDate, labelOf, useLoad,
} from '../components/campus/CampusUI';

const pts = (n) => Number(n || 0).toLocaleString('en-MY', { maximumFractionDigits: 2 });
const errorText = (err) => {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    const [k, v] = Object.entries(d)[0] || [];
    if (k) return k === 'detail' ? String(v) : `${k.replaceAll('_', ' ')}: ${[].concat(v)[0]}`;
  }
  return getErrorMessage(err);
};

// --- Claim form ----------------------------------------------------------------------------------------------
const ClaimForm = ({ data, onDone }) => {
  const { showToast } = useToast();
  const events = useLoad('/campus/ghocs/claimable-events/');
  const [kind, setKind] = useState('EVENT');
  const [form, setForm] = useState({ news_post: '', role: 'PARTICIPANT', title: '', achievement: 'PARTICIPATE', activity_level: 'CAMPUS', rank: '', group_award: false, date: '', description: '', merit_elements: [], subject: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const event = (events.data || []).find((p) => String(p.id) === String(form.news_post));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!file) { setError('Attach your evidence (a certificate, result slip or photo).'); return; }
    const body = new FormData();
    body.append('kind', kind);
    body.append('evidence', file);
    const fields = kind === 'EVENT' ? ['news_post', 'role', 'description']
      : kind === 'EXCELLENCE' ? ['title', 'achievement', 'activity_level', 'rank', 'group_award', 'date', 'description']
        : ['subject', 'date', 'description'];
    fields.forEach((f) => { if (form[f] !== '' && form[f] !== null) body.append(f, form[f]); });
    if (kind === 'EXCELLENCE') body.append('merit_elements', JSON.stringify(form.merit_elements));
    setBusy(true);
    try {
      await api.post('/campus/ghocs/claims/', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Claim sent to the GHOCS secretary.', 'success');
      onDone();
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Tabs tabs={[['EVENT', 'Event from the news'], ['EXCELLENCE', 'Excellence'], ['SKILL', 'Skill Development']]} value={kind} onChange={setKind} label="Claim type" />
      <p className="text-sm text-[#5B6478] flex gap-2"><Info size={16} className="shrink-0 mt-0.5 text-[#00AEEF]" aria-hidden="true" />
        {kind === 'EVENT' ? 'Club activities you checked in to count automatically. Claim here only for GHOCS-claimable events posted in the news.'
          : kind === 'EXCELLENCE' ? 'Awards, competitions you took part in, and international or exchange programmes.'
            : 'Language and general subjects from Student Development that you passed.'}
      </p>
      {kind === 'EVENT' && (
        <>
          <Field label="Event" htmlFor="claim-event">
            <select id="claim-event" className="input" required value={form.news_post} onChange={set('news_post')}>
              <option value="">Choose…</option>
              {(events.data || []).map((p) => <option key={p.id} value={p.id}>{p.title}{p.starts_on ? ` (${formatDate(p.starts_on)})` : ''}</option>)}
            </select>
          </Field>
          {events.data && events.data.length === 0 && <p className="text-sm text-[#5B6478]">No GHOCS-claimable events to claim right now.</p>}
          {event && (
            <p className="text-sm rounded-lg bg-[#F5F7FC] p-3">
              Set by the event: <span className="font-semibold">{labelOf(DNA_CATEGORIES, event.dna_category)}</span>, {labelOf(ACTIVITY_LEVELS, event.activity_level).toLowerCase()} level, {event.merit_elements.map((m) => labelOf(MERIT_ELEMENTS, m)).join(', ')}. You don't need to choose these.
            </p>
          )}
          <Field label="Your role" htmlFor="claim-role">
            <select id="claim-role" className="input" value={form.role} onChange={set('role')}>
              <option value="PARTICIPANT">Participant</option><option value="COMMITTEE">Committee / AJK</option><option value="ORGANISER">Program director / organiser</option>
            </select>
          </Field>
        </>
      )}
      {kind === 'EXCELLENCE' && (
        <>
          <Field label="Title of the programme or award" htmlFor="claim-title"><input id="claim-title" className="input" required value={form.title} onChange={set('title')} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Achievement" htmlFor="claim-achievement">
              <select id="claim-achievement" className="input" value={form.achievement} onChange={set('achievement')}>
                {data.achievements.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Level" htmlFor="claim-level">
              <select id="claim-level" className="input" value={form.activity_level} onChange={set('activity_level')}>
                {ACTIVITY_LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Rank (optional)" htmlFor="claim-rank"><input id="claim-rank" className="input" placeholder="e.g. 1st place, Finalist" value={form.rank} onChange={set('rank')} /></Field>
            <Field label="Date" htmlFor="claim-date"><input id="claim-date" type="date" className="input" required value={form.date} onChange={set('date')} /></Field>
          </div>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.group_award} onChange={set('group_award')} /> Group award</label>
          <Field label="S.P.I.C.E.S elements"><ChoiceChips label="S.P.I.C.E.S elements" options={MERIT_ELEMENTS} value={form.merit_elements} onChange={(v) => setForm({ ...form, merit_elements: v })} /></Field>
        </>
      )}
      {kind === 'SKILL' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Subject" htmlFor="claim-subject">
            <select id="claim-subject" className="input" required value={form.subject} onChange={set('subject')}>
              <option value="">Choose…</option>
              {data.skill_subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Date passed" htmlFor="claim-date2"><input id="claim-date2" type="date" className="input" required value={form.date} onChange={set('date')} /></Field>
        </div>
      )}
      <Field label="Description (optional)" hint="Group or individual, the placement you got, anything that helps the secretary." htmlFor="claim-desc">
        <textarea id="claim-desc" className="input min-h-[72px]" value={form.description} onChange={set('description')} />
      </Field>
      <Field label="Evidence" hint="Certificate, result slip or photo: PDF or image." htmlFor="claim-evidence">
        <input id="claim-evidence" type="file" accept=".pdf,image/*" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send claim'}</button>
    </form>
  );
};

// --- Page ----------------------------------------------------------------------------------------------------
const Stat = ({ label, value, note }) => (
  <div className="card p-4 bg-white border border-[rgba(10,23,72,0.1)]">
    <p className="text-sm text-[#5B6478]">{label}</p>
    <p className="font-heading font-extrabold text-3xl mt-1">{pts(value)}</p>
    {note && <p className="text-xs text-[#5B6478] mt-0.5">{note}</p>}
  </div>
);

// My GHOCS (UniKLSKILL F026–F030, with a transparent web): points by component, the transferable skills web
// with how to grow it, history and claims, and a printable pilot transcript.
const CampusGhocs = () => {
  const { id } = useParams();  // set when staff open a student's record from a claim
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data, error, loading, reload } = useLoad(id ? `/campus/ghocs/students/${id}/` : '/campus/ghocs/me/');
  const mine = !id;
  usePageTitle(mine ? 'My GHOCS' : 'Student GHOCS');
  const [claiming, setClaiming] = useState(false);

  const transcript = async () => {
    try {
      const res = await api.get('/campus/ghocs/transcript.pdf', { responseType: 'blob' });
      window.open(URL.createObjectURL(res.data), '_blank', 'noopener');
    } catch (err) { showToast(errorText(err), 'error'); }
  };

  const c = data?.components;
  return (
    <CampusPage
      title={mine ? 'My GHOCS' : `GHOCS: ${data?.student?.name || 'student'}`}
      intro={mine ? 'Your co-curricular points and UniKL DNA transferable skills. Club activities you check in to are added when the advisor accepts the activity report; claim everything else.'
        : 'Read-only view of this student\'s GHOCS record, to check a claim against what they already have.'}
      back={mine ? { to: '/campus', label: 'Campus' } : { to: '/campus/approvals', label: 'Approvals' }}
      actions={data && mine && (
        <>
          {user?.role === 'STUDENT' && <button type="button" className="btn-primary btn-sm" onClick={() => setClaiming(true)}><PlusCircle size={15} aria-hidden="true" /> Claim points</button>}
          <button type="button" className="btn-secondary btn-sm" onClick={transcript}><Download size={15} aria-hidden="true" /> Transcript (PDF)</button>
        </>
      )}
    >
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && (
        <>
          {!data.official && (
            <p className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-900 p-3">
              <span className="font-semibold">{data.points_label}.</span> These follow UniKLSKILL's values until SDCL confirms the official GHOCS table, so they may change. Your activities and claims stay the same.
            </p>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Total GHOCS points" value={data.total} note={`${data.activity_count} activit${data.activity_count === 1 ? 'y' : 'ies'}`} />
            <Stat label="UniKL DNA" value={c.dna} />
            <Stat label="Excellence" value={c.excellence} />
            <Stat label="Skill Development" value={c.skill_development} />
            <Stat label="Management Skills" value={c.management} />
          </div>

          <Card>
            <h2 className="font-heading font-bold text-xl">UniKL DNA transferable skills</h2>
            <p className="text-sm text-[#5B6478]">Every activity counts towards the skills its UniKL DNA category builds. Each skill is shown against the campus target of {pts(data.sc_target)} points.</p>
            <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-center mt-4">
              <SkillsWeb web={data.web} target={data.sc_target} />
              <div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[#5B6478] border-b border-[rgba(10,23,72,0.12)]"><th className="py-2 font-semibold">Skill</th><th className="font-semibold text-right">Points</th><th className="font-semibold text-right">Of target</th></tr></thead>
                  <tbody>
                    {data.web.map((row) => (
                      <tr key={row.code} className="border-b border-[rgba(10,23,72,0.06)]">
                        <td className="py-2"><span className="font-semibold">{row.code}</span> {row.name}<span className="block text-xs text-[#5B6478]">From {row.feeds.join(', ')}</span></td>
                        <td className="text-right align-top py-2">{pts(row.points)}</td>
                        <td className="text-right align-top py-2">{Math.round(row.percent)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.hint && (
                  <p className="text-sm mt-4 rounded-lg bg-[#00AEEF]/10 p-3">
                    <span className="font-semibold">To grow your web:</span> {data.hint.code} ({data.hint.name}) is your smallest skill. Activities in {data.hint.categories.join(', ')} build it.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <Card>
              <h2 className="font-heading font-bold text-lg">Activities and approved claims</h2>
              {data.entries.length === 0 && <Empty icon={Award} title="Nothing yet">Check in to club activities, or claim an event, award or subject.</Empty>}
              <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
                {data.entries.map((e) => (
                  <li key={e.id} className="py-2.5 flex justify-between gap-3">
                    <div className="min-w-0"><p className="font-semibold truncate">{e.title}</p><p className="text-xs text-[#5B6478]">{e.component_label}{e.dna_category ? ` · ${labelOf(DNA_CATEGORIES, e.dna_category)}` : ''} · {formatDate(e.date)}</p></div>
                    <span className="font-semibold shrink-0">+{pts(e.points)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="space-y-6">
              <Card>
                <h2 className="font-heading font-bold text-lg">Management Skills</h2>
                {data.management_terms.length === 0 && <p className="text-sm text-[#5B6478] mt-1">Club membership and committee roles count here, once per club per semester.</p>}
                <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
                  {data.management_terms.map((t) => (
                    <li key={`${t.unit_id}-${t.term}`} className="py-2.5 flex justify-between gap-3">
                      <div><p className="font-semibold">{t.unit}</p><p className="text-xs text-[#5B6478]">{t.role} · {t.term}</p></div>
                      <span className="font-semibold shrink-0">+{pts(t.points)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              {data.claims?.length > 0 && (
                <Card>
                  <h2 className="font-heading font-bold text-lg">My claims</h2>
                  <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
                    {data.claims.map((cl) => (
                      <li key={cl.id} className="py-2.5 flex justify-between gap-3 items-center">
                        <div className="min-w-0"><p className="font-semibold truncate">{cl.title}</p><p className="text-xs text-[#5B6478]">{cl.kind_label} · sent {formatDate(cl.created_at)}</p></div>
                        <StatusPill status={cl.status} label={cl.status === 'APPROVED' ? `+${pts(cl.points)}` : cl.status_label} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
      <Modal isOpen={claiming} onClose={() => setClaiming(false)} title="Claim GHOCS points" subtitle="The GHOCS secretary checks your evidence." maxWidth="max-w-2xl">
        {data && <ClaimForm data={data} onDone={() => { setClaiming(false); reload(); }} />}
      </Modal>
    </CampusPage>
  );
};

export default CampusGhocs;
