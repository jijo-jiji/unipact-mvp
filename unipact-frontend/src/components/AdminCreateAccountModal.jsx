import React, { useState } from 'react';
import { AlertCircle, Briefcase, CheckCircle2, GraduationCap, Loader2, Mail, UserPlus } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { DOMAIN_OPTIONS, MALAYSIAN_UNIVERSITIES } from '../utils/constants';
import { getErrorMessage } from '../utils/format';

const TYPES = [
  { role: 'STUDENT', label: 'Student', icon: GraduationCap },
  { role: 'COMPANY', label: 'Company', icon: Briefcase },
];

const EMPTY = {
  email: '', full_name: '', university: '', major: '', domain_focus: 'SOFTWARE_DEV', skills: '',
  company_name: '', company_details: '', verified: true,
};

const REQUIRED = {
  STUDENT: { full_name: "Enter the student's full name.", email: 'Enter their email address.', university: 'Choose their university.' },
  COMPANY: { company_name: "Enter the company's name.", email: 'Enter their email address.' },
};

// The first message the server gave for each field, so it can sit under that field
const fieldErrors = (data) => Object.fromEntries(
  Object.entries(data && typeof data === 'object' ? data : {})
    .filter(([, value]) => Array.isArray(value))
    .map(([field, value]) => [field, String(value[0])]),
);

// An admin sets up a student or company account. There's no password: the person is emailed a link to
// choose their own, so the admin never knows it. After each one the form can start again, for setting
// up several people in a row.
const AdminCreateAccountModal = ({ isOpen, initialRole = 'STUDENT', onClose, onCreated, onView }) => {
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const startAgain = () => {
    setForm((f) => ({ ...EMPTY, verified: f.verified }));
    setErrors({});
    setError('');
    setCreated(null);
  };

  const close = () => {
    if (busy) return;
    startAgain();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // Everything missing at once (the server stops at the first kind of problem it finds)
    const missing = Object.fromEntries(
      Object.entries(REQUIRED[role]).filter(([field]) => !String(form[field] || '').trim()),
    );
    if (Object.keys(missing).length) return setErrors(missing);
    setBusy(true);
    setErrors({});
    const payload = role === 'STUDENT'
      ? {
          role, email: form.email.trim(), verified: form.verified, full_name: form.full_name.trim(),
          university: form.university.trim(), major: form.major.trim(), domain_focus: form.domain_focus,
          skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        }
      : { role, email: form.email.trim(), verified: form.verified, company_name: form.company_name.trim(), company_details: form.company_details.trim() };
    try {
      const res = await api.post('/users/admin/users/create/', payload);
      setCreated(res.data);
      onCreated?.(res.data);
    } catch (err) {
      const byField = fieldErrors(err.response?.data);
      if (Object.keys(byField).length) setErrors(byField);
      else setError(getErrorMessage(err, 'Could not create this account.'));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (field) => errors[field] && <p className="text-xs text-red-700 mt-1" role="alert">{errors[field]}</p>;

  return (
    <Modal isOpen={isOpen} onClose={close} dismissible={!busy} maxWidth="max-w-xl" icon={<UserPlus size={20} />}
      title="Create an account" subtitle="For a student or a company you've already spoken to.">
      {created ? (
        <div className="text-center py-2">
          <span className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={28} /></span>
          <p className="font-heading font-bold text-lg">Account created for {created.name}</p>
          <p className="text-sm text-[#5B6478] mt-1.5">
            We&apos;ve emailed <strong className="text-[#0A1748]">{created.email}</strong> a link to set their password. It works for 7 days.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button type="button" onClick={startAgain} className="btn-primary"><UserPlus size={15} /> Create another</button>
            <button type="button" onClick={() => { const id = created.id; startAgain(); onView?.(id); }} className="btn-secondary">View account</button>
            <button type="button" onClick={close} className="btn-secondary">Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div role="group" aria-label="Account type" className="grid grid-cols-2 p-1 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)]">
            {TYPES.map(({ role: value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setRole(value); setErrors({}); setError(''); }}
                aria-pressed={role === value}
                className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${
                  role === value ? 'bg-[#0A1748] text-white' : 'text-[#5B6478] hover:text-[#0A1748]'
                }`}
              >
                {React.createElement(icon, { size: 15 })} {label}
              </button>
            ))}
          </div>

          {error && <div className="alert-error" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>}

          {role === 'STUDENT' ? (
            <>
              <div>
                <label className="field-label" htmlFor="ca-name">Full name</label>
                <input id="ca-name" required value={form.full_name} onChange={set('full_name')} className="input" autoComplete="off" />
                {fieldError('full_name')}
              </div>
              <div>
                <label className="field-label" htmlFor="ca-email">Email</label>
                <input id="ca-email" type="email" required value={form.email} onChange={set('email')} className="input" placeholder="name@siswa.edu.my" autoComplete="off" />
                {fieldError('email')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label" htmlFor="ca-university">University</label>
                  <input id="ca-university" list="ca-universities" required value={form.university} onChange={set('university')} className="input" autoComplete="off" />
                  <datalist id="ca-universities">{MALAYSIAN_UNIVERSITIES.map((u) => <option key={u} value={u} />)}</datalist>
                  {fieldError('university')}
                </div>
                <div>
                  <label className="field-label" htmlFor="ca-major">Course <span className="font-normal text-[#5B6478]">(optional)</span></label>
                  <input id="ca-major" value={form.major} onChange={set('major')} className="input" placeholder="Software Engineering" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label" htmlFor="ca-track">Main track</label>
                  <select id="ca-track" value={form.domain_focus} onChange={set('domain_focus')} className="input">
                    {DOMAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="ca-skills">Skills <span className="font-normal text-[#5B6478]">(optional)</span></label>
                  <input id="ca-skills" value={form.skills} onChange={set('skills')} className="input" placeholder="React, Figma, CapCut" />
                  {fieldError('skills')}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="field-label" htmlFor="ca-company">Company name</label>
                <input id="ca-company" required value={form.company_name} onChange={set('company_name')} className="input" autoComplete="off" />
                {fieldError('company_name')}
              </div>
              <div>
                <label className="field-label" htmlFor="ca-email">Email</label>
                <input id="ca-email" type="email" required value={form.email} onChange={set('email')} className="input" placeholder="name@company.com" autoComplete="off" />
                {fieldError('email')}
              </div>
              <div>
                <label className="field-label" htmlFor="ca-details">Company details <span className="font-normal text-[#5B6478]">(optional)</span></label>
                <textarea id="ca-details" rows={2} value={form.company_details} onChange={set('company_details')} className="input" placeholder="SSM registration number, address" />
              </div>
            </>
          )}

          <label className="flex items-start gap-3 p-3 rounded-lg border border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] cursor-pointer text-sm">
            <input type="checkbox" checked={form.verified} onChange={set('verified')} className="mt-0.5 w-5 h-5 shrink-0 accent-[#00AEEF]" />
            <span>
              <span className="font-semibold text-[#0A1748]">Mark as verified</span>
              <span className="block text-[#5B6478]">You&apos;ve already checked who they are, so they skip the verification queue. Untick to review them there first.</span>
            </span>
          </label>

          <p className="flex items-start gap-2 text-xs text-[#5B6478]">
            <Mail size={14} className="shrink-0 mt-px text-[#00729F]" />
            We&apos;ll email them a link to set their own password and accept the terms. It works for 7 days, and you never see their password.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><UserPlus size={15} /> Create account</>}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AdminCreateAccountModal;
