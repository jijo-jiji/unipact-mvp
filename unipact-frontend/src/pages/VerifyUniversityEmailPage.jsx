import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Link2Off } from 'lucide-react';
import api from '../api/client';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

// The link UniPact emails to a student's university address. Opening it confirms they're enrolled there.
const VerifyUniversityEmailPage = () => {
  usePageTitle('Confirm your university email');
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, checkUserStatus } = useAuth();
  const [state, setState] = useState(token ? 'checking' : 'invalid');
  const [message, setMessage] = useState('');
  // React runs effects twice in development; without this the link would be used twice
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const res = await api.post('/users/university-email/verify/', { token });
        setMessage(res.data?.email || '');
        setState('done');
        if (user) checkUserStatus();
      } catch (err) {
        setMessage(getErrorMessage(err, 'This confirmation link is invalid or has expired.'));
        setState('invalid');
      }
    })();
  }, [token, user, checkUserStatus]);

  const next = user ? { to: '/student/dashboard', label: 'Go to your dashboard' } : { to: '/login', label: 'Sign in' };

  if (state === 'checking') {
    return (
      <AuthShell title="Confirming your university email">
        <div className="text-center py-4">
          <Loader2 size={40} className="mx-auto text-[#00AEEF] animate-spin mb-3" />
          <p className="text-sm text-[#5B6478]">One moment…</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={state === 'done' ? 'University email confirmed' : 'This link has expired'}>
      <div className="text-center py-2 space-y-4">
        {state === 'done'
          ? <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
          : <Link2Off size={44} className="mx-auto text-[#5B6478]" />}
        <p className="text-sm text-[#5B6478]">
          {state === 'done'
            ? `Thanks${message ? `, ${message} is` : ', your university email is'} confirmed. It helps UniPact verify your student status.`
            : `${message} You can ask for a new link from your dashboard.`}
        </p>
        <Link to={next.to} className="btn-primary">{next.label}</Link>
      </div>
    </AuthShell>
  );
};

export default VerifyUniversityEmailPage;
