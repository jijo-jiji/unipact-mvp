import React, { useState } from 'react';
import { CreditCard, Lock, CheckCircle2, Loader2, Info } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { formatMoney, getErrorMessage } from '../utils/format';

const PaymentModal = ({ isOpen, onClose, amount, description, onSuccess, campaignId, type = 'FINDERS_FEE' }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('payment'); // 'payment' | 'success'
  const [error, setError] = useState('');
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const reset = () => {
    setStep('payment');
    setError('');
    setCardNum('');
    setExpiry('');
    setCvc('');
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleCardChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardNum(digits.replace(/(.{4})/g, '$1 ').trim());
  };

  const handleExpiryChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  };

  const handlePayment = async (e) => {
    e?.preventDefault();
    setError('');

    if (cardNum.replace(/\s/g, '').length < 16) return setError('Please enter the full 16-digit card number.');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return setError('Please enter the expiry date as MM/YY.');
    if (cvc.length < 3) return setError('Please enter the 3 or 4 digit security code.');

    setLoading(true);
    try {
      const intentRes = await api.post('/payments/create-intent/', { amount, type, campaign_id: campaignId });
      const { transactionId } = intentRes.data;
      // Simulated gateway charge, then server-side confirmation
      await api.post(`/payments/mock-checkout/${transactionId}/`);
      await api.post(`/payments/confirm/${transactionId}/`);

      setStep('success');
      setTimeout(() => {
        reset();
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err, 'Payment failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      dismissible={!loading}
      maxWidth="max-w-md"
      title={step === 'payment' ? 'Secure checkout' : undefined}
      subtitle={step === 'payment' ? 'Payments are processed by UniPact Pay' : undefined}
      icon={step === 'payment' ? <CreditCard size={20} /> : undefined}
    >
      {step === 'payment' ? (
        <>
          <div className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 mb-5 flex items-center justify-between gap-4">
            <span className="text-sm text-[#5B6478]">{description}</span>
            <span className="font-heading font-bold text-xl text-[#0B1E63] whitespace-nowrap">{formatMoney(amount)}</span>
          </div>

          <div className="flex items-start gap-2 text-xs text-[#5B6478] bg-[#00AEEF]/5 border border-[#00AEEF]/20 rounded-md p-2.5 mb-5">
            <Info size={14} className="text-[#00AEEF] shrink-0 mt-0.5" />
            Demo mode: no real money is charged. Use any card, e.g. 4242 4242 4242 4242.
          </div>

          {error && (
            <div className="alert-error mb-4">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePayment} className="space-y-4" noValidate>
            <div>
              <label className="field-label" htmlFor="card-number">Card number</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478]" size={16} />
                <input id="card-number" inputMode="numeric" autoComplete="off" placeholder="1234 5678 9012 3456" value={cardNum} onChange={handleCardChange} className="input pl-10 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="card-expiry">Expiry</label>
                <input id="card-expiry" inputMode="numeric" autoComplete="off" placeholder="MM/YY" value={expiry} onChange={handleExpiryChange} className="input font-mono" />
              </div>
              <div>
                <label className="field-label" htmlFor="card-cvc">CVC</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478]" size={14} />
                  <input id="card-cvc" inputMode="numeric" autoComplete="off" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} className="input pl-9 font-mono" />
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <><Loader2 className="animate-spin" size={16} /> Processing…</> : <>Pay {formatMoney(amount)}</>}
            </button>
          </form>
        </>
      ) : (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="font-heading font-bold text-xl text-[#0A1748] mb-1">Payment successful</h2>
          <p className="text-sm text-[#5B6478]">{formatMoney(amount)} paid for {description}.</p>
        </div>
      )}
    </Modal>
  );
};

export default PaymentModal;
