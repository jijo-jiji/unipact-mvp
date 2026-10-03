import React, { useState } from 'react';
import { Landmark, Loader2, Lock, FileText } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { formatMoney, getErrorMessage } from '../utils/format';
import { agreementRequiredBy } from '../utils/agreements';

// Pays a project fee through ToyyibPay (FPX online banking). The server works out what is owed and opens
// the bill; this collects a phone number for the FPX receipt and sends the client to their bank.
// With allowPartial (a project that has already started, e.g. a client who pays monthly) the client may
// pay part of the balance; the server caps the amount at what is outstanding.
const OnlinePaymentModal = ({ isOpen, onClose, campaign, amount, testMode, allowPartial = false, onlineAvailable = true, onPaid, onInvoiceRequested, onAgreementRequired }) => {
  const [phone, setPhone] = useState('');
  const [customAmount, setCustomAmount] = useState(null); // null = pay the whole balance
  const [busy, setBusy] = useState(null); // 'pay' | 'invoice'
  const [error, setError] = useState('');

  const balance = Number(amount) || 0;
  const payAmount = customAmount ?? String(balance);
  const payValue = Number(payAmount);
  const amountValid = !allowPartial || (payValue >= 1 && payValue <= balance);

  const close = () => {
    if (busy) return;
    setError('');
    setCustomAmount(null);
    onClose();
  };

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('pay');
    try {
      const res = await api.post('/payments/toyyibpay/bill/', {
        campaign_id: campaign.id, phone, ...(allowPartial ? { amount: payValue.toFixed(2) } : {}),
      });
      if (res.data.payment_url) {
        window.location.assign(res.data.payment_url);
        return; // keep the spinner while the bank page loads
      }
      onPaid?.(); // an earlier payment already covered it
    } catch (err) {
      // The Client Service Agreement comes first: the page asks for it, then the client can pay
      if (agreementRequiredBy(err) && onAgreementRequired) onAgreementRequired(agreementRequiredBy(err));
      else setError(getErrorMessage(err, 'Could not start the payment. Please try again.'));
    }
    setBusy(null);
  };

  const requestInvoice = async () => {
    setError('');
    setBusy('invoice');
    try {
      const res = await api.post(`/payments/campaigns/${campaign.id}/request-invoice/`);
      onInvoiceRequested?.({ amount: res.data.outstanding ?? amount, invoice: res.data.invoice });
    } catch (err) {
      if (agreementRequiredBy(err) && onAgreementRequired) onAgreementRequired(agreementRequiredBy(err));
      else setError(getErrorMessage(err, 'Could not request an invoice. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} dismissible={!busy} maxWidth="max-w-md"
      title={allowPartial ? 'Pay towards this project' : 'Pay the project fee'} subtitle={campaign?.title} icon={<Landmark size={20} />}>
      <form onSubmit={pay} className="space-y-5">
        {error && <div className="alert-error"><span>{error}</span></div>}
        {testMode && onlineAvailable && (
          <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <strong>Test mode.</strong> This uses ToyyibPay&apos;s sandbox bank: no real money moves, and the payment is marked TEST.
          </p>
        )}

        <div className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 flex items-center justify-between gap-4">
          <span className="text-sm text-[#5B6478]">{allowPartial ? 'Balance outstanding' : 'Amount due'}</span>
          <strong className="font-heading text-2xl text-[#0B1E63]">{formatMoney(amount)}</strong>
        </div>
        <p className="text-sm text-[#5B6478]">
          Held in escrow. UniPact keeps its {campaign?.service_fee_percent}% service fee and releases the rest to your student team as you approve each milestone.
        </p>

        {onlineAvailable && (
          <>
            {allowPartial && (
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label className="field-label" htmlFor="fpx-amount">Amount to pay now (RM)</label>
                  {payValue !== balance && (
                    <button type="button" onClick={() => setCustomAmount(null)} className="text-xs font-semibold text-[#0090C6] hover:underline">Pay in full</button>
                  )}
                </div>
                <input id="fpx-amount" type="number" inputMode="decimal" min="1" max={balance} step="0.01" value={payAmount}
                  onChange={(e) => setCustomAmount(e.target.value)} className="input" required />
                {!amountValid && <p className="text-xs text-red-700 mt-1">Enter an amount between RM 1 and {formatMoney(balance)}.</p>}
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="fpx-phone">Phone number</label>
              <input id="fpx-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="0123456789" className="input" required />
              <p className="field-hint">For your FPX payment receipt.</p>
            </div>

            <button type="submit" disabled={!!busy || !phone.trim() || !amountValid} className="btn-primary w-full py-3">
              {busy === 'pay' ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {allowPartial && amountValid ? `Pay ${formatMoney(payValue)} with FPX` : 'Pay with FPX online banking'}
            </button>
            <p className="text-xs text-center text-[#5B6478] -mt-2">
              Personal and corporate online banking via ToyyibPay. You&apos;ll return here once your bank confirms.
            </p>
          </>
        )}

        <div className={`${onlineAvailable ? 'pt-4 border-t border-[rgba(10,23,72,0.08)]' : ''} text-center`}>
          <button type="button" onClick={requestInvoice} disabled={!!busy} className={onlineAvailable ? 'btn-secondary btn-sm' : 'btn-primary w-full py-3'}>
            {busy === 'invoice' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            {onlineAvailable ? 'Pay by bank transfer instead' : 'Email me an invoice for bank transfer'}
          </button>
          <p className="text-xs text-[#5B6478] mt-2">
            We&apos;ll email you an invoice{allowPartial ? ' for the full balance' : ''} with UniPact&apos;s bank details.
          </p>
        </div>
      </form>
    </Modal>
  );
};

export default OnlinePaymentModal;
