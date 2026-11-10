import React, { useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2, MessageSquare } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';
import { formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { downloadQuotation } from '../utils/invoices';
import { agreementRequiredBy } from '../utils/agreements';

// The client's view of UniPact's quotation: review the lines and payment terms, download the PDF, then
// accept it (with an optional purchase order) or ask for changes. Students are matched once it's accepted.
const QuotationCard = ({ campaign, onChanged, onAgreementRequired }) => {
  const { showToast } = useToast();
  const [modal, setModal] = useState(null); // 'accept' | 'changes'
  const [name, setName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poFile, setPoFile] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const quotation = (campaign.quotations || []).find((q) => q.status !== 'SUPERSEDED');
  if (!quotation) return null;

  if (quotation.status === 'ACCEPTED') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-[rgba(10,23,72,0.12)] text-sm">
        <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <span>
          You accepted quotation <strong>{quotation.number}</strong> ({formatMoney(quotation.total)}) on {formatDate(quotation.responded_at)}
          {quotation.po_number ? `, PO ${quotation.po_number}` : ''}.{' '}
          <button type="button" onClick={() => downloadQuotation(quotation)} className="text-[#00729F] underline">Download PDF</button>
        </span>
      </div>
    );
  }
  if (quotation.status === 'CHANGES_REQUESTED') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-[rgba(10,23,72,0.12)] text-sm">
        <MessageSquare size={18} className="text-[#00AEEF] shrink-0 mt-0.5" />
        <span>You asked for changes to quotation <strong>{quotation.number}</strong>. UniPact will send you a revised one.</span>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (modal === 'accept') {
        const form = new FormData();
        form.append('accepted_name', name.trim());
        form.append('po_number', poNumber.trim());
        if (poFile) form.append('po_document', poFile);
        await api.post(`/payments/quotations/${quotation.id}/accept/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        showToast('Quotation accepted. We\'ll pick your student team next.', 'success');
      } else {
        await api.post(`/payments/quotations/${quotation.id}/request-changes/`, { message });
        showToast('Thanks. UniPact will send you a revised quotation.', 'success');
      }
      setModal(null);
      onChanged?.();
    } catch (err) {
      if (agreementRequiredBy(err) && onAgreementRequired) {
        setModal(null);
        onAgreementRequired(agreementRequiredBy(err));
      } else {
        setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-white border-2 border-[#00AEEF] shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 text-sm">
          <FileText size={20} className="text-[#00AEEF] shrink-0 mt-0.5" />
          <div>
            <strong className="block text-base">Your quotation {quotation.number}: {formatMoney(quotation.total)}</strong>
            <span className="text-[#5B6478]">Valid until {formatDate(quotation.valid_until)}. Accept it and we&apos;ll pick your student team.</span>
          </div>
        </div>
        <button type="button" onClick={() => downloadQuotation(quotation).catch((err) => showToast(getErrorMessage(err, 'Could not download it.'), 'error'))} className="btn-secondary btn-sm self-start shrink-0">
          <Download size={13} /> PDF
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-[#5B6478] border-b border-[rgba(10,23,72,0.12)]">
          <tr><th className="text-left py-1.5 font-semibold">Description</th><th className="text-right py-1.5 font-semibold">Qty</th><th className="text-right py-1.5 font-semibold">Amount</th></tr>
        </thead>
        <tbody className="divide-y divide-[rgba(10,23,72,0.06)]">
          {quotation.line_items.map((line, i) => (
            <tr key={i}>
              <td className="py-1.5 pr-2">{line.description}</td>
              <td className="py-1.5 text-right">{Number(line.quantity)}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatMoney(Number(line.quantity) * Number(line.unit_price))}</td>
            </tr>
          ))}
          <tr><td className="pt-2 font-semibold" colSpan={2}>Total (no SST)</td><td className="pt-2 text-right font-heading font-bold text-[#0B1E63]">{formatMoney(quotation.total)}</td></tr>
        </tbody>
      </table>

      <p className="text-sm text-[#5B6478]">
        {quotation.payment_terms === 'MILESTONES'
          ? `Paid milestone by milestone: ${quotation.milestones.map((m) => `${m.title} (${Number(m.percentage)}%)`).join(', ')}. Each milestone is invoiced and paid before work on it starts.`
          : 'One payment of the full amount before work starts.'}
      </p>
      {quotation.scope_notes && <p className="text-sm whitespace-pre-line bg-[#F5F7FC] rounded-lg p-3">{quotation.scope_notes}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setError(''); setModal('accept'); }} className="btn-primary"><CheckCircle2 size={15} /> Accept quotation</button>
        <button type="button" onClick={() => { setError(''); setModal('changes'); }} className="btn-secondary"><MessageSquare size={15} /> Ask for changes</button>
      </div>

      <Modal isOpen={!!modal} onClose={() => !busy && setModal(null)} dismissible={!busy} maxWidth="max-w-md"
        title={modal === 'accept' ? `Accept ${quotation.number}` : 'Ask for changes'} subtitle={campaign.title} icon={<FileText size={20} />}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="alert-error"><span>{error}</span></div>}
          {modal === 'accept' ? (
            <>
              <p className="text-sm text-[#5B6478]">You agree to {formatMoney(quotation.total)} for this project, under the Client Service Agreement.</p>
              <div>
                <label className="field-label" htmlFor="q-name">Your full name</label>
                <input id="q-name" required minLength={3} value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="name" />
              </div>
              {campaign.company_org_type !== 'CLUB' && (<>
              <div>
                <label className="field-label" htmlFor="q-po">Purchase order (PO) number (optional)</label>
                <input id="q-po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="input font-mono" placeholder="PO-2026-0042" />
                <p className="field-hint">If your company issues POs. It appears on every invoice for this project.</p>
              </div>
              <div>
                <label className="field-label" htmlFor="q-po-file">PO document (optional)</label>
                <input id="q-po-file" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setPoFile(e.target.files?.[0] || null)} className="input file:mr-3 file:rounded file:border-0 file:bg-[#0B1E63] file:text-white file:px-3 file:py-1 file:text-xs" />
              </div>
              </>)}
            </>
          ) : (
            <div>
              <label className="field-label" htmlFor="q-changes">What would you like changed?</label>
              <textarea id="q-changes" required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="input" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} disabled={busy} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy && <Loader2 size={15} className="animate-spin" />} {modal === 'accept' ? 'Accept quotation' : 'Send'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default QuotationCard;
