import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Link2Off, Loader2, Mail, Users } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthShell from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import TermsConsent from '../components/TermsConsent';
import { meetsPasswordRules } from '../utils/password';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

// Landing page for the link in a club committee invitation email: /join-club?token=…
const JoinClubPage = () => {
  usePageTitle('Join your club');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { claimClubInvitation } = useAuth();
  const { showToast } = useToast();

  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(Boolean(token));
  const [linkError, setLinkError] = useState(token ? '' : 'This invitation link is incomplete. Open the link from your invitation email again.');

  const [form, setForm] = useState({ first_name: '', last_name: '', password: '', confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.post('/users/users/claim/preview/', { token })
      .then((res) => { if (!cancelled) setInvite(res.data); })
      .catch((err) => { if (!cancelled) setLinkError(getErrorMessage(err, 'This invitation link is invalid or has expired.')); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [token]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!meetsPasswordRules(form.password)) return setError('Please choose a password that meets the requirements below.');
    if (form.password !== form.confirm) return setError('The two passwords don\'t match.');
    if (!accepted) return setError('Please agree to the Terms of Service and Privacy Policy.');

    setSubmitting(true);
    try {
      const data = await claimClubInvitation({
        token,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        accept_terms: true,
      });
      showToast(data.message || 'Welcome to your club!', 'success');
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'We could not set up your account. Please try again.');
      if (message.includes('invalid or has expired') || message.includes('already exists')) {
        setLinkError(message);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <AuthShell title="Checking your invitation">
        <div className="flex items-center justify-center gap-3 text-sm text-[#5B6478] py-4">
          <Loader2 size={18} className="animate-spin text-[#00AEEF]" /> One moment…
        </div>
      </AuthShell>
    );
  }

  if (linkError) {
    const hasAccount = linkError.includes('already exists');
    return (
      <AuthShell title={hasAccount ? 'You already have an account' : 'This invitation can\'t be used'}>
        <div className="text-center">
          <Link2Off size={40} className="mx-auto text-[#5B6478]/60 mb-3" />
          <p className="text-sm">{linkError}</p>
          {!hasAccount && <p className="text-sm text-[#5B6478] mt-2">Invitation links work once and expire after 14 days.</p>}
          <Link to="/login" className="btn-primary w-full py-3 mt-6">Go to sign in</Link>
          <Link to="/" className="btn w-full mt-2 text-[#0090C6] hover:bg-[#00AEEF]/5">Back to UniPact</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${invite.club_name}`}
      subtitle="Set up your account to accept the invitation."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-[#0090C6] hover:underline">Sign in</Link></>}
    >
      <div className="flex items-start gap-3 p-4 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#0B1E63] flex items-center justify-center shrink-0">
          <Users size={20} className="text-[#00AEEF]" />
        </div>
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-[#0A1748]">{invite.role}</div>
          <div className="text-[#5B6478]">{[invite.club_name, invite.university].filter(Boolean).join(' · ')}</div>
          <div className="text-[#5B6478] inline-flex items-center gap-1.5 mt-1 break-all"><Mail size={13} className="shrink-0" /> {invite.email}</div>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="join-first">First name</label>
            <input id="join-first" required autoFocus autoComplete="given-name" maxLength={150} value={form.first_name} onChange={set('first_name')} className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="join-last">Last name</label>
            <input id="join-last" autoComplete="family-name" maxLength={150} value={form.last_name} onChange={set('last_name')} className="input" />
          </div>
        </div>
        <PasswordField id="join-password" label="Create a password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} showChecks />
        <PasswordField
          id="join-confirm"
          label="Confirm password"
          value={form.confirm}
          onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
          error={form.confirm && form.confirm !== form.password ? 'Passwords don\'t match yet.' : ''}
        />
        <TermsConsent checked={accepted} onChange={setAccepted} />
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Joining…</> : 'Accept invitation'}
        </button>
      </form>
    </AuthShell>
  );
};

export default JoinClubPage;
