import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import { formatMoney } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const CHECKS = 6; // FPX usually confirms within seconds; stop asking after about half a minute
const CHECK_INTERVAL_MS = 5000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ToyyibPay sends the client back here after their bank. The query string can't be trusted, so the page
// asks UniPact's server, which checks with ToyyibPay, then confirms the match once the fee is paid.
const PaymentReturn = () => {
  usePageTitle('Payment');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const billCode = params.get('billcode');
  const [state, setState] = useState(billCode ? 'checking' : 'missing'); // checking | pending | failed | missing
  const [result, setResult] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (!billCode || started.current) return;
    started.current = true; // StrictMode runs effects twice in development; check (and confirm) only once

    const run = async () => {
      let data = null;
      for (let attempt = 0; attempt < CHECKS; attempt += 1) {
        try {
          data = (await api.post('/payments/toyyibpay/verify/', { billcode: billCode })).data;
        } catch {
          data = null;
        }
        if (data && data.status !== 'PENDING') break;
        if (attempt < CHECKS - 1) await wait(CHECK_INTERVAL_MS);
      }
      setResult(data);

      if (data?.status === 'SUCCESS') {
        try {
          await api.post(`/campaigns/${data.campaign_id}/finalize/`, { mock_pay: false });
          showToast('Payment received and match confirmed. Your student team can start work now.', 'success');
        } catch {
          showToast('Payment received. Open the project to confirm your match.', 'success');
        }
        navigate(`/manage-campaign/${data.campaign_id}`, { replace: true });
      } else {
        setState(data?.status === 'FAILED' ? 'failed' : 'pending');
      }
    };
    run();
  }, [billCode, navigate, showToast]);

  const projectLink = result?.campaign_id ? `/manage-campaign/${result.campaign_id}` : '/company/dashboard';

  const content = {
    checking: {
      icon: <Loader2 size={40} className="animate-spin text-[#00AEEF]" />,
      title: 'Confirming your payment…',
      text: 'Checking with your bank. Please keep this page open.',
    },
    pending: {
      icon: <Clock size={40} className="text-amber-600" />,
      title: 'Your bank is still processing the payment',
      text: "This can take a few minutes. We'll email your receipt as soon as it clears, and you can then confirm the match from your project.",
    },
    failed: {
      icon: <XCircle size={40} className="text-red-600" />,
      title: "The payment didn't go through",
      text: `No money was taken${result?.amount ? ` for ${formatMoney(result.amount)}` : ''}. You can try again from your project, or pay by bank transfer instead.`,
    },
    missing: {
      icon: <CheckCircle2 size={40} className="text-[#5B6478]" />,
      title: 'Nothing to confirm',
      text: 'This page is only used when returning from an online payment.',
    },
  }[state];

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-[1160px] mx-auto px-4 sm:px-8 py-16">
        <div className="card max-w-lg mx-auto p-8 sm:p-10 text-center" role="status" aria-live="polite">
          <div className="flex justify-center mb-4">{content.icon}</div>
          <h1 className="font-heading font-bold text-xl sm:text-2xl mb-2">{content.title}</h1>
          <p className="text-sm text-[#5B6478] mb-6">{content.text}</p>
          {state !== 'checking' && <Link to={projectLink} className="btn-primary">Back to project</Link>}
        </div>
      </main>
    </div>
  );
};

export default PaymentReturn;
