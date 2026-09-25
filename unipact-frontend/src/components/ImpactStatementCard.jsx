import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileSignature, Loader2, Plus, X } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import { formatDate, getErrorMessage } from '../utils/format';

const EMPTY_METRIC = { value: '', label: '' };

// The signer is a person, so no default from the account: a company account's display name is the company itself
const toForm = (report) => ({
  business_pain_point: report.business_pain_point || '',
  client_industry: report.client_industry || '',
  metrics: report.metrics?.length ? report.metrics : [{ ...EMPTY_METRIC }],
  verified_skills: report.verified_skills || [],
  testimonial: report.testimonial || '',
  signer_name: report.signer_name || '',
  signer_title: report.signer_title || '',
});

// The client's side of each student's Verified Impact Ledger: the problem, the measured results,
// a testimonial, and a typed-name signature. Shown on completed student projects.
const ImpactStatementCard = ({ campaign }) => {
  const { showToast } = useToast();
  const [report, setReport] = useState(null);
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [signature, setSignature] = useState('');
  const [customSkill, setCustomSkill] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/campaigns/${campaign.id}/impact-report/`);
      setReport(res.data);
    } catch {
      setReport(null);
    }
  }, [campaign.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!report) return null;

  const signed = Boolean(report.signed_at);
  const suggestions = [...new Set([...(report.suggested_skills || []), ...(form?.verified_skills || [])])];

  const openForm = () => {
    setForm(toForm(report));
    setConsent(false);
    setSignature('');
    setError('');
    setOpen(true);
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setMetric = (i, field, value) => setForm((f) => ({ ...f, metrics: f.metrics.map((m, j) => (j === i ? { ...m, [field]: value } : m)) }));
  const toggleSkill = (skill) => setForm((f) => ({
    ...f,
    verified_skills: f.verified_skills.includes(skill) ? f.verified_skills.filter((s) => s !== skill) : [...f.verified_skills, skill],
  }));
  const addCustomSkill = () => {
    const skill = customSkill.trim();
    if (skill && !form.verified_skills.includes(skill)) setForm((f) => ({ ...f, verified_skills: [...f.verified_skills, skill] }));
    setCustomSkill('');
  };

  const save = async (sign) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.put(`/campaigns/${campaign.id}/impact-report/`, {
        ...form,
        metrics: form.metrics.filter((m) => m.value.trim() || m.label.trim()),
        sign,
        signature: sign ? signature : '',
      });
      setReport(res.data);
      setOpen(false);
      showToast(sign ? 'Impact statement signed. Thank you!' : 'Draft saved.', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the impact statement.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border ${signed ? 'border-[rgba(10,23,72,0.12)]' : 'border-2 border-[#00AEEF]'}`}>
        <div className="flex items-start gap-3 text-sm">
          {signed ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" /> : <FileSignature size={20} className="text-[#00AEEF] shrink-0 mt-0.5" />}
          <span>
            <strong className="block text-base">{signed ? 'Impact statement signed' : 'Confirm the impact of this project'}</strong>
            <span className="text-[#5B6478]">
              {signed
                ? `Signed ${formatDate(report.signed_at)}. It appears on your student team's Verified Impact Ledgers.`
                : "A few lines on the problem and the results you saw becomes the student's Verified Impact Ledger - the proof of work they'll show employers."}
            </span>
          </span>
        </div>
        {!report.locked && (
          <button onClick={openForm} className={`${signed ? 'btn-secondary' : 'btn-primary'} self-start sm:self-auto shrink-0 whitespace-nowrap`}>
            <FileSignature size={15} /> {signed ? 'Edit statement' : 'Write impact statement'}
          </button>
        )}
      </div>

      <Modal
        isOpen={open}
        onClose={() => !saving && setOpen(false)}
        title="Impact statement"
        subtitle={campaign.title}
        icon={<FileSignature size={20} />}
        maxWidth="max-w-2xl"
      >
        {form && (
          <div className="space-y-5">
            {error && <div className="alert-error"><span>{error}</span></div>}

            <div>
              <label className="field-label" htmlFor="is-pain">What problem did this project solve for your business?</label>
              <textarea id="is-pain" rows={3} value={form.business_pain_point} onChange={set('business_pain_point')} className="input"
                placeholder="e.g. 44 sales agents were manually typing WhatsApp scripts and sorting invalid phone numbers in Excel." />
            </div>

            <div>
              <span className="field-label">Measured results (up to 2)</span>
              <p className="field-hint mb-2">Numbers you're comfortable standing behind. The student's project fee is added automatically.</p>
              <div className="space-y-2">
                {form.metrics.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={m.value} onChange={(e) => setMetric(i, 'value', e.target.value)} maxLength={20} placeholder="14 Hrs" aria-label={`Metric ${i + 1} value`} className="input w-32 shrink-0" />
                    <input value={m.label} onChange={(e) => setMetric(i, 'label', e.target.value)} maxLength={60} placeholder="Saved per agent / week" aria-label={`Metric ${i + 1} label`} className="input flex-1" />
                    {form.metrics.length > 1 && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, metrics: f.metrics.filter((_, j) => j !== i) }))} className="p-2 text-[#5B6478] hover:text-red-600" aria-label="Remove metric"><X size={15} /></button>
                    )}
                  </div>
                ))}
              </div>
              {form.metrics.length < 2 && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, metrics: [...f.metrics, { ...EMPTY_METRIC }] }))} className="btn-secondary btn-sm mt-2"><Plus size={13} /> Add a result</button>
              )}
            </div>

            <div>
              <span className="field-label">Skills the student demonstrated</span>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((skill) => (
                  <button key={skill} type="button" onClick={() => toggleSkill(skill)} aria-pressed={form.verified_skills.includes(skill)}
                    className={`px-3 py-1 rounded-md text-sm border ${form.verified_skills.includes(skill) ? 'bg-[#00AEEF]/10 border-[#00AEEF] text-[#0090C6] font-semibold' : 'bg-white border-[rgba(10,23,72,0.12)]'}`}>
                    {skill}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                  placeholder="Add another skill" aria-label="Add another skill" className="input flex-1" />
                <button type="button" onClick={addCustomSkill} className="btn-secondary btn-sm">Add</button>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="is-quote">Testimonial</label>
              <textarea id="is-quote" rows={3} maxLength={600} value={form.testimonial} onChange={set('testimonial')} className="input"
                placeholder="What difference did the student's work make?" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="field-label" htmlFor="is-name">Your full name</label>
                <input id="is-name" value={form.signer_name} onChange={set('signer_name')} placeholder="Mohd Faizal bin Mohd Zahari" className="input" />
              </div>
              <div>
                <label className="field-label" htmlFor="is-title">Job title</label>
                <input id="is-title" value={form.signer_title} onChange={set('signer_title')} placeholder="Loan Consultant" className="input" />
              </div>
              <div>
                <label className="field-label" htmlFor="is-industry">Industry (optional)</label>
                <input id="is-industry" value={form.client_industry} onChange={set('client_industry')} placeholder="Financial & Credit" className="input" />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] space-y-3">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#00AEEF]" />
                <span>I confirm these results are accurate and agree to UniPact publishing them, with my name and testimonial, on the student&apos;s public Verified Impact Ledger.</span>
              </label>
              <div>
                <label className="field-label" htmlFor="is-sign">Type your full name to sign</label>
                <input id="is-sign" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={form.signer_name} className="input font-signature text-2xl" />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button type="button" onClick={() => save(false)} disabled={saving} className="btn-secondary">Save draft</button>
              <button type="button" onClick={() => save(true)} disabled={saving || !consent || !signature.trim()} className="btn-primary">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />} Sign &amp; submit
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default ImpactStatementCard;
