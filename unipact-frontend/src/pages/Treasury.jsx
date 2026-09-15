import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2, CreditCard, Sparkles } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import PaymentModal from '../components/PaymentModal';
import PageLoader from '../components/PageLoader';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatMoney, getErrorMessage, transactionTypeLabel } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const PRO_PRICE = 499;

const Treasury = () => {
  usePageTitle('Billing');
  const { checkUserStatus } = useAuth();
  const { showToast } = useToast();
  const [history, setHistory] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [historyRes, userRes] = await Promise.all([api.get('/payments/history/'), api.get('/users/me/')]);
      setHistory(historyRes.data);
      setAccount(userRes.data);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load billing details.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePaid = async () => {
    showToast('Payment received. Thank you!', 'success');
    await fetchData();
    checkUserStatus(); // refresh tier shown elsewhere in the app
  };

  if (loading) return <PageLoader message="Loading billing…" />;

  const isPro = account?.tier === 'PRO';

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-[1160px] mx-auto px-4 sm:px-8 py-8 space-y-6 animate-fade-in">
        <Link to="/company/dashboard" className="back-link">
          <ArrowLeft size={15} /> Back to projects
        </Link>

        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">Billing</h1>
          <p className="text-sm text-[#5B6478] mt-1">Manage your plan, payment method and past payments.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className={`md:col-span-2 card p-6 sm:p-8 ${isPro ? '' : 'border-2 border-[#00AEEF]/40'}`}>
            <p className="eyebrow mb-2"><span className="eyebrow-dot" /> Current plan</p>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck size={28} className="text-[#00AEEF]" />
              <h2 className="font-heading font-extrabold text-3xl">{isPro ? 'Pro' : 'Free'}</h2>
            </div>
            <p className="text-sm text-[#5B6478] max-w-lg mb-6">
              {isPro
                ? "You're on Pro. Finder's fees are waived on every student match."
                : "Posting projects is free. A finder's fee applies each time you confirm a student match. Upgrade to Pro to waive all finder's fees."}
            </p>
            {!isPro && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button onClick={() => setPayment({ amount: PRO_PRICE, description: 'Pro plan (1 month)', type: 'SUBSCRIPTION' })} className="btn-primary px-6 py-3">
                  <Sparkles size={16} /> Upgrade to Pro · {formatMoney(PRO_PRICE)}/month
                </button>
                <span className="text-xs text-[#5B6478]">Cancel anytime.</span>
              </div>
            )}
          </section>

          <section className="card p-6 flex flex-col justify-between gap-6">
            <div>
              <h2 className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] mb-4">Payment method</h2>
              {account?.card_last_4 ? (
                <div className="flex items-center gap-3">
                  <div className="w-11 h-7 bg-[#0B1E63] text-white rounded flex items-center justify-center text-[9px] font-bold">{account.card_brand || 'CARD'}</div>
                  <span className="font-mono text-sm">•••• {account.card_last_4}</span>
                  <span className="ml-auto text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Active</span>
                </div>
              ) : (
                <p className="text-sm text-[#5B6478]">No card saved yet.</p>
              )}
            </div>
            <button onClick={() => setPayment({ amount: 1, description: 'Card verification (refundable)', type: 'SUBSCRIPTION' })} className="btn-secondary w-full">
              <CreditCard size={15} /> {account?.card_last_4 ? 'Update card' : 'Add card'}
            </button>
          </section>
        </div>

        <section className="card p-6 sm:p-8">
          <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2"><FileText size={18} className="text-[#00AEEF]" /> Payment history</h2>
          {history.length === 0 ? (
            <p className="text-sm text-[#5B6478] py-6 text-center">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm text-left min-w-[520px]">
                <thead className="text-xs uppercase tracking-wider text-[#5B6478] border-b border-[rgba(10,23,72,0.12)]">
                  <tr>
                    <th className="py-3 px-2 font-semibold">Date</th>
                    <th className="py-3 px-2 font-semibold">Description</th>
                    <th className="py-3 px-2 font-semibold">Status</th>
                    <th className="py-3 px-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(10,23,72,0.08)]">
                  {history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#F5F7FC]">
                      <td className="py-3 px-2 text-[#5B6478] whitespace-nowrap">{formatDate(tx.created_at)}</td>
                      <td className="py-3 px-2">
                        <div className="font-medium">{transactionTypeLabel(tx.transaction_type)}</div>
                        <div className="text-xs text-[#5B6478]">Ref TX-{tx.id}</div>
                      </td>
                      <td className="py-3 px-2"><StatusBadge status={tx.status} /></td>
                      <td className="py-3 px-2 text-right font-semibold text-[#0B1E63] whitespace-nowrap">{formatMoney(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <PaymentModal
        isOpen={!!payment}
        onClose={() => setPayment(null)}
        amount={payment?.amount}
        description={payment?.description}
        type={payment?.type}
        onSuccess={handlePaid}
      />
    </div>
  );
};

export default Treasury;
