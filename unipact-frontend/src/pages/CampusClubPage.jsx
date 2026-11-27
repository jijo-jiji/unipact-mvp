import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, EyeOff, Megaphone, MessageSquare, Pin, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  StatusPill, CLUB_TYPES, Card, CampusPage, ChoiceChips, DNA_CATEGORIES, Empty, ErrorNote, Field, Loading, MERIT_ELEMENTS,
  POSITIONS, SECTOR_LABEL, Tabs, formatDate, labelOf, useLoad,
} from '../components/campus/CampusUI';

const RoleEditor = ({ initialRole = 'MEMBER', initialPosition = '', onSave, saving, submitLabel = 'Save' }) => {
  const [role, setRole] = useState(initialRole);
  const [position, setPosition] = useState(initialPosition || POSITIONS[0]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
        <option value="MEMBER">Member</option>
        <option value="COMMITTEE">Committee</option>
      </select>
      {role === 'COMMITTEE' && (
        <select className="input w-auto" value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Position">
          {POSITIONS.map((p) => <option key={p}>{p}</option>)}
        </select>
      )}
      <button type="button" className="btn-primary btn-sm" disabled={saving} onClick={() => onSave(role, role === 'COMMITTEE' ? position : '')}>
        {submitLabel}
      </button>
    </div>
  );
};

// --- About ---------------------------------------------------------------------------------------------------
const About = ({ club }) => (
  <div className="grid lg:grid-cols-[1fr_320px] gap-6">
    <Card className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-xl">About</h2>
        <p className="text-[#5B6478] mt-1 whitespace-pre-line">{club.description || 'The committee has not written a description yet.'}</p>
      </div>
      {club.objectives?.length > 0 && (
        <div>
          <h3 className="font-semibold">Objectives</h3>
          <ol className="list-decimal pl-5 text-[#5B6478] mt-1 space-y-0.5">{club.objectives.map((o) => <li key={o}>{o}</li>)}</ol>
        </div>
      )}
      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        {club.dna_category_label && <div><dt className="text-[#5B6478]">UniKL DNA category</dt><dd className="font-semibold">{club.dna_category_label}</dd></div>}
        {club.merit_elements?.length > 0 && (
          <div><dt className="text-[#5B6478]">S.P.I.C.E.S elements</dt><dd className="font-semibold">{club.merit_elements.map((m) => labelOf(MERIT_ELEMENTS, m)).join(', ')}</dd></div>
        )}
        {club.location && <div><dt className="text-[#5B6478]">Where</dt><dd className="font-semibold">{club.location}</dd></div>}
        {club.joining_criteria && <div><dt className="text-[#5B6478]">Who can join</dt><dd className="font-semibold whitespace-pre-line">{club.joining_criteria}</dd></div>}
      </dl>
      {club.socials && Object.keys(club.socials).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(club.socials).map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">{name}</a>
          ))}
        </div>
      )}
    </Card>
    <Card className="space-y-4 h-fit">
      <div>
        <h3 className="font-semibold">Advisor{club.advisors.length === 1 ? '' : 's'}</h3>
        {club.advisors.length === 0 && <p className="text-sm text-[#5B6478]">Not assigned yet</p>}
        {club.advisors.map((a) => <p key={a.id} className="text-sm">{a.name} <span className="text-[#5B6478]">· {a.role_label}</span></p>)}
      </div>
      <div>
        <h3 className="font-semibold">Committee</h3>
        {club.committee.length === 0 && <p className="text-sm text-[#5B6478]">No committee yet</p>}
        {club.committee.map((c) => <p key={c.id} className="text-sm">{c.name} <span className="text-[#5B6478]">· {c.position}</span></p>)}
      </div>
    </Card>
  </div>
);

// --- Announcements -------------------------------------------------------------------------------------------
const Comments = ({ clubId, announcement, canManage }) => {
  const { showToast } = useToast();
  const url = `/campus/clubs/${clubId}/announcements/${announcement.id}/comments/`;
  const { data, reload } = useLoad(url);
  const [body, setBody] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    try { await api.post(url, { body }); setBody(''); reload(); } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };
  const toggle = async (c) => {
    try { await api.post(`/campus/clubs/${clubId}/comments/${c.id}/hide/`, { hidden: !c.is_hidden }); reload(); } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };

  return (
    <div className="mt-3 border-t border-[rgba(10,23,72,0.08)] pt-3 space-y-2">
      {(data || []).map((c) => (
        <div key={c.id} className={`text-sm flex gap-2 ${c.is_hidden ? 'opacity-60' : ''}`}>
          <p className="flex-1"><span className="font-semibold">{c.author?.name}</span> {c.body}
            {c.is_hidden && <span className="ml-1 text-xs text-[#5B6478]">(hidden)</span>}</p>
          {canManage && (
            <button type="button" className="text-[#5B6478] hover:text-[#0A1748]" onClick={() => toggle(c)} aria-label={c.is_hidden ? 'Show comment' : 'Hide comment'}>
              <EyeOff size={15} />
            </button>
          )}
        </div>
      ))}
      <form onSubmit={send} className="flex gap-2">
        <input className="input" placeholder="Write a comment" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Comment" />
        <button className="btn-secondary btn-sm" type="submit">Send</button>
      </form>
    </div>
  );
};

const Announcements = ({ club }) => {
  const { showToast } = useToast();
  const url = `/campus/clubs/${club.id}/announcements/`;
  const { data, error, loading, reload } = useLoad(url);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [open, setOpen] = useState(null);
  const canManage = club.me?.can_manage;

  const post = async (e) => {
    e.preventDefault();
    try { await api.post(url, form); setForm({ title: '', body: '', pinned: false }); reload(); showToast('Announcement posted.', 'success'); } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };
  const remove = async (a) => {
    try { await api.delete(`${url}${a.id}/`); reload(); } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <form onSubmit={post} className="space-y-3">
            <h2 className="font-heading font-bold text-lg">Post an announcement</h2>
            <input className="input" placeholder="Title" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Title" />
            <textarea className="input min-h-[96px]" placeholder="What do members need to know?" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} aria-label="Message" />
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin to the top</label>
              <button className="btn-primary btn-sm" type="submit"><Megaphone size={15} aria-hidden="true" /> Post</button>
            </div>
          </form>
        </Card>
      )}
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && data.length === 0 && <Card><Empty icon={Megaphone} title="No announcements yet" /></Card>}
      {(data || []).map((a) => (
        <Card key={a.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-lg flex items-center gap-2">{a.pinned && <Pin size={15} className="text-[#00AEEF]" aria-label="Pinned" />}{a.title}</h3>
              <p className="text-xs text-[#5B6478]">{a.author?.name} · {formatDate(a.created_at)}</p>
            </div>
            {canManage && (
              <button type="button" className="text-[#5B6478] hover:text-red-600" onClick={() => remove(a)} aria-label="Delete announcement"><Trash2 size={16} /></button>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line">{a.body}</p>
          <button type="button" className="mt-2 text-sm font-semibold text-[#00729F] inline-flex items-center gap-1" onClick={() => setOpen(open === a.id ? null : a.id)}>
            <MessageSquare size={15} aria-hidden="true" /> {a.comment_count} comment{a.comment_count === 1 ? '' : 's'}
          </button>
          {open === a.id && <Comments clubId={club.id} announcement={a} canManage={canManage} />}
        </Card>
      ))}
    </div>
  );
};

// --- Members -------------------------------------------------------------------------------------------------
const Members = ({ club, onChanged }) => {
  const { showToast } = useToast();
  const url = `/campus/clubs/${club.id}/members/`;
  const { data, error, loading, reload } = useLoad(url);
  const [editing, setEditing] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const canAssign = club.me?.can_assign;

  const refresh = () => { reload(); onChanged(); };
  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); refresh(); if (ok) showToast(ok, 'success'); setEditing(null); } catch (err) { showToast(getErrorMessage(err), 'error'); } finally { setBusy(false); }
  };

  const groups = [
    ['Advisors', (data || []).filter((m) => ['ADVISOR', 'CO_ADVISOR'].includes(m.role))],
    ['Committee', (data || []).filter((m) => m.role === 'COMMITTEE')],
    ['Members', (data || []).filter((m) => m.role === 'MEMBER')],
  ];

  return (
    <div className="space-y-4">
      {canAssign && (
        <Card>
          <h2 className="font-heading font-bold text-lg">Add someone</h2>
          <p className="text-sm text-[#5B6478]">They need a UniPact student account. They'll get an email.</p>
          <div className="mt-3 space-y-2">
            <input className="input" type="email" placeholder="Student's email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Student's email" />
            <RoleEditor saving={busy} submitLabel="Add" onSave={(role, position) => run(() => api.post(url, { email, role, position }).then(() => setEmail('')), 'Added to the club.')} />
          </div>
        </Card>
      )}
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && groups.map(([title, people]) => people.length > 0 && (
        <Card key={title}>
          <h2 className="font-heading font-bold text-lg">{title} <span className="text-[#5B6478] text-base font-normal">({people.length})</span></h2>
          <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
            {people.map((m) => (
              <li key={m.id} className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-semibold">{m.person.name}</p>
                  <p className="text-sm text-[#5B6478]">{m.position || m.role_label}{m.session ? ` · ${m.session}` : ''}</p>
                </div>
                {canAssign && ['MEMBER', 'COMMITTEE'].includes(m.role) && (
                  editing === m.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleEditor initialRole={m.role} initialPosition={m.position} saving={busy}
                        onSave={(role, position) => run(() => api.patch(`${url}${m.id}/`, { role, position }), 'Role updated.')} />
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(m.id)}>Change role</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setRemoving(m)}>Remove</button>
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <ConfirmationModal
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => run(() => api.delete(`${url}${removing.id}/`), 'Removed from the club.').then(() => setRemoving(null))}
        title="Remove from the club?"
        message={removing ? `${removing.person.name} will no longer be a member. Their past terms stay on their record.` : ''}
        confirmText="Remove"
        isDanger
      />
    </div>
  );
};

// --- Manage --------------------------------------------------------------------------------------------------
const Requests = ({ club, onChanged }) => {
  const { showToast } = useToast();
  const { data, error, loading, reload } = useLoad(`/campus/clubs/${club.id}/requests/`);
  const decide = async (r, approve) => {
    const reason = approve ? '' : window.prompt('Reason (optional, the student will see it):') ?? null;
    if (reason === null) return;
    try {
      await api.post(`/campus/clubs/${club.id}/requests/${r.id}/decide/`, { approve, reason });
      reload(); onChanged();
      showToast(approve ? `${r.person.name} is now a member.` : 'Request declined.', 'success');
    } catch (err) { showToast(getErrorMessage(err), 'error'); }
  };
  return (
    <Card>
      <h2 className="font-heading font-bold text-lg">Join requests</h2>
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && data.length === 0 && <p className="text-sm text-[#5B6478] mt-1">No requests waiting.</p>}
      <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
        {(data || []).map((r) => (
          <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-semibold">{r.person.name} <span className="text-sm font-normal text-[#5B6478]">{r.person.email}</span></p>
              {r.message && <p className="text-sm text-[#5B6478]">"{r.message}"</p>}
              <p className="text-xs text-[#5B6478]">Asked {formatDate(r.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary btn-sm" onClick={() => decide(r, true)}><Check size={15} aria-hidden="true" /> Approve</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => decide(r, false)}><X size={15} aria-hidden="true" /> Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const EditClub = ({ club, onSaved }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    club_type: club.club_type || '', description: club.description || '', objectives: (club.objectives || []).join('\n'),
    dna_category: club.dna_category || '', merit_elements: club.merit_elements || [], location: club.location || '',
    joining_criteria: club.joining_criteria || '', joining_open: club.joining_open,
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/campus/clubs/${club.id}/`, { ...form, objectives: form.objectives.split('\n').map((o) => o.trim()).filter(Boolean) });
      showToast('Club page saved.', 'success');
      onSaved();
    } catch (err) { showToast(getErrorMessage(err), 'error'); } finally { setSaving(false); }
  };

  return (
    <Card>
      <form onSubmit={save} className="space-y-4">
        <h2 className="font-heading font-bold text-lg">Club page</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Club type" htmlFor="club_type">
            <select id="club_type" className="input" value={form.club_type} onChange={set('club_type')}>
              <option value="">Choose…</option>
              {CLUB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="UniKL DNA category" htmlFor="dna">
            <select id="dna" className="input" value={form.dna_category} onChange={set('dna_category')}>
              <option value="">Choose…</option>
              {DNA_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description" htmlFor="description">
          <textarea id="description" className="input min-h-[96px]" value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Objectives" hint="One per line, up to 10." htmlFor="objectives">
          <textarea id="objectives" className="input min-h-[96px]" value={form.objectives} onChange={set('objectives')} />
        </Field>
        <Field label="S.P.I.C.E.S elements">
          <ChoiceChips label="S.P.I.C.E.S elements" options={MERIT_ELEMENTS} value={form.merit_elements} onChange={(v) => setForm({ ...form, merit_elements: v })} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Where you meet" htmlFor="location"><input id="location" className="input" value={form.location} onChange={set('location')} /></Field>
          <Field label="Who can join" htmlFor="criteria"><input id="criteria" className="input" value={form.joining_criteria} onChange={set('joining_criteria')} /></Field>
        </div>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.joining_open} onChange={set('joining_open')} /> Taking new members</label>
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </form>
    </Card>
  );
};

// --- Activities ----------------------------------------------------------------------------------------------
const Activities = ({ club }) => {
  const { data, error, loading } = useLoad(`/campus/clubs/${club.id}/activities/`);
  const now = new Date();
  const upcoming = (data || []).filter((a) => new Date(a.ends_at) >= now);
  const past = (data || []).filter((a) => new Date(a.ends_at) < now);
  const row = (a) => (
    <li key={a.id}>
      <Link to={`/campus/activities/${a.id}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 hover:bg-[#F5F7FC] -mx-2 px-2 rounded">
        <div className="min-w-0">
          <p className="font-semibold truncate">{a.title}</p>
          <p className="text-sm text-[#5B6478] flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{formatDate(a.starts_at)} · {a.venue}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {a.approval_number && <span className="text-xs text-[#5B6478]">No. {a.approval_number}</span>}
          <StatusPill status={a.status} label={a.status_label} />
        </div>
      </Link>
    </li>
  );
  return (
    <div className="space-y-4">
      {club.me?.can_manage && (
        <div className="flex justify-end">
          <Link to={`/campus/clubs/${club.id}/activities/new`} className="btn-primary btn-sm"><Plus size={15} aria-hidden="true" /> Propose an activity</Link>
        </div>
      )}
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && data.length === 0 && <Card><Empty icon={CalendarDays} title="No activities yet">{club.me?.can_manage ? 'Propose one: it goes through the campus approval chain.' : 'Check back soon.'}</Empty></Card>}
      {upcoming.length > 0 && <Card><h2 className="font-heading font-bold text-lg">Upcoming and in review</h2><ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-1">{upcoming.map(row)}</ul></Card>}
      {past.length > 0 && <Card><h2 className="font-heading font-bold text-lg">Past</h2><ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-1">{past.map(row)}</ul></Card>}
    </div>
  );
};

// --- Page ----------------------------------------------------------------------------------------------------
const CampusClubPage = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const { data: club, error, loading, reload } = useLoad(`/campus/clubs/${id}/`);
  const [message, setMessage] = useState('');
  const [joining, setJoining] = useState(false);
  usePageTitle(club?.name || 'Club');

  const me = club?.me;
  const tabs = [['about', 'About'], ['activities', 'Activities']];
  if (me?.can_view_internal) tabs.push(['announcements', 'Announcements']);
  tabs.push(['members', 'Members']);
  if (me?.can_manage) tabs.push(['manage', 'Manage']);
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'about';

  const act = async (fn, ok) => {
    setJoining(true);
    try { await fn(); await reload(); showToast(ok, 'success'); } catch (err) { showToast(getErrorMessage(err), 'error'); } finally { setJoining(false); }
  };

  const joinBox = me && (
    me.membership ? (
      <button type="button" className="btn-secondary btn-sm" disabled={joining}
        onClick={() => window.confirm('Leave this club? Your past membership stays on your record.') && act(() => api.post(`/campus/clubs/${id}/leave/`), 'You left the club.')}>
        Leave club
      </button>
    ) : me.pending_request ? (
      <button type="button" className="btn-secondary btn-sm" disabled={joining}
        onClick={() => act(() => api.delete(`/campus/clubs/${id}/join/`), 'Request cancelled.')}>
        Request sent · Cancel
      </button>
    ) : me.can_join && club.joining_open ? (
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input sm:w-64" placeholder="Message to the committee (optional)" value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message to the committee" />
        <button type="button" className="btn-primary btn-sm" disabled={joining}
          onClick={() => act(() => api.post(`/campus/clubs/${id}/join/`, { message }), 'Request sent. The committee will reply.')}>
          <UserPlus size={15} aria-hidden="true" /> Ask to join
        </button>
      </div>
    ) : null
  );

  return (
    <CampusPage
      eyebrow={club ? `${SECTOR_LABEL[club.sector] || club.section}${club.campus ? ` · ${club.campus.short_name || club.campus.name}` : ''}` : 'Club'}
      title={club?.name || 'Club'}
      intro={club && `${club.member_count} member${club.member_count === 1 ? '' : 's'}${me?.membership ? ` · You are ${me.membership.position || me.membership.role_label.toLowerCase()}` : ''}`}
      back={{ to: '/campus/clubs', label: 'All clubs' }}
      actions={joinBox}
    >
      {loading && !club && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {club && (
        <>
          <Tabs tabs={tabs} value={tab} onChange={(key) => setParams(key === 'about' ? {} : { tab: key })} label="Club sections" />
          {tab === 'about' && <About club={club} />}
          {tab === 'activities' && <Activities club={club} />}
          {tab === 'announcements' && <Announcements club={club} />}
          {tab === 'members' && <Members club={club} onChanged={reload} />}
          {tab === 'manage' && (
            <div className="space-y-4">
              <Requests club={club} onChanged={reload} />
              <EditClub club={club} onSaved={reload} />
            </div>
          )}
          {!me && <Card><Empty icon={Users} title="Sign in as a student to join this club" /></Card>}
        </>
      )}
    </CampusPage>
  );
};

export default CampusClubPage;
