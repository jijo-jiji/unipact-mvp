import React, { useState } from 'react';
import { X, CreditCard, Lock, CheckCircle, Loader } from 'lucide-react';
import api from '../api/client';

const PaymentModal = ({ isOpen, onClose, amount, description, onSuccess, campaignId, type = 'FINDERS_FEE' }) => {
    // 2. State Hooks
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('payment'); // 'payment' | 'success'

    // Input State
    const [cardNum, setCardNum] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');

    // 1. Modal Visibility Check
    if (!isOpen) return null;

    // 3. Formatting Helpers
    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || "";
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(" ");
        } else {
            return value;
        }
    };

    // 4. Input Handlers
    const handleCardChange = (e) => {
        const val = e.target.value.replace(/[^0-9\s]/g, '');
        if (val.length <= 19) { // 16 digits + 3 spaces
            setCardNum(formatCardNumber(val));
        }
    };

    const handleExpiryChange = (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 2) {
            val = val.substring(0, 2) + '/' + val.substring(2, 4);
        }
        if (val.length <= 5) setExpiry(val);
    };

    const handleCvcChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length <= 4) setCvc(val);
    };

    // 5. Payment Logic
    const handlePayment = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        setLoading(true);

        try {
            // Create Intent
            const intentRes = await api.post('/payments/create-intent/', {
                amount: amount,
                type: type,
                campaign_id: campaignId // Optional, passed if meaningful
            });
            const { transactionId } = intentRes.data;

            // Simulate Network Delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Confirm
            await api.post(`/payments/confirm/${transactionId}/`);

            // Success Transition
            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
                setStep('payment'); // Reset Step
                setCardNum('');
                setExpiry('');
                setCvc('');
            }, 2000);

        } catch (error) {
            console.error("Payment Failed", error);
            alert("Payment Failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGooglePay = () => {
        // Mock Google Pay Flow
        setLoading(true);
        setTimeout(() => {
            handlePayment(null, true);
        }, 1500);
    };

    // 6. Render
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] w-full max-w-md relative p-6 shadow-[0_0_50px_rgba(160,32,240,0.2)]">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Step: PAYMENT FORM */}
                {step === 'payment' && (
                    <>
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-[var(--text-gold)]/10 text-[var(--text-gold)] rounded-full flex items-center justify-center mx-auto mb-3 border border-[var(--text-gold)]">
                                <CreditCard size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Secure Checkout</h2>
                            <p className="text-[var(--text-blue)] text-xs mt-1">UniPact Secure Payment Gateway</p>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-black/30 p-4 border border-[var(--border-tech)] mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400 text-xs uppercase">Item</span>
                                <span className="text-white text-sm font-bold">{description}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-xs uppercase">Total</span>
                                <span className="text-[var(--text-gold)] text-xl font-display font-bold">RM {amount}</span>
                            </div>
                        </div>

                        {/* Quick Pay (Google Pay) */}
                        <button
                            type="button"
                            onClick={handleGooglePay}
                            disabled={loading}
                            className="w-full bg-white text-black font-bold py-2.5 mb-4 rounded flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.15v3.11C3.17 21.4 7.23 24 12 24z" /><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.5-.38-2.29s.14-1.57.38-2.29V6.6H1.15C.42 8.07 0 9.99 0 12c0 2.01.42 3.93 1.15 5.4l4.12-3.11z" /><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.59 1.15 6.6l4.12 3.11c.95-2.85 3.6-4.96 6.73-4.96z" /></svg>
                            Pay with Google
                        </button>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-px bg-gray-700 flex-1"></div>
                            <span className="text-gray-500 text-xs text-center">OR PAY WITH CARD</span>
                            <div className="h-px bg-gray-700 flex-1"></div>
                        </div>

                        {/* Credit Card Form */}
                        <form onSubmit={handlePayment} className="space-y-4">
                            <div>
                                <label className="block text-[var(--text-blue)] text-xs uppercase mb-1">Card Number</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-3 text-gray-500" size={16} />
                                    <input
                                        type="text"
                                        placeholder="0000 0000 0000 0000"
                                        value={cardNum}
                                        onChange={handleCardChange}
                                        className="w-full bg-black border border-[var(--border-tech)] text-white py-2.5 pl-10 pr-4 focus:border-[var(--text-gold)] focus:outline-none placeholder-gray-700 font-mono"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[var(--text-blue)] text-xs uppercase mb-1">Expiry</label>
                                    <input
                                        type="text"
                                        placeholder="MM/YY"
                                        value={expiry}
                                        onChange={handleExpiryChange}
                                        className="w-full bg-black border border-[var(--border-tech)] text-white py-2.5 px-4 focus:border-[var(--text-gold)] focus:outline-none placeholder-gray-700 font-mono"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[var(--text-blue)] text-xs uppercase mb-1">CVC</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-gray-500" size={16} />
                                        <input
                                            type="text"
                                            placeholder="123"
                                            value={cvc}
                                            onChange={handleCvcChange}
                                            className="w-full bg-black border border-[var(--border-tech)] text-white py-2.5 pl-10 pr-4 focus:border-[var(--text-gold)] focus:outline-none placeholder-gray-700 font-mono"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[var(--text-gold)] text-black font-bold py-3 uppercase tracking-wider hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2 mt-2"
                            >
                                {loading && <Loader className="animate-spin" size={16} />}
                                {loading ? 'Processing...' : `Pay RM ${amount}`}
                            </button>
                        </form>
                    </>
                )}

                {/* Step: SUCCESS */}
                {step === 'success' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500">
                            <CheckCircle size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-wider mb-2">Payment Successful</h2>
                        <p className="text-gray-400 text-sm">Transaction Complete. Funds Transferred.</p>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PaymentModal;
