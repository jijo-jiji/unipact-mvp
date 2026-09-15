import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileUp, KeyRound, Loader2, Mail, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import PasswordField from '../components/PasswordField';
import StatusBadge from '../components/StatusBadge';
import { getErrorMessage } from '../utils/format';
import { meetsPasswordRules } from '../utils/password';
import { DOMAIN_OPTIONS, MALAYSIAN_UNIVERSITIES } from '../utils/constants';
import { usePageTitle } from '../hooks/usePageTitle';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'verification', label: 'Verification', icon: <ShieldCheck size={16} /> },
  { id: 'security', label: 'Password & sign-in', icon: <KeyRound size={16} /> },
];

// Initial form values from the signed-in account, per role
const profileFromUser = (user) => {
  if (user?.role === 'STUDENT') {
    const p = user.student_profile || {};
    return {
      full_name: p.full_name || '', domain_focus: p.domain_focus || 'SOFTWARE_DEV', university: p.university || '',
      major: p.major || '', skills: p.skills || [], bio: p.bio || '', club_affiliation_name: p.club_affiliation_name || '',
      club_affiliation_role: p.club_affiliation_role || '', secondary_email: p.secondary_email || '',
    };
  }
  if (user?.role === 'COMPANY') {
    const p = user.company_profile || {};
    return { company_name: p.company_name || '', company_details: p.company_details || '' };
  }
  if (user?.role === 'CLUB' && user.club_profile) {
    const p = user.club_profile;
    return { club_name: p.club_name || '', university: p.university || '' };
  }
  return null;
};

const DOCUMENT_COPY = {
  STUDENT: { field: 'verification_document', label: 'Student ID or enrolment letter' },
  COMPANY: { field: 'ssm_document', label: 'SSM registration certificate' },
  CLUB: { field: 'verification_document', label: 'Club registration letter' },
};

const Section = ({ id, title, description, children }) => (
  <section id={id} className="card p-6 sm:p-8 scroll-mt-28">
    <h2 className="font-heading font-bold text-xl">{title}</h2>
    {description && <p className="text-sm text-[#5B6478] mt-1">{description}</p>}
    <div className="mt-6">{children}</div>
  </section>
);

const SkillsInput = ({ value, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const additions = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    additions.forEach((skill) => {
      if (!next.some((s) => s.toLowerCase() === skill.toLowerCase())) next.push(skill.slice(0, 60));
    });
    onChange(next.slice(0, 30));
    setDraft('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-[#00AEEF]/10 text-[#0090C6] text-sm font-medium">
            {skill}
            <button type="button" onClick={() => onChange(value.filter((s) => s !== skill))} className="p-2.5 -my-1.5 sm:p-1 sm:my-0 rounded-full hover:bg-[#00AEEF]/20" aria-label={`Remove ${skill}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length === 0 && <span className="text-sm text-[#5B6478]">No skills added yet.</span>}
      </div>
      <input
        id="settings-skills"
        value={draft}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder="Type a skill and press Enter"
        className="input"
      />
      <p className="field-hint">Press Enter or type a comma to add. Admins use these to match you to projects.</p>
    </div>
  );
};

const SettingsPage = () => {
  usePageTitle('Account settings');
  const { user, updateAccount, changePassword } = useAuth();
  const { showToast } = useToast();

  const initial = useMemo(() => profileFromUser(user), [user]);
  const [profile, setProfile] = useState(initial);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const role = user?.role;
  // Club committee members joined by invitation: no club profile or documents of their own
  const isClubMember = role === 'CLUB' && !user?.club_profile;
  const docCopy = isClubMember ? null : DOCUMENT_COPY[role];
  const dirty = initial && profile && JSON.stringify(initial) !== JSON.stringify(profile);
  const set = (field) => (e) => setProfile((p) => ({ ...p, [field]: e.target.value }));

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setSavingProfile(true);
    try {
      const updated = await updateAccount(profile);
      setProfile(profileFromUser(updated));
      showToast('Your profile has been saved.', 'success');
    } catch (err) {
      setProfileError(getErrorMessage(err, 'We could not save your profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append(docCopy.field, docFile);
      await updateAccount(form);
      setDocFile(null);
      e.target.reset();
      showToast('Document uploaded. We\'ll review it shortly.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Upload failed.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!meetsPasswordRules(passwords.next)) return setPasswordError('Your new password doesn\'t meet the requirements yet.');
    if (passwords.next !== passwords.confirm) return setPasswordError('The new passwords don\'t match.');
    setSavingPassword(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      showToast('Password updated. We\'ve emailed you a confirmation.', 'success');
    } catch (err) {
      setPasswordError(getErrorMessage(err, 'We could not change your password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const verificationStatus = user?.verification_status;
  const sections = SECTIONS.filter((s) => {
    if (s.id === 'profile') return Boolean(profile) || isClubMember;
    if (s.id === 'verification') return Boolean(docCopy);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-[1160px] mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8">
          <p className="eyebrow mb-1"><span className="eyebrow-dot" /> Account</p>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">Settings</h1>
          <p className="text-sm text-[#5B6478] mt-1">Manage your profile, verification and password.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
          <nav aria-label="Settings sections" className="lg:sticky lg:top-28 flex lg:flex-col gap-1 overflow-x-auto overflow-y-hidden -mx-1 px-1">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-[#5B6478] hover:text-[#0A1748] hover:bg-white whitespace-nowrap">
                {s.icon} {s.label}
              </a>
            ))}
          </nav>

          <div className="space-y-6 min-w-0">
            {/* PROFILE */}
            {isClubMember && (
              <Section id="profile" title="Club membership">
                {user?.club_membership ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <dl className="text-sm space-y-1.5">
                      <div><dt className="inline text-[#5B6478]">Name: </dt><dd className="inline font-semibold">{user.name}</dd></div>
                      <div><dt className="inline text-[#5B6478]">Club: </dt><dd className="inline font-semibold">{user.club_membership.club_name}</dd></div>
                      <div><dt className="inline text-[#5B6478]">Role: </dt><dd className="inline font-semibold">{user.club_membership.role}</dd></div>
                    </dl>
                    <Link to={`/club/profile/${user.club_membership.club_id}`} className="btn-secondary self-start">View club roster</Link>
                  </div>
                ) : (
                  <p className="text-sm text-[#5B6478]">You&apos;re no longer linked to a club.</p>
                )}
                <p className="text-xs text-[#5B6478] mt-4">To change your name or committee role, ask your club president or contact the UniPact team.</p>
              </Section>
            )}
            {profile && (
              <Section id="profile" title="Profile" description={role === 'STUDENT' ? 'This appears on your public portfolio and helps admins match you to projects.' : 'Shown to students and UniPact admins.'}>
                {profileError && <div className="alert-error mb-5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{profileError}</span></div>}
                <form onSubmit={handleProfileSave} className="space-y-5">
                  {role === 'STUDENT' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="field-label" htmlFor="s-name">Full name</label>
                          <input id="s-name" required value={profile.full_name} onChange={set('full_name')} className="input" autoComplete="name" />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="s-track">Main track</label>
                          <select id="s-track" value={profile.domain_focus} onChange={set('domain_focus')} className="input">
                            {DOMAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field-label" htmlFor="s-uni">University</label>
                          <input id="s-uni" required list="settings-universities" value={profile.university} onChange={set('university')} className="input" />
                          <datalist id="settings-universities">{MALAYSIAN_UNIVERSITIES.map((u) => <option key={u} value={u} />)}</datalist>
                        </div>
                        <div>
                          <label className="field-label" htmlFor="s-major">Course / major</label>
                          <input id="s-major" value={profile.major} onChange={set('major')} className="input" />
                        </div>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="settings-skills">Skills</label>
                        <SkillsInput value={profile.skills} onChange={(skills) => setProfile((p) => ({ ...p, skills }))} />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="s-bio">Bio</label>
                        <textarea id="s-bio" rows={4} maxLength={1000} value={profile.bio} onChange={set('bio')} className="input" placeholder="What kind of projects are you great at?" />
                        <p className="field-hint text-right">{profile.bio.length}/1000</p>
                      </div>
                      <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-[#F5F7FC]">
                        <legend className="text-sm font-semibold px-1">Club or society (optional)</legend>
                        <div>
                          <label className="text-xs text-[#5B6478] block mb-1" htmlFor="s-club">Club name</label>
                          <input id="s-club" value={profile.club_affiliation_name} onChange={set('club_affiliation_name')} className="input bg-white" />
                        </div>
                        <div>
                          <label className="text-xs text-[#5B6478] block mb-1" htmlFor="s-club-role">Your role</label>
                          <input id="s-club-role" value={profile.club_affiliation_role} onChange={set('club_affiliation_role')} className="input bg-white" />
                        </div>
                      </fieldset>
                      <div className="md:w-1/2">
                        <label className="field-label" htmlFor="s-email2">Backup email (optional)</label>
                        <input id="s-email2" type="email" value={profile.secondary_email} onChange={set('secondary_email')} className="input" placeholder="personal@gmail.com" />
                        <p className="field-hint">Useful if you lose access to your university email after graduating.</p>
                      </div>
                    </>
                  )}

                  {role === 'COMPANY' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="field-label" htmlFor="c-name">Company name</label>
                        <input id="c-name" required value={profile.company_name} onChange={set('company_name')} className="input" autoComplete="organization" />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="c-ssm">SSM registration number</label>
                        <input id="c-ssm" value={profile.company_details} onChange={set('company_details')} className="input" />
                      </div>
                    </div>
                  )}

                  {role === 'CLUB' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="field-label" htmlFor="cl-name">Club name</label>
                        <input id="cl-name" required value={profile.club_name} onChange={set('club_name')} className="input" />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="cl-uni">University</label>
                        <input id="cl-uni" required list="settings-universities-club" value={profile.university} onChange={set('university')} className="input" />
                        <datalist id="settings-universities-club">{MALAYSIAN_UNIVERSITIES.map((u) => <option key={u} value={u} />)}</datalist>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                    {dirty && <button type="button" onClick={() => setProfile(initial)} className="btn-secondary">Discard changes</button>}
                    <button type="submit" disabled={!dirty || savingProfile} className="btn-primary">
                      {savingProfile ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : dirty ? 'Save changes' : <><CheckCircle2 size={15} /> Saved</>}
                    </button>
                  </div>
                </form>
              </Section>
            )}

            {/* VERIFICATION */}
            {docCopy && (
              <Section id="verification" title="Verification" description="UniPact reviews every account before it can take part in the marketplace.">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-sm text-[#5B6478]">Current status</span>
                  <StatusBadge status={verificationStatus} />
                </div>
                {verificationStatus === 'VERIFIED' ? (
                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> Your account is verified. There&apos;s nothing else you need to do.
                  </p>
                ) : (
                  <>
                    <p className={`text-sm rounded-lg p-3 mb-4 ${verificationStatus === 'REJECTED' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-900'}`}>
                      {verificationStatus === 'REJECTED'
                        ? 'We couldn\'t verify your account with the details provided. Upload a clear document below and your account will go back into review.'
                        : user?.has_verification_document
                          ? 'Your document is with our team. You can upload a replacement if you need to.'
                          : 'Upload a document to help us verify your account faster.'}
                    </p>
                    <form onSubmit={handleDocumentUpload} className="flex flex-col sm:flex-row gap-3 sm:items-end">
                      <div className="flex-1">
                        <label className="field-label" htmlFor="verify-doc">{docCopy.label}</label>
                        <input id="verify-doc" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                          className="input file:mr-3 file:rounded file:border-0 file:bg-[#0B1E63] file:text-white file:px-3 file:py-1 file:text-xs" />
                        <p className="field-hint">PDF, PNG, JPG or WEBP, up to 10 MB.</p>
                      </div>
                      <button type="submit" disabled={!docFile || uploading} className="btn-navy sm:mb-6">
                        {uploading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />} Upload
                      </button>
                    </form>
                  </>
                )}
              </Section>
            )}

            {/* SECURITY */}
            <Section id="security" title="Password & sign-in">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#F5F7FC] mb-6">
                <Mail size={18} className="text-[#00AEEF] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm text-[#5B6478]">Sign-in email</div>
                  <div className="font-semibold break-all">{user?.email}</div>
                  <p className="text-xs text-[#5B6478] mt-1">To change your sign-in email, please contact the UniPact team.</p>
                </div>
              </div>

              {passwordError && <div className="alert-error mb-5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{passwordError}</span></div>}
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <PasswordField id="pw-current" label="Current password" value={passwords.current} onChange={(v) => setPasswords((p) => ({ ...p, current: v }))} autoComplete="current-password" />
                <PasswordField id="pw-new" label="New password" value={passwords.next} onChange={(v) => setPasswords((p) => ({ ...p, next: v }))} showChecks />
                <PasswordField
                  id="pw-confirm"
                  label="Confirm new password"
                  value={passwords.confirm}
                  onChange={(v) => setPasswords((p) => ({ ...p, confirm: v }))}
                  error={passwords.confirm && passwords.confirm !== passwords.next ? 'Passwords don\'t match yet.' : ''}
                />
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button type="submit" disabled={savingPassword || !passwords.current || !passwords.next} className="btn-primary">
                    {savingPassword ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : 'Update password'}
                  </button>
                  <Link to="/forgot-password" state={{ email: user?.email }} className="inline-block py-2 text-sm font-medium text-[#0090C6] hover:underline">Forgot your current password?</Link>
                </div>
              </form>
            </Section>

            <p className="text-sm text-[#5B6478] px-1">
              Read how we handle your data in our <Link to="/privacy" className="underline hover:text-[#0A1748]">Privacy Policy</Link>.
              To request a copy of your data or delete your account, contact the UniPact team.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
