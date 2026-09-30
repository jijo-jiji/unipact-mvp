import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Link2Off, Mail } from 'lucide-react';
import api from '../api/client';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const VerifyEmailPage = () => {
  usePageTitle('Confirm your email');
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, checkUserStatus } = useAuth();

  const [state, setState] = useState(token ? 'checking' : 'invalid');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  // React runs effects twice in development; without this the link is spent on the first render
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        await api.post('/users/email/verify/', { token });
        setState('done');
        checkUserStatus();
      } catch (err) {
        setState('invalid');
        setError(getErrorMessage(err, 'This confirmation link is invalid or has expired.'));
      }
    })();
  }, [token, checkUserStatus]);

  const resend = async () => {
    setResending(true);
    try {
      await api.post('/users/email/verify/resend/', user?.email ? { email: user.email } : {});
      setResent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send a new link. Please try again shortly.'));
    } finally {
      setResending(false);
    }
  };

  if (state === 'checking') {
    return (
      <AuthShell title="Confirming your email">
        <div className="text-center py-4">
          <Loader2 size={40} className="mx-auto text-[#00AEEF] animate-spin mb-3" />
          <p className="text-sm text-[#5B6478]">One moment…</p>
        </div>
      </AuthShell>
    );
  }

  if (state === 'done') {
    return (
      <AuthShell title="Email confirmed">
        <div className="text-center">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500 mb-3" />
          <p className="text-sm">Thanks. Your email address is confirmed and your account is ready to use.</p>
          <Link to={user ? '/' : '/login'} className="btn-primary w-full py-3 mt-6">
            {user ? 'Go to UniPact' : 'Sign in'}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="This link has expired">
      <div className="text-center">
        <Link2Off size={44} className="mx-auto text-[#5B6478] mb-3" />
        <p className="text-sm text-[#5B6478]">{error || 'Confirmation links expire after a few days and work only once.'}</p>

        {resent ? (
          <p className="text-sm text-emerald-700 mt-6 inline-flex items-center gap-2">
            <Mail size={16} /> If that address needs confirming, a new link is on its way.
          </p>
        ) : (
          <button type="button" onClick={resend} disabled={resending} className="btn-primary w-full py-3 mt-6 disabled:opacity-60">
            {resending ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send me a new link'}
          </button>
        )}

        <p className="text-xs text-[#5B6478] mt-4">
          Signed out? <Link to="/login" className="text-[#0090C6] underline">Sign in</Link> and we&apos;ll offer the link again.
        </p>
      </div>
    </AuthShell>
  );
};

export default VerifyEmailPage;
