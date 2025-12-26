import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Shield, Clock, FileText, CheckCircle } from 'lucide-react';
import api from '../api/client';
import PaymentModal from '../components/PaymentModal';

const Treasury = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);

  // Payment State
  const [paymentAmount, setPaymentAmount] = useState(499);
  const [paymentDesc, setPaymentDesc] = useState('Pro Tier Upgrade');
  const [paymentType, setPaymentType] = useState('SUBSCRIPTION');

  const [user, setUser] = useState(null);

  // FETCH DATA
  const fetchData = async () => {
    try {
      const [historyRes, userRes] = await Promise.all([
        api.get('/payments/history/'),
        api.get('/users/me/')
      ]);
      setHistory(historyRes.data);
      setUser(userRes.data);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openPayment = (amount, desc, type = 'SUBSCRIPTION') => {
    setPaymentAmount(amount);
    setPaymentDesc(desc);
    setPaymentType(type);
    setPaymentModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 flex justify-center text-white">
      <div className="w-full max-w-4xl animate-fade-in">

        {/* Header */}
        <button
          onClick={() => navigate('/company/dashboard')}
          className="flex items-center gap-2 text-[var(--text-blue)] hover:text-[var(--text-gold)] mb-6 transition-colors uppercase text-xs tracking-widest"
        >
          <ArrowLeft size={14} /> Return to Command Center
        </button>

        <h1 className="text-3xl font-display uppercase tracking-widest mb-2 text-[var(--text-gold)]">
          Guild Ledger (Billing)
        </h1>
        <p className="text-[var(--text-blue)] text-sm mb-8">Manage subscriptions and scouting fees.</p>

        {/* 1. SUBSCRIPTION CARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          {/* Current Plan */}
          <div className="md:col-span-2 bg-gradient-to-r from-[var(--text-gold)]/10 to-transparent border border-[var(--text-gold)] p-8 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-[var(--text-blue)] text-xs uppercase tracking-widest mb-2">
                <Shield size={14} /> Current Charter
              </div>
              <div className="text-4xl font-display font-bold text-white mb-2">
                {user?.tier || 'Free Tier'}
              </div>
              <p className="text-sm text-gray-400 mb-6 max-w-md">
                {user?.tier === 'PRO'
                  ? "You are a Pro Member. Scouting fees are waived."
                  : <><span className="text-[var(--text-gold)]">RM 100</span> per successful match. Upgrade to PRO to waive all scouting fees.</>
                }
              </p>

              {user?.tier !== 'PRO' && (
                <button
                  onClick={() => openPayment(499, 'Pro Tier Subscription (1 Month)', 'SUBSCRIPTION')}
                  className="bg-[var(--text-gold)] text-black px-6 py-3 uppercase font-bold text-sm hover:bg-white transition-colors shadow-[0_0_20px_rgba(222,184,116,0.3)]"
                >
                  Upgrade to PRO (RM 499/mo)
                </button>
              )}
            </div>
            {/* Background Decor */}
            <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-[var(--text-gold)]/20 to-transparent"></div>
          </div>

          {/* Payment Method */}
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 flex flex-col justify-between">
            <div>
              <div className="text-[var(--text-blue)] text-xs uppercase tracking-widest mb-4">Payment Method</div>

              {/* No saved card state for MVP */}
              {user?.card_last_4 ? (
                <div className="flex items-center gap-3 text-white mb-2">
                  <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center text-[8px] font-bold">
                    {user.card_brand || 'CARD'}
                  </div>
                  <span className="font-mono">**** {user.card_last_4}</span>
                  <div className="text-xs text-green-400 flex items-center gap-1 ml-auto">
                    <CheckCircle size={10} /> Active
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm italic mb-4">
                  No payment method saved.
                </div>
              )}

            </div>
            <button
              onClick={() => openPayment(1, 'Update Payment Method (Verification)', 'SUBSCRIPTION')}
              className="text-[var(--text-blue)] text-xs border border-[var(--text-blue)] py-2 hover:bg-[var(--text-blue)] hover:text-black transition-colors uppercase"
            >
              Add / Update Card
            </button>
          </div>
        </div>

        {/* 2. TRANSACTION HISTORY (Finder's Fees) */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6">
          <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-6 flex items-center gap-2">
            <FileText size={16} /> Transaction History
          </h3>

          <table className="w-full text-sm text-left">
            <thead className="text-[var(--text-blue)] text-xs uppercase border-b border-gray-800">
              <tr>
                <th className="pb-3 font-normal">Date</th>
                <th className="pb-3 font-normal">Type</th>
                <th className="pb-3 font-normal">Status</th>
                <th className="pb-3 font-normal text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {history.length > 0 ? (
                history.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                    <td className="py-4 text-gray-500 font-mono text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="py-4">
                      <div className="font-bold text-white uppercase text-xs tracking-wider">{tx.transaction_type}</div>
                      <div className="text-xs text-[var(--text-blue)]">ID: TX-{tx.id}</div>
                    </td>
                    <td className="py-4 font-mono text-xs">
                      <span className={`px-2 py-1 rounded ${tx.status === 'SUCCESS' ? 'text-green-400 bg-green-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-4 text-right text-[var(--text-gold)] font-bold">
                      RM {tx.amount}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500 italic">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 text-center">
            <button className="text-[var(--text-blue)] text-xs hover:text-white flex items-center justify-center gap-1 w-full">
              <Clock size={12} /> View Older Invoices
            </button>
          </div>
        </div>

      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        amount={paymentAmount}
        description={paymentDesc}
        onSuccess={fetchData}
        type={paymentType}
      />
    </div>
  );
};

export default Treasury;
