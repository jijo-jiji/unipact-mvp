import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';

// Shown until the address is confirmed. Posting a project and accepting an offer stay blocked
// until then, so the banner explains why rather than letting those actions fail with an error.
const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.email_verified !== false) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/users/email/verify/resend/', { email: user.email });
      setSent(true);
    } catch (error) {
      showToast(getErrorMessage(error, 'We could not send a new link. Please try again shortly.'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 text-[#0A1748] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <AlertCircle size={20} className="text-amber-600 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Confirm your email address</p>
        <p className="text-[#5B6478] mt-0.5">
          We sent a link to <strong className="text-[#0A1748]">{user.email}</strong>.
          {user.role === 'COMPANY'
            ? ' You can post a project once it is confirmed.'
            : ' You can accept a project offer once it is confirmed.'}
        </p>
      </div>
      {sent ? (
        <span className="text-sm text-emerald-700 inline-flex items-center gap-1.5 shrink-0">
          <CheckCircle2 size={16} /> Link sent
        </span>
      ) : (
        <button type="button" onClick={resend} disabled={sending} className="btn-secondary shrink-0 whitespace-nowrap disabled:opacity-60">
          {sending ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : 'Resend link'}
        </button>
      )}
    </div>
  );
};

export default EmailVerificationBanner;
