import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Loader2, Plus, Send, X } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import StatusBadge from './StatusBadge';
import { formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { downloadQuotation } from '../utils/invoices';

const STATUS_LABELS = { DRAFT: 'Draft', SENT: 'Sent', ACCEPTED: 'Accepted', CHANGES_REQUESTED: 'Changes asked', SUPERSEDED: 'Replaced' };
const inTwoWeeks = () => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
const emptyForm = () => ({
  lines: [{ description: '', quantity: '1', unit_price: '' }],
  payment_terms: 'SINGLE',
  milestones: [{ title: 'Design', percentage: '40' }, { title: 'Build and launch', percentage: '60' }],
  valid_until: inTwoWeeks(),
  scope_notes: '',
});

// Admins price a project after meeting the client, before matching students: write a quotation, send it,
// see the client's answer (accepted with a PO, or asking for changes), and write a revision if needed.
const AdminQuotationPanel = ({ campaign, onQuotationsLoaded }) => {
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState([]);
  const [form, setForm] = useState(null); // null = not writing one
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/campaigns/${campaign.id}/`);
      setQuotations(res.data.quotations || []);
      onQuotationsLoaded?.(res.data.quotations || []);
    } catch {
      setQuotations([]);
    }
  }, [campaign.id, onQuotationsLoaded]);

  useEffect(() => { load(); }, [load]);

  if (campaign.is_volunteer || campaign.is_match_finalized) return null;

  const total = form ? form.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0) : 0;
  const milestoneTotal = form ? form.milestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0) : 0;
  const setLine = (i, field, value) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [field]: value } : l)) }));
  const setMilestone = (i, field, value) => setForm((f) => ({ ...f, milestones: f.milestones.map((m, j) => (j === i ? { ...m, [field]: value } : m)) }));

  const save = async (send) => {
    setBusy(send ? 'send' : 'save');
    try {
      await api.post('/payments/quotations/', {
        campaign_id: campaign.id,
        line_items: form.lines,
        payment_terms: form.payment_terms,
        milestones: form.payment_terms === 'MILESTONES' ? form.milestones : [],
        valid_until: form.valid_until,
        scope_notes: form.scope_notes,
        send,
      });
      showToast(send ? 'Quotation sent to the client.' : 'Draft saved.', 'success');
      setForm(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not save the quotation.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const sendDraft = async (quotation) => {
    setBusy(`send-${quotation.id}`);
    try {
      await api.post(`/payments/quotations/${quotation.id}/send/`);
      showToast('Quotation sent to the client.', 'success');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not send the quotation.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const accepted = quotations.find((q) => q.status === 'ACCEPTED');
  const open = quotations.find((q) => ['DRAFT', 'SENT', 'CHANGES_REQUESTED'].includes(q.status));

  return (
    <div className="pt-4 border-t border-[rgba(10,23,72,0.08)] space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="font-semibold flex items-center gap-2"><FileText size={15} className="text-[#00AEEF]" /> Quotation</h3>
        {!form && !accepted && (
          <button type="button" onClick={() => setForm(emptyForm())} className="btn-secondary btn-sm">
            <Plus size={13} /> {open ? 'Write a revision' : 'New quotation'}
          </button>
        )}
      </div>
      {!accepted && !form && (
        <p className="text-xs text-[#5B6478]">After meeting the client, send them a quotation. Students can be matched once the client accepts it.</p>
      )}

      {quotations.filter((q) => q.status !== 'SUPERSEDED').map((q) => (
        <div key={q.id} className="p-3 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] text-sm space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{q.number || 'Draft'} · {formatMoney(q.total)} · {q.payment_terms === 'MILESTONES' ? 'by milestone' : 'one payment'}</span>
            <StatusBadge status={q.status === 'ACCEPTED' ? 'APPROVED' : q.status === 'CHANGES_REQUESTED' ? 'REVISION_REQUESTED' : 'PENDING'} label={STATUS_LABELS[q.status]} />
          </div>
          {q.status === 'ACCEPTED' && (
            <p className="text-xs text-[#5B6478]">Accepted by {q.accepted_name} on {formatDate(q.responded_at)}{q.po_number ? ` · PO ${q.po_number}` : ' · no PO'}
              {q.po_document && <> · <a href={q.po_document} target="_blank" rel="noreferrer" className="text-[#00729F] underline">PO document</a></>}</p>
          )}
          {q.status === 'CHANGES_REQUESTED' && <p className="text-xs text-amber-800">Client asked: &ldquo;{q.change_request}&rdquo;</p>}
          {q.status === 'SENT' && <p className="text-xs text-[#5B6478]">Sent {formatDate(q.sent_at)}, valid until {formatDate(q.valid_until)}. Waiting for the client.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => downloadQuotation(q).catch((err) => showToast(getErrorMessage(err, 'Could not download it.'), 'error'))} className="btn-secondary btn-sm">
              <Download size={13} /> PDF
            </button>
            {q.status === 'DRAFT' && (
              <button type="button" onClick={() => sendDraft(q)} disabled={!!busy} className="btn-primary btn-sm">
                {busy === `send-${q.id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to client
              </button>
            )}
          </div>
        </div>
      ))}

      {form && (
        <div className="p-4 rounded-lg border border-[#00AEEF]/40 bg-white space-y-4">
          <div className="space-y-2">
            <p className="field-label">Lines</p>
            {form.lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_auto] gap-2 items-center">
                <input value={line.description} onChange={(e) => setLine(i, 'description', e.target.value)} placeholder="e.g. Booking website" aria-label={`Line ${i + 1} description`} className="input" />
                <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} aria-label={`Line ${i + 1} quantity`} className="input" />
                <input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} placeholder="RM" aria-label={`Line ${i + 1} unit price`} className="input" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))} disabled={form.lines.length === 1} className="p-2 text-[#5B6478] hover:text-red-700 disabled:opacity-30" aria-label="Remove line"><X size={15} /></button>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { description: '', quantity: '1', unit_price: '' }] }))} className="btn-secondary btn-sm"><Plus size={13} /> Add a line</button>
              <span className="text-sm">Total <strong className="text-[#0B1E63]">{formatMoney(total)}</strong> <span className="text-xs text-[#5B6478]">(no SST)</span></span>
            </div>
          </div>

          <fieldset>
            <legend className="field-label">Payment</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={form.payment_terms === 'SINGLE'} onChange={() => setForm((f) => ({ ...f, payment_terms: 'SINGLE' }))} className="accent-[#00AEEF]" /> One payment before work starts (small jobs)</label>
              <label className="flex items-center gap-2"><input type="radio" checked={form.payment_terms === 'MILESTONES'} onChange={() => setForm((f) => ({ ...f, payment_terms: 'MILESTONES' }))} className="accent-[#00AEEF]" /> Milestone by milestone</label>
            </div>
          </fieldset>

          {form.payment_terms === 'MILESTONES' && (
            <div className="space-y-2">
              {form.milestones.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_5.5rem_auto] gap-2 items-center">
                  <input value={m.title} onChange={(e) => setMilestone(i, 'title', e.target.value)} placeholder={`Milestone ${i + 1}`} aria-label={`Milestone ${i + 1} title`} className="input" />
                  <input type="number" min="0.01" step="0.01" value={m.percentage} onChange={(e) => setMilestone(i, 'percentage', e.target.value)} aria-label={`Milestone ${i + 1} percentage`} className="input" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, milestones: f.milestones.filter((_, j) => j !== i) }))} disabled={form.milestones.length <= 2} className="p-2 text-[#5B6478] hover:text-red-700 disabled:opacity-30" aria-label="Remove milestone"><X size={15} /></button>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <button type="button" onClick={() => setForm((f) => ({ ...f, milestones: [...f.milestones, { title: '', percentage: '' }] }))} className="btn-secondary btn-sm"><Plus size={13} /> Add a milestone</button>
                <span className={`text-sm font-medium ${Math.round(milestoneTotal * 100) / 100 === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>{Math.round(milestoneTotal * 100) / 100}% of 100%</span>
              </div>
              <p className="field-hint">Each milestone is invoiced, and must be paid, before work on it starts.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="q-valid">Valid until</label>
              <input id="q-valid" type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} className="input" />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="q-scope">Scope and notes (shown on the quotation)</label>
            <textarea id="q-scope" rows={3} value={form.scope_notes} onChange={(e) => setForm((f) => ({ ...f, scope_notes: e.target.value }))} className="input" placeholder="What's included, what's not, assumptions agreed in the meeting" />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} disabled={!!busy} className="btn-secondary btn-sm">Cancel</button>
            <button type="button" onClick={() => save(false)} disabled={!!busy} className="btn-secondary btn-sm">{busy === 'save' && <Loader2 size={13} className="animate-spin" />} Save draft</button>
            <button type="button" onClick={() => save(true)} disabled={!!busy} className="btn-primary btn-sm">{busy === 'send' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to client</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuotationPanel;
