import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Mail, MailCheck } from 'lucide-react';
import api from '../api/client';
import AuthShell from '../components/AuthShell';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const ForgotPasswordPage = () => {
  usePageTitle('Forgot password');
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/users/password/forgot/', { email: email.trim() });
      setSentTo(email.trim());
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send the reset email. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell title="Check your email">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <MailCheck size={26} />
          </div>
          <p className="text-sm leading-relaxed">
            If an account exists for <strong className="break-all">{sentTo}</strong>, we&apos;ve sent a link to reset your password.
            The link expires in 1 hour.
          </p>
          <p className="text-sm text-[#5B6478] mt-3">Can&apos;t find it? Check your spam folder, or try again in a few minutes.</p>
          <div className="flex flex-col gap-2 mt-6">
            <Link to="/login" className="btn-primary w-full py-3">Back to sign in</Link>
            <button type="button" onClick={() => setSentTo('')} className="btn w-full text-[#0090C6] hover:bg-[#00AEEF]/5">Use a different email</button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email you signed up with and we'll send you a reset link."
      footer={<Link to="/login" className="back-link"><ArrowLeft size={15} /> Back to sign in</Link>}
    >
      {error && (
        <div className="alert-error mb-5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="forgot-email">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478] pointer-events-none" />
            <input id="forgot-email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="input pl-10" />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
