import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Briefcase, GraduationCap, Link2Off, Loader2, Mail } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthShell from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import TermsConsent from '../components/TermsConsent';
import { AGREEMENTS } from '../utils/agreements';
import { meetsPasswordRules } from '../utils/password';
import { getErrorMessage } from '../utils/format';
import { homePathForRole } from '../utils/routes';
import { usePageTitle } from '../hooks/usePageTitle';

// Landing page for the link in the email UniPact sends when an admin creates someone's account:
// /welcome?token=…  They choose their password and accept the terms, then they're signed in.
const WelcomePage = () => {
  usePageTitle('Set up your account');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { acceptAccountInvitation } = useAuth();
  const { showToast } = useToast();

  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(Boolean(token));
  const [linkError, setLinkError] = useState(token ? '' : 'This link is incomplete. Open the link from your email again.');

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    api.post('/users/invitation/preview/', { token })
      .then((res) => { if (!cancelled) setInvite(res.data); })
      .catch((err) => { if (!cancelled) setLinkError(getErrorMessage(err, 'This link is invalid or has expired.')); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [token]);

  const isStudent = invite?.role === 'STUDENT';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!meetsPasswordRules(form.password)) return setError('Please choose a password that meets the requirements below.');
    if (form.password !== form.confirm) return setError('The two passwords don\'t match.');
    if (!accepted) return setError('Please agree to the terms to continue.');

    setSubmitting(true);
    try {
      const data = await acceptAccountInvitation({
        token,
        password: form.password,
        accept_terms: true,
        ...(isStudent ? { talent_agreement_version: AGREEMENTS.TALENT.version } : {}),
      });
      showToast(`Welcome to UniPact, ${data.user.name}.`, 'success');
      navigate(homePathForRole(data.user.role), { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'We could not set up your account. Please try again.');
      if (message.includes('invalid, has expired')) setLinkError(message);
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <AuthShell title="Checking your link">
        <div className="flex items-center justify-center gap-3 text-sm text-[#5B6478] py-4">
          <Loader2 size={18} className="animate-spin text-[#00AEEF]" /> One moment…
        </div>
      </AuthShell>
    );
  }

  if (linkError) {
    return (
      <AuthShell title="This link can't be used">
        <div className="text-center">
          <Link2Off size={40} className="mx-auto text-[#5B6478]/60 mb-3" />
          <p className="text-sm">{linkError}</p>
          <Link to="/forgot-password" className="btn-primary w-full py-3 mt-6">Get a new link</Link>
          <Link to="/login" className="btn w-full mt-2 text-[#00729F] hover:bg-[#00AEEF]/5">Go to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Welcome to UniPact, ${invite.name}`}
      subtitle="Choose a password to finish setting up your account."
      footer={<>Already set your password? <Link to="/login" className="font-semibold text-[#00729F] hover:underline">Sign in</Link></>}
    >
      <div className="flex items-start gap-3 p-4 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#0B1E63] flex items-center justify-center shrink-0">
          {isStudent ? <GraduationCap size={20} className="text-[#00AEEF]" /> : <Briefcase size={20} className="text-[#00AEEF]" />}
        </div>
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-[#0A1748]">{isStudent ? 'Student account' : 'Client account'}</div>
          <div className="text-[#5B6478] inline-flex items-center gap-1.5 mt-0.5 break-all"><Mail size={13} className="shrink-0" /> {invite.email}</div>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField id="welcome-password" label="Choose a password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} showChecks />
        <PasswordField
          id="welcome-confirm"
          label="Confirm password"
          value={form.confirm}
          onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
          error={form.confirm && form.confirm !== form.password ? 'Passwords don\'t match yet.' : ''}
        />
        <TermsConsent checked={accepted} onChange={setAccepted} agreement={isStudent ? AGREEMENTS.TALENT : undefined} />
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Setting up…</> : 'Set password and continue'}
        </button>
      </form>
    </AuthShell>
  );
};

export default WelcomePage;
