import React from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, Loader2, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { formatDate, formatMoney } from '../utils/format';
import { formatDateTime } from '../utils/projectHistory';

const Line = ({ label, value, hint, strong = false }) => (
  <div className={`flex items-start justify-between gap-4 py-2.5 ${strong ? 'border-t border-[rgba(10,23,72,0.12)] mt-1 pt-3' : ''}`}>
    <dt className="text-sm min-w-0">
      <span className={strong ? 'font-semibold' : ''}>{label}</span>
      {hint && <span className="block text-xs text-[#5B6478]">{hint}</span>}
    </dt>
    <dd className={`text-sm shrink-0 ${strong ? 'font-heading font-bold text-base text-[#0B1E63]' : 'font-semibold'}`}>{value}</dd>
  </div>
);

// The money side of a client's project: what the fee is made of, what has been paid, what is held in
// escrow and what has been released to the team.
const ProjectPayments = ({ campaign, invoice, isClubFlow, balancePayable, onPayNow, onDownloadInvoice, downloading }) => {
  const escrow = campaign.escrow;
  const milestones = campaign.milestones || [];

  if (isClubFlow || !escrow) {
    return (
      <section className="card p-6 sm:p-8 text-sm">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-3">
          <Wallet size={18} className="text-[#00AEEF]" /> Payments
        </h2>
        <p className="text-[#5B6478]">
          This project runs through club sponsorships: a flat finder&apos;s fee is charged when you award the contract to a club.
          Your receipts are on the <Link to="/company/treasury" className="text-[#0090C6] font-semibold hover:underline">Billing page</Link>.
        </p>
      </section>
    );
  }

  const budget = Number(campaign.budget);
  const teamShare = Number(campaign.student_pool);
  const outstanding = Number(escrow.outstanding);
  const payments = escrow.payments || [];
  const notStarted = campaign.status === 'OPEN' || (campaign.status === 'MATCHED' && payments.length === 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section className="card p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-1">
            <Wallet size={18} className="text-[#00AEEF]" /> What you pay
          </h2>
          <p className="text-sm text-[#5B6478] mb-3">One project fee covers everything. UniPact keeps a service fee and the rest goes to your student team.</p>
          <dl>
            <Line label={`UniPact service fee (${campaign.service_fee_percent}%)`} hint="Matching, project management and payment handling" value={formatMoney(budget - teamShare)} />
            <Line label="Your student team's share" hint="Released to them as you approve each milestone" value={formatMoney(teamShare)} />
            <Line label="Project fee" value={formatMoney(budget)} strong />
          </dl>
        </section>

        <section className="card p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-[#00AEEF]" /> Paid and held in escrow
          </h2>
          <p className="text-sm text-[#5B6478] mb-3">
            {notStarted
              ? 'Nothing is charged until you confirm your team. Your payment is then held by UniPact until you approve the work.'
              : 'Your payment is held by UniPact. Each time you approve a milestone, its share is released to the team.'}
          </p>
          <dl>
            <Line label="Paid so far" value={formatMoney(escrow.client_paid)} />
            <Line label="Still to pay" value={formatMoney(outstanding)} />
            <Line label="Released to your team" hint="For milestones you have approved" value={formatMoney(escrow.released)} />
            <Line label="Held for your team" hint="Paid in, waiting for milestones to be approved" value={formatMoney(escrow.available)} strong />
          </dl>
          {balancePayable && (
            <button type="button" onClick={onPayNow} className="btn-primary mt-4">
              <Wallet size={15} /> Pay {formatMoney(outstanding)} now
            </button>
          )}
        </section>

        {milestones.length > 0 && (
          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-lg font-bold mb-1">Release schedule</h2>
            <p className="text-sm text-[#5B6478] mb-4">How the team&apos;s {formatMoney(teamShare)} share is released, milestone by milestone.</p>
            <ul className="divide-y divide-[rgba(10,23,72,0.08)] text-sm">
              {milestones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="font-medium break-words">{m.step_number}. {m.title}</span>
                    <span className="block text-xs text-[#5B6478]">
                      {Number(m.percentage)}% of the team&apos;s share
                      {m.status === 'APPROVED' && m.approved_at && ` · released ${formatDate(m.approved_at)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-heading font-bold text-[#0B1E63]">{formatMoney(m.amount)}</span>
                    <span className={`badge ${
                      m.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : m.status === 'SUBMITTED' ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {m.status === 'APPROVED' ? 'Released' : m.status === 'SUBMITTED' ? 'Waiting for your approval' : 'Not released yet'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-6">
        {invoice && (
          <section className="card p-6 text-sm">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-3">
              <FileText size={18} className="text-[#00AEEF]" /> Open invoice
            </h2>
            <dl className="space-y-2">
              {[
                ['Invoice number', invoice.number],
                ['Amount', formatMoney(invoice.amount)],
                ['Due', formatDate(invoice.due_date)],
                ['Bank', invoice.bank_name],
                ['Account name', invoice.bank_account_name],
                ['Account number', invoice.bank_account_number],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-[#5B6478]">{label}</dt>
                  <dd className="font-semibold text-right break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={onDownloadInvoice} disabled={downloading} className="btn-secondary w-full mt-4">
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download invoice
            </button>
          </section>
        )}

        <section className="card p-6 text-sm">
          <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-3">
            <Receipt size={18} className="text-[#00AEEF]" /> Payments received
          </h2>
          {payments.length === 0 ? (
            <p className="text-[#5B6478]">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs text-[#5B6478]">{formatDateTime(p.created_at)}</span>
                    {p.reference && <span className="block text-xs text-[#5B6478] break-all">Ref {p.reference}</span>}
                    {p.is_test && <span className="badge bg-amber-50 border-amber-200 text-amber-800 mt-1">Test payment</span>}
                  </span>
                  <span className="font-semibold shrink-0">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-[#5B6478] mt-4 pt-4 border-t border-[rgba(10,23,72,0.08)]">
            Invoices and receipts for all your projects are on the <Link to="/company/treasury" className="text-[#0090C6] font-semibold hover:underline">Billing page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ProjectPayments;
