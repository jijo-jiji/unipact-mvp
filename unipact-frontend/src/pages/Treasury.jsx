import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Shield, Clock, FileText, CheckCircle } from 'lucide-react';

const Treasury = () => {
  const navigate = useNavigate();

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
              <div className="text-4xl font-display font-bold text-white mb-2">Free Tier</div>
              <p className="text-sm text-gray-400 mb-6 max-w-md">
                You pay <span className="text-[var(--text-gold)]">RM 100</span> per successful match. Upgrade to PRO to waive all scouting fees.
              </p>
              
              <button className="bg-[var(--text-gold)] text-black px-6 py-3 uppercase font-bold text-sm hover:bg-white transition-colors shadow-[0_0_20px_rgba(222,184,116,0.3)]">
                Upgrade to PRO (RM 499/mo)
              </button>
            </div>
            {/* Background Decor */}
            <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-[var(--text-gold)]/20 to-transparent"></div>
          </div>

          {/* Payment Method */}
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 flex flex-col justify-between">
            <div>
              <div className="text-[var(--text-blue)] text-xs uppercase tracking-widest mb-4">Payment Method</div>
              <div className="flex items-center gap-3 text-white mb-2">
                <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center text-[8px]">VISA</div>
                <span className="font-mono">**** 4242</span>
              </div>
              <div className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle size={10} /> Active
              </div>
            </div>
            <button className="text-[var(--text-blue)] text-xs border border-[var(--text-blue)] py-2 hover:bg-[var(--text-blue)] hover:text-black transition-colors uppercase">
              Update Card
            </button>
          </div>
        </div>

        {/* 2. TRANSACTION HISTORY (Finder's Fees) */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6">
          <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-6 flex items-center gap-2">
            <FileText size={16} /> Scouting Fee History
          </h3>
          
          <table className="w-full text-sm text-left">
            <thead className="text-[var(--text-blue)] text-xs uppercase border-b border-gray-800">
              <tr>
                <th className="pb-3 font-normal">Date</th>
                <th className="pb-3 font-normal">Match Details</th>
                <th className="pb-3 font-normal">Invoice ID</th>
                <th className="pb-3 font-normal text-right">Fee Paid</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                { date: 'Nov 14', desc: 'Unlocked: UM Business Club', id: 'INV-9921', amount: 'RM 100.00' },
                { date: 'Oct 02', desc: 'Unlocked: Tech Society USM', id: 'INV-8821', amount: 'RM 100.00' },
              ].map((tx, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                  <td className="py-4 text-gray-500 font-mono text-xs">{tx.date}</td>
                  <td className="py-4">
                    <div className="font-bold text-white">{tx.desc}</div>
                    <div className="text-xs text-[var(--text-blue)]">Campaign: Gen Z Strategy</div>
                  </td>
                  <td className="py-4 font-mono text-xs text-gray-500">{tx.id}</td>
                  <td className="py-4 text-right text-[var(--text-gold)] font-bold">
                    {tx.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-4 text-center">
            <button className="text-[var(--text-blue)] text-xs hover:text-white flex items-center justify-center gap-1 w-full">
              <Clock size={12} /> View Older Invoices
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Treasury;