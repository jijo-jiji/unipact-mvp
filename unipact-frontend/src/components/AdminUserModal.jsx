import React, { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, FileText, Loader2, MailCheck, MailWarning, Pencil, ShieldAlert, UserRound, XCircle } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import { useToast } from '../context/ToastContext';
import { DOMAIN_OPTIONS, MALAYSIAN_UNIVERSITIES } from '../utils/constants';
import { domainLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';

// What an admin may correct, per account type. Email, bank details and documents stay with the owner.
const EDITABLE = {
  STUDENT: ['full_name', 'university', 'major', 'domain_focus', 'skills', 'bio', 'club_affiliation_name', 'club_affiliation_role', 'secondary_email'],
  COMPANY: ['company_name', 'company_details'],
  CLUB: ['club_name', 'university'],
};

const formFrom = (detail) => Object.fromEntries(
  EDITABLE[detail.role].map((field) => {
    const value = detail.profile?.[field];
    return [field, field === 'skills' ? (value || []).join(', ') : value || ''];
  }),
);

const Section = ({ title, children }) => (
  <section className="pt-5 mt-5 border-t border-[rgba(10,23,72,0.08)] first:pt-0 first:mt-0 first:border-0">
    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#5B6478] mb-3">{title}</h3>
    {children}
  </section>
);

// One "label: value" row; an empty value reads as "Not provided" instead of leaving a gap
const Row = ({ label, children, wide = false }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-xs text-[#5B6478]">{label}</dt>
    <dd className="text-sm text-[#0A1748] break-words mt-0.5">
      {children || <span className="text-[#5B6478]">Not provided</span>}
    </dd>
  </div>
);

const DocumentLink = ({ href, label = 'View document' }) =>
  href ? (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#0090C6] font-semibold hover:underline">
      <FileText size={14} /> {label}
    </a>
  ) : (
    <span className="text-[#5B6478]">Not uploaded</span>
  );

// Full details of one account for an admin: read everything before approving, and correct what was mistyped.
const AdminUserModal = ({ userId, onClose, onChanged, onVerdict, verdictBusy = false }) => {
  const { showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Mounted once per account (the page gives it a key), so there is nothing to reset between accounts
  const load = useCallback(async () => {
    try {
      setDetail((await api.get(`/users/admin/users/${userId}/`)).data);
      setLoadError('');
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this account.'));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const profile = detail?.profile;
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEditing = () => {
    setForm(formFrom(detail));
    setFormError('');
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form };
      if ('skills' in payload) payload.skills = payload.skills.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await api.patch(`/users/admin/users/${userId}/`, payload);
      setDetail(res.data);
      setEditing(false);
      showToast(`${res.data.name}'s details were updated.`, 'success');
      onChanged?.();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save these details.'));
    } finally {
      setSaving(false);
    }
  };

  const status = detail?.verification_status;
  const verdict = (action) => onVerdict?.({ type: detail.entity_type, id: detail.entity_id, full_name: detail.name }, action);
  const canApprove = detail?.entity_type && status !== 'VERIFIED';
  const canReject = detail?.entity_type && ['PENDING_VERIFICATION', 'PENDING_REVIEW', 'HIGH_RISK'].includes(status);
  const canFlag = detail?.entity_type === 'COMPANY' && status === 'PENDING_REVIEW';
  const hasBank = profile?.bank_name || profile?.bank_account_number || profile?.duitnow_id;

  return (
    <Modal
      isOpen
      onClose={onClose}
      dismissible={!saving}
      maxWidth="max-w-2xl"
      icon={<UserRound size={20} />}
      title={detail?.name || 'Account details'}
      subtitle={detail ? `${detail.email} · ${detail.role.toLowerCase()}` : undefined}
    >
      {loadError && (
        <div className="alert-error">
          <span>{loadError}</span>
          <button type="button" onClick={load} className="ml-auto font-semibold underline">Try again</button>
        </div>
      )}

      {!detail && !loadError && (
        <div className="py-12 text-center text-sm text-[#5B6478]">
          <Loader2 size={20} className="animate-spin inline mr-2 text-[#00AEEF]" /> Loading account…
        </div>
      )}

      {detail && !editing && (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {status && <StatusBadge status={status} />}
            {detail.is_active
              ? <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 size={12} /> Active</span>
              : <span className="badge bg-red-50 text-red-700 border-red-200"><Ban size={12} /> Blocked</span>}
            {detail.email_verified
              ? <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200"><MailCheck size={12} /> Email confirmed</span>
              : <span className="badge bg-amber-50 text-amber-800 border-amber-200"><MailWarning size={12} /> Email not confirmed</span>}
          </div>

          <Section title="Account">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <Row label="Sign-in email">{detail.email}</Row>
              <Row label="Joined">{formatDate(detail.date_joined)}</Row>
              <Row label="Terms of Service accepted">{detail.terms_accepted_at ? formatDate(detail.terms_accepted_at) : 'No record'}</Row>
              {detail.agreements.map((a) => (
                <Row key={a.agreement} label={a.title}>
                  {a.accepted ? `Accepted ${formatDate(a.accepted_at)}` : 'Not accepted yet'}
                </Row>
              ))}
              {detail.club_membership && (
                <Row label="Club committee" wide>{detail.club_membership.role}, {detail.club_membership.club_name} ({detail.club_membership.university})</Row>
              )}
            </dl>
          </Section>

          {detail.role === 'STUDENT' && profile && (
            <>
              <Section title="Student profile">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <Row label="Full name">{profile.full_name}</Row>
                  <Row label="University">{profile.university}</Row>
                  <Row label="Course / major">{profile.major}</Row>
                  <Row label="Main track">{domainLabel(profile.domain_focus)}</Row>
                  <Row label="Backup email">{profile.secondary_email}</Row>
                  <Row label="Club or society">
                    {profile.club_affiliation_name && [profile.club_affiliation_name, profile.club_affiliation_role].filter(Boolean).join(' · ')}
                  </Row>
                  <Row label="Skills" wide>
                    {profile.skills?.length > 0 && (
                      <span className="flex flex-wrap gap-1.5 mt-1">
                        {profile.skills.map((skill) => (
                          <span key={skill} className="px-2.5 py-0.5 rounded-full bg-[#00AEEF]/10 text-[#0090C6] text-xs font-medium">{skill}</span>
                        ))}
                      </span>
                    )}
                  </Row>
                  <Row label="Bio" wide>{profile.bio && <span className="whitespace-pre-line">{profile.bio}</span>}</Row>
                  <Row label="Student ID document"><DocumentLink href={profile.verification_document} /></Row>
                  <Row label="Profile picture"><DocumentLink href={profile.profile_photo} label="View picture" /></Row>
                  <Row label="Client rating">{profile.rating ? `${profile.rating} / 5` : 'No ratings yet'}</Row>
                </dl>
              </Section>

              <Section title="Payout details">
                {hasBank ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <Row label="Bank">{profile.bank_name}</Row>
                    <Row label="Account number">{profile.bank_account_number}</Row>
                    <Row label="Account holder">{profile.bank_account_holder_name}</Row>
                    <Row label="DuitNow ID">{profile.duitnow_id}</Row>
                  </dl>
                ) : (
                  <p className="text-sm text-[#5B6478]">No bank details yet. The student adds them in their settings before their first payout.</p>
                )}
              </Section>
            </>
          )}

          {detail.role === 'COMPANY' && profile && (
            <Section title="Company profile">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Row label="Company name">{profile.company_name}</Row>
                <Row label="SSM registration number">{profile.company_details}</Row>
                <Row label="Plan">{profile.tier === 'PRO' ? 'Pro' : 'Free'}</Row>
                <Row label="SSM document"><DocumentLink href={profile.ssm_document} /></Row>
                <Row label="Logo"><DocumentLink href={profile.logo} label="View logo" /></Row>
              </dl>
            </Section>
          )}

          {detail.role === 'CLUB' && profile && (
            <Section title="Club profile">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Row label="Club name">{profile.club_name}</Row>
                <Row label="University">{profile.university}</Row>
                <Row label="Rank">{profile.rank && `${profile.rank}-class`}</Row>
                <Row label="Verification document"><DocumentLink href={profile.verification_document} /></Row>
                <Row label="Logo"><DocumentLink href={profile.logo} label="View logo" /></Row>
              </dl>
            </Section>
          )}

          {detail.role !== 'CLUB' && (
            <Section title={detail.role === 'COMPANY' ? 'Projects posted' : 'Projects assigned'}>
              {detail.projects.length === 0 ? (
                <p className="text-sm text-[#5B6478]">None yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.projects.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium break-words min-w-0">#{p.id} {p.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[#5B6478]">{formatMoney(p.budget)}</span>
                        <StatusBadge status={p.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <div className="flex flex-wrap gap-2 pt-5 mt-5 border-t border-[rgba(10,23,72,0.08)]">
            {canApprove && (
              <button type="button" onClick={() => verdict('approve')} disabled={verdictBusy} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">
                {verdictBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
              </button>
            )}
            {canFlag && (
              <button type="button" onClick={() => verdict('high_risk')} disabled={verdictBusy} className="btn-secondary btn-sm text-amber-700 hover:text-amber-800 hover:border-amber-300">
                <ShieldAlert size={14} /> Flag risk
              </button>
            )}
            {canReject && (
              <button type="button" onClick={() => verdict('reject')} disabled={verdictBusy} className="btn-danger btn-sm">
                <XCircle size={14} /> Reject
              </button>
            )}
            {profile && (
              <button type="button" onClick={startEditing} className="btn-secondary btn-sm sm:ml-auto">
                <Pencil size={13} /> Edit details
              </button>
            )}
          </div>
        </>
      )}

      {detail && editing && (
        <form onSubmit={save} className="space-y-4">
          {formError && <div className="alert-error">{formError}</div>}

          {detail.role === 'STUDENT' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label" htmlFor="au-name">Full name</label>
                  <input id="au-name" required value={form.full_name} onChange={set('full_name')} className="input" />
                </div>
                <div>
                  <label className="field-label" htmlFor="au-track">Main track</label>
                  <select id="au-track" value={form.domain_focus} onChange={set('domain_focus')} className="input">
                    {DOMAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="au-uni">University</label>
                  <input id="au-uni" required list="au-universities" value={form.university} onChange={set('university')} className="input" />
                  <datalist id="au-universities">{MALAYSIAN_UNIVERSITIES.map((u) => <option key={u} value={u} />)}</datalist>
                </div>
                <div>
                  <label className="field-label" htmlFor="au-major">Course / major</label>
                  <input id="au-major" value={form.major} onChange={set('major')} className="input" />
                </div>
                <div>
                  <label className="field-label" htmlFor="au-club">Club or society</label>
                  <input id="au-club" value={form.club_affiliation_name} onChange={set('club_affiliation_name')} className="input" />
                </div>
                <div>
                  <label className="field-label" htmlFor="au-club-role">Role in the club</label>
                  <input id="au-club-role" value={form.club_affiliation_role} onChange={set('club_affiliation_role')} className="input" />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="au-skills">Skills</label>
                <input id="au-skills" value={form.skills} onChange={set('skills')} className="input" placeholder="React, Django, Figma" />
                <p className="field-hint">Separate skills with commas.</p>
              </div>
              <div>
                <label className="field-label" htmlFor="au-bio">Bio</label>
                <textarea id="au-bio" rows={4} maxLength={1000} value={form.bio} onChange={set('bio')} className="input" />
              </div>
              <div className="sm:w-1/2">
                <label className="field-label" htmlFor="au-email2">Backup email</label>
                <input id="au-email2" type="email" value={form.secondary_email} onChange={set('secondary_email')} className="input" />
              </div>
            </>
          )}

          {detail.role === 'COMPANY' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="au-company">Company name</label>
                <input id="au-company" required value={form.company_name} onChange={set('company_name')} className="input" />
              </div>
              <div>
                <label className="field-label" htmlFor="au-ssm">SSM registration number</label>
                <input id="au-ssm" value={form.company_details} onChange={set('company_details')} className="input" />
              </div>
            </div>
          )}

          {detail.role === 'CLUB' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="au-club-name">Club name</label>
                <input id="au-club-name" required value={form.club_name} onChange={set('club_name')} className="input" />
              </div>
              <div>
                <label className="field-label" htmlFor="au-club-uni">University</label>
                <input id="au-club-uni" required value={form.university} onChange={set('university')} className="input" />
              </div>
            </div>
          )}

          <p className="text-xs text-[#5B6478]">
            The sign-in email, {detail.role === 'STUDENT' ? 'bank details, ' : ''}documents and pictures can only be changed by the account&apos;s owner, in their settings. Your edit is recorded in the activity feed.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AdminUserModal;
