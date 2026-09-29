import React, { useState } from 'react';
import { Landmark, Loader2, Lock, FileText } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { formatMoney, getErrorMessage } from '../utils/format';

// Pays a project fee through ToyyibPay (FPX online banking). The server works out the amount and opens
// the bill; this only collects a phone number for the FPX receipt and sends the client to their bank.
const OnlinePaymentModal = ({ isOpen, onClose, campaign, amount, onPaid, onInvoiceRequested }) => {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(null); // 'pay' | 'invoice'
  const [error, setError] = useState('');

  const close = () => {
    if (busy) return;
    setError('');
    onClose();
  };

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('pay');
    try {
      const res = await api.post('/payments/toyyibpay/bill/', { campaign_id: campaign.id, phone });
      if (res.data.payment_url) {
        window.location.assign(res.data.payment_url);
        return; // keep the spinner while the bank page loads
      }
      onPaid?.(); // an earlier payment already covered it
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start the payment. Please try again.'));
    }
    setBusy(null);
  };

  const requestInvoice = async () => {
    setError('');
    setBusy('invoice');
    try {
      const res = await api.post(`/payments/campaigns/${campaign.id}/request-invoice/`);
      onInvoiceRequested?.(res.data.outstanding ?? amount);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not request an invoice. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} dismissible={!busy} maxWidth="max-w-md"
      title="Pay the project fee" subtitle={campaign?.title} icon={<Landmark size={20} />}>
      <form onSubmit={pay} className="space-y-5">
        {error && <div className="alert-error"><span>{error}</span></div>}

        <div className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 flex items-center justify-between gap-4">
          <span className="text-sm text-[#5B6478]">Amount due</span>
          <strong className="font-heading text-2xl text-[#0B1E63]">{formatMoney(amount)}</strong>
        </div>
        <p className="text-sm text-[#5B6478]">
          Held in escrow. UniPact keeps its {campaign?.service_fee_percent}% service fee and releases the rest to your student team as you approve each milestone.
        </p>

        <div>
          <label className="field-label" htmlFor="fpx-phone">Phone number</label>
          <input id="fpx-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="0123456789" className="input" required />
          <p className="field-hint">For your FPX payment receipt.</p>
        </div>

        <button type="submit" disabled={!!busy || !phone.trim()} className="btn-primary w-full py-3">
          {busy === 'pay' ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Pay with FPX online banking
        </button>
        <p className="text-xs text-center text-[#5B6478] -mt-2">
          Personal and corporate online banking via ToyyibPay. You&apos;ll return here once your bank confirms.
        </p>

        <div className="pt-4 border-t border-[rgba(10,23,72,0.08)] text-center">
          <button type="button" onClick={requestInvoice} disabled={!!busy} className="btn-secondary btn-sm">
            {busy === 'invoice' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Pay by bank transfer instead
          </button>
          <p className="text-xs text-[#5B6478] mt-2">We&apos;ll email you an invoice, usually within one business day.</p>
        </div>
      </form>
    </Modal>
  );
};

export default OnlinePaymentModal;
