import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, Link2Off } from 'lucide-react';
import api from '../api/client';
import AuthShell from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import { meetsPasswordRules } from '../utils/password';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const ResetPasswordPage = () => {
  usePageTitle('Choose a new password');
  const [params] = useSearchParams();
  const uid = params.get('uid');
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(!uid || !token);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!meetsPasswordRules(password)) return setError('Please choose a password that meets the requirements below.');
    if (password !== confirm) return setError('The two passwords don\'t match.');

    setLoading(true);
    try {
      await api.post('/users/password/reset/', { uid, token, password });
      setDone(true);
    } catch (err) {
      if (err.response?.status === 400 && err.response.data?.error?.includes('invalid or has expired')) {
        setLinkInvalid(true);
      } else {
        setError(getErrorMessage(err, 'We could not reset your password. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated">
        <div className="text-center">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500 mb-3" />
          <p className="text-sm">Your password has been changed. You can now sign in with your new password.</p>
          <Link to="/login" className="btn-primary w-full py-3 mt-6">Sign in</Link>
        </div>
      </AuthShell>
    );
  }

  if (linkInvalid) {
    return (
      <AuthShell title="This link has expired">
        <div className="text-center">
          <Link2Off size={40} className="mx-auto text-[#5B6478]/60 mb-3" />
          <p className="text-sm">Password reset links work once and expire after 1 hour. Request a new one to continue.</p>
          <Link to="/forgot-password" className="btn-primary w-full py-3 mt-6">Request a new link</Link>
          <Link to="/login" className="btn w-full mt-2 text-[#0090C6] hover:bg-[#00AEEF]/5">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you haven't used before.">
      {error && (
        <div className="alert-error mb-5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} showChecks />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          error={confirm && confirm !== password ? 'Passwords don\'t match yet.' : ''}
        />
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
