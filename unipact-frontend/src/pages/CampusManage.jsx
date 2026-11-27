import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight, Mail, Plus, Send } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  Card, CampusPage, Empty, ErrorNote, Field, Loading, POSITIONS, SECTOR_LABEL, Tabs, formatDate, useLoad,
} from '../components/campus/CampusUI';

const errorText = (err) => {
  const data = err?.response?.data;
  if (data && typeof data === 'object' && !data.detail) {
    const [key, value] = Object.entries(data)[0] || [];
    if (key) return `${key.replaceAll('_', ' ')}: ${[].concat(value)[0]}`;
  }
  return getErrorMessage(err);
};

// --- Structure: the tree, with roles at the selected unit ---------------------------------------------------
const UnitRoles = ({ unit, roles }) => {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useLoad('/campus/assignments/', { unit: unit.id });
  const choices = roles.filter((r) => r.unit_kinds.includes(unit.kind));
  const [form, setForm] = useState({ email: '', role: '', position: '', session: '' });
  const [busy, setBusy] = useState(false);
  const role = form.role || choices[0]?.value || '';

  const appoint = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/campus/assignments/', { ...form, role, unit: unit.id, position: role === 'COMMITTEE' ? form.position || POSITIONS[0] : form.position });
      setForm({ email: '', role, position: '', session: form.session });
      reload();
      showToast('Appointed. They have been emailed.', 'success');
    } catch (err) { showToast(errorText(err), 'error'); } finally { setBusy(false); }
  };
  const end = async (a) => {
    const reason = window.prompt(`End ${a.person.name}'s role as ${a.role_label}? Reason (optional):`);
    if (reason === null) return;
    try { await api.post(`/campus/assignments/${a.id}/end/`, { reason }); reload(); showToast('Role ended.', 'success'); } catch (err) { showToast(errorText(err), 'error'); }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow mb-1"><span className="eyebrow-dot" /> {unit.kind_label}</p>
        <h2 className="font-heading font-bold text-xl">{unit.name}</h2>
        {unit.kind === 'CLUB' && <Link to={`/campus/clubs/${unit.id}`} className="text-sm text-[#00729F] font-semibold">Open club page</Link>}
      </div>
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && data.length === 0 && <p className="text-sm text-[#5B6478]">Nobody holds a role here yet.</p>}
      <ul className="divide-y divide-[rgba(10,23,72,0.08)]">
        {(data || []).map((a) => (
          <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{a.person.name} <span className="text-sm font-normal text-[#5B6478]">{a.person.email}</span></p>
              <p className="text-sm text-[#5B6478]">{a.position ? `${a.position} · ` : ''}{a.role_label}{a.session ? ` · ${a.session}` : ''}</p>
            </div>
            <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => end(a)}>End</button>
          </li>
        ))}
      </ul>
      {choices.length > 0 && (
        <form onSubmit={appoint} className="rounded-lg bg-[#F5F7FC] p-4 space-y-3">
          <h3 className="font-semibold">Appoint someone</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Email" hint="Staff must be invited first (Staff tab). Students sign up themselves." htmlFor="appoint-email">
              <input id="appoint-email" className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Role" htmlFor="appoint-role">
              <select id="appoint-role" className="input" value={role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {choices.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            {(role === 'COMMITTEE' || role === 'SRC_EXCO') && (
              <Field label={role === 'SRC_EXCO' ? 'Portfolio' : 'Position'} htmlFor="appoint-position">
                {role === 'COMMITTEE' ? (
                  <select id="appoint-position" className="input" value={form.position || POSITIONS[0]} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                    {POSITIONS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                ) : (
                  <input id="appoint-position" className="input" placeholder="e.g. Academic & Spiritual" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                )}
              </Field>
            )}
            <Field label="Session (optional)" htmlFor="appoint-session">
              <input id="appoint-session" className="input" placeholder="e.g. 2026/2027 Sem 1" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} />
            </Field>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>Appoint</button>
        </form>
      )}
    </div>
  );
};

const Structure = ({ units, reloadUnits, roles }) => {
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const selected = units.find((u) => String(u.id) === params.get('unit'));
  const [newClub, setNewClub] = useState({ parent: '', name: '' });
  const children = useMemo(() => {
    const map = {};
    units.forEach((u) => { (map[u.parent || 'root'] = map[u.parent || 'root'] || []).push(u); });
    return map;
  }, [units]);
  const ids = new Set(units.map((u) => u.id));
  const roots = units.filter((u) => !u.parent || !ids.has(u.parent));
  const sections = units.filter((u) => u.kind === 'SECTION');

  const addClub = async (e) => {
    e.preventDefault();
    try {
      await api.post('/campus/units/', { parent: newClub.parent || sections[0]?.id, kind: 'CLUB', name: newClub.name });
      setNewClub({ parent: newClub.parent, name: '' });
      reloadUnits();
      showToast('Club added.', 'success');
    } catch (err) { showToast(errorText(err), 'error'); }
  };

  const Node = ({ unit, depth }) => (
    <li>
      <button type="button" onClick={() => setParams({ tab: 'structure', unit: String(unit.id) })}
        className={`w-full text-left flex items-center gap-1.5 py-1.5 pr-2 rounded hover:bg-[#F5F7FC] ${selected?.id === unit.id ? 'bg-[#00AEEF]/10 font-semibold' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}>
        <ChevronRight size={14} className="text-[#5B6478] shrink-0" aria-hidden="true" />
        <span className="truncate">{unit.name}</span>
        <span className="text-xs text-[#5B6478] shrink-0">{unit.kind === 'CLUB' ? SECTOR_LABEL[unit.sector] ? unit.sector : '' : unit.kind_label.split(' ')[0]}</span>
      </button>
      {children[unit.id] && <ul>{children[unit.id].map((c) => <Node key={c.id} unit={c} depth={depth + 1} />)}</ul>}
    </li>
  );

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
      <Card className="space-y-4">
        <ul className="text-sm" aria-label="Campus structure">{roots.map((u) => <Node key={u.id} unit={u} depth={0} />)}</ul>
        {sections.length > 0 && (
          <form onSubmit={addClub} className="border-t border-[rgba(10,23,72,0.08)] pt-4 space-y-2">
            <h3 className="font-semibold">Add a club</h3>
            <select className="input" value={newClub.parent || sections[0].id} onChange={(e) => setNewClub({ ...newClub, parent: e.target.value })} aria-label="Section">
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="input" placeholder="Club name" required value={newClub.name} onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} aria-label="Club name" />
              <button type="submit" className="btn-primary btn-sm"><Plus size={15} aria-hidden="true" /> Add</button>
            </div>
          </form>
        )}
      </Card>
      <Card>
        {selected ? <UnitRoles key={selected.id} unit={selected} roles={roles} /> : <Empty icon={Building2} title="Choose a unit to see and give roles" />}
      </Card>
    </div>
  );
};

// --- Staff ---------------------------------------------------------------------------------------------------
const Staff = ({ units }) => {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useLoad('/campus/staff/');
  const homeUnits = units.filter((u) => ['CAMPUS', 'OFFICE', 'SECTION'].includes(u.kind));
  const [form, setForm] = useState({ email: '', full_name: '', title: '', staff_id: '', home_unit: '' });
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/campus/staff/', { ...form, home_unit: form.home_unit || homeUnits[0]?.id });
      setForm({ email: '', full_name: '', title: '', staff_id: '', home_unit: form.home_unit });
      reload();
      showToast('Invitation sent.', 'success');
    } catch (err) { showToast(errorText(err), 'error'); } finally { setBusy(false); }
  };
  const resend = async (s) => {
    try { await api.post(`/campus/staff/${s.id}/resend/`); showToast(`Sent again to ${s.email}.`, 'success'); } catch (err) { showToast(errorText(err), 'error'); }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <Card>
        <h2 className="font-heading font-bold text-xl">Staff</h2>
        {loading && !data && <Loading />}
        <ErrorNote>{error}</ErrorNote>
        {data && data.length === 0 && <p className="text-sm text-[#5B6478] mt-1">No staff invited yet.</p>}
        <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
          {(data || []).map((s) => (
            <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{s.full_name} <span className="text-sm font-normal text-[#5B6478]">{s.email}</span></p>
                <p className="text-sm text-[#5B6478]">{[s.title, s.home_unit_detail?.name].filter(Boolean).join(' · ')}</p>
              </div>
              {s.account_ready
                ? <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">Signed up</span>
                : <button type="button" className="btn-secondary btn-sm" onClick={() => resend(s)}><Mail size={15} aria-hidden="true" /> Resend invitation</button>}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <form onSubmit={invite} className="space-y-3">
          <h2 className="font-heading font-bold text-xl">Invite staff</h2>
          <p className="text-sm text-[#5B6478]">They get an email to set their password. Give them roles in the Structure tab after.</p>
          <Field label="Full name" htmlFor="staff-name"><input id="staff-name" className="input" required value={form.full_name} onChange={set('full_name')} /></Field>
          <Field label="Work email" htmlFor="staff-email"><input id="staff-email" className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Job title" htmlFor="staff-title"><input id="staff-title" className="input" placeholder="e.g. Lecturer" value={form.title} onChange={set('title')} /></Field>
          <Field label="Staff ID (optional)" htmlFor="staff-id"><input id="staff-id" className="input" value={form.staff_id} onChange={set('staff_id')} /></Field>
          <Field label="Works in" htmlFor="staff-unit">
            <select id="staff-unit" className="input" value={form.home_unit || homeUnits[0]?.id || ''} onChange={set('home_unit')}>
              {homeUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <button type="submit" className="btn-primary" disabled={busy}><Send size={15} aria-hidden="true" /> Send invitation</button>
        </form>
      </Card>
    </div>
  );
};

// --- Semesters -----------------------------------------------------------------------------------------------
const Semesters = ({ units }) => {
  const { showToast } = useToast();
  const campuses = units.filter((u) => u.kind === 'CAMPUS');
  const [campus, setCampus] = useState(campuses[0]?.id || '');
  const { data, error, loading, reload } = useLoad(campus ? '/campus/sessions/' : null, { campus });
  const [form, setForm] = useState({ label: '', starts_on: '', ends_on: '' });

  const add = async (e) => {
    e.preventDefault();
    try { await api.post('/campus/sessions/', { ...form, campus }); setForm({ label: '', starts_on: '', ends_on: '' }); reload(); showToast('Semester added.', 'success'); } catch (err) { showToast(errorText(err), 'error'); }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl">Semesters</h2>
          <p className="text-sm text-[#5B6478]">Club memberships last one semester, as in GHOCS. New members get the current semester.</p>
        </div>
        {campuses.length > 1 && (
          <select className="input w-auto" value={campus} onChange={(e) => setCampus(e.target.value)} aria-label="Campus">
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      <ul className="divide-y divide-[rgba(10,23,72,0.08)]">
        {(data || []).map((s) => (
          <li key={s.id} className="py-2 flex justify-between gap-3"><span className="font-semibold">{s.label}</span><span className="text-sm text-[#5B6478]">{formatDate(s.starts_on)} to {formatDate(s.ends_on)}</span></li>
        ))}
      </ul>
      {campus && (
        <form onSubmit={add} className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          <Field label="Label" htmlFor="sem-label"><input id="sem-label" className="input" required placeholder="2026/2027 Sem 1" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Starts" htmlFor="sem-start"><input id="sem-start" type="date" className="input" required value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></Field>
          <Field label="Ends" htmlFor="sem-end"><input id="sem-end" type="date" className="input" required value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></Field>
          <button type="submit" className="btn-primary btn-sm h-[42px]">Add</button>
        </form>
      )}
    </Card>
  );
};

// Campus management for SDCL (and UniPact admins): structure and roles, staff invitations, semesters.
const CampusManage = () => {
  usePageTitle('Manage campus');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'structure';
  const units = useLoad('/campus/units/');
  const roles = useLoad('/campus/roles/');

  return (
    <CampusPage title="Manage campus" intro="Set up your campus: clubs and who leads them, staff accounts, and semesters." back={{ to: '/campus', label: 'Campus' }}>
      <Tabs tabs={[['structure', 'Structure and roles'], ['staff', 'Staff'], ['semesters', 'Semesters']]} value={tab} onChange={(k) => setParams({ tab: k })} label="Manage campus" />
      {(units.loading || roles.loading) && <Loading />}
      <ErrorNote>{units.error || roles.error}</ErrorNote>
      {units.data && roles.data && (
        <>
          {units.data.length === 0 && <Card><Empty icon={Building2} title="You don't manage any part of a campus" /></Card>}
          {units.data.length > 0 && tab === 'structure' && <Structure units={units.data} reloadUnits={units.reload} roles={roles.data} />}
          {units.data.length > 0 && tab === 'staff' && <Staff units={units.data} />}
          {units.data.length > 0 && tab === 'semesters' && <Semesters units={units.data} />}
        </>
      )}
    </CampusPage>
  );
};

export default CampusManage;
