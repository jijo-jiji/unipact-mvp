import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, Clock, ExternalLink, Eye, ImagePlus, Loader2, Send } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import { getErrorMessage } from '../utils/format';

const WAITING_ON = [
  ['client_signed', 'Client signs the impact statement'],
  ['student_submitted', 'You submit your part'],
  ['escrow_released', 'Your payout is disbursed'],
];

const ImageField = ({ id, label, current, file, onFile, onRemove, caption, onCaption, captionPlaceholder }) => {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const src = preview || current;

  return (
  <div className="space-y-2">
    <label className="field-label" htmlFor={id}>{label}</label>
    {src && (
      <div className="aspect-[16/10] rounded-lg border border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] overflow-hidden">
        <img src={src} alt="" className="w-full h-full object-contain" />
      </div>
    )}
    <input id={id} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0] || null)}
      className="input text-xs file:mr-2 file:rounded file:border-0 file:bg-[#0B1E63] file:text-white file:px-2.5 file:py-1 file:text-xs" />
    {current && !file && <button type="button" onClick={onRemove} className="text-xs text-red-700 hover:underline">Remove image</button>}
    <input value={caption} onChange={(e) => onCaption(e.target.value)} maxLength={150} placeholder={captionPlaceholder} aria-label={`${label} caption`} className="input" />
  </div>
  );
};

// A student's Verified Impact Ledger for one completed project: status, and the form for their part
const ImpactLedgerPanel = ({ campaignId }) => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData((await api.get(`/campaigns/${campaignId}/my-ledger/`)).data);
    } catch {
      setData(null);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;

  const { ledger, prefill } = data;
  const published = ledger.status === 'PUBLISHED';
  const submitted = Boolean(data.student_submitted_at);

  const openForm = () => {
    setForm({
      role: data.role || prefill.role || '',
      technical_solution: data.technical_solution || prefill.technical_solution || '',
      proof_url: data.proof_url || prefill.proof_url || '',
      before_caption: data.before_caption || '',
      after_caption: data.after_caption || '',
      before_file: null,
      after_file: null,
      remove_before_image: false,
      remove_after_image: false,
    });
    setError('');
    setOpen(true);
  };

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const save = async (submit) => {
    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      ['role', 'technical_solution', 'proof_url', 'before_caption', 'after_caption'].forEach((k) => body.append(k, form[k].trim()));
      if (form.before_file) body.append('before_image', form.before_file);
      if (form.after_file) body.append('after_image', form.after_file);
      body.append('remove_before_image', form.remove_before_image);
      body.append('remove_after_image', form.remove_after_image);
      body.append('submit', submit);
      const res = await api.put(`/campaigns/${campaignId}/my-ledger/`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setData(res.data);
      setOpen(false);
      showToast(submit ? 'Submitted. UniPact publishes your ledger once your client has signed and your payout is out.' : 'Draft saved.', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your ledger.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 text-sm">
          <Award size={20} className={`${published ? 'text-emerald-600' : 'text-[#00AEEF]'} shrink-0 mt-0.5`} />
          <div>
            <strong className="block">{published ? 'Verified Impact Ledger published' : 'Verified Impact Ledger'}</strong>
            {published ? (
              <span className="text-[#5B6478]">Your client-confirmed proof of work is live. Share it on your CV and LinkedIn.</span>
            ) : (
              <ul className="text-[#5B6478] mt-1 space-y-0.5">
                {WAITING_ON.map(([key, label]) => (
                  <li key={key} className="flex items-center gap-1.5 text-xs">
                    {ledger.readiness[key] ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Clock size={13} className="text-amber-600" />} {label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {published ? (
            <Link to={`/ledger/${ledger.slug}`} className="btn-primary btn-sm"><ExternalLink size={13} /> View ledger</Link>
          ) : (
            <>
              <Link to={`/ledger/${ledger.slug}`} className="btn-secondary btn-sm"><Eye size={13} /> Preview</Link>
              <button onClick={openForm} className="btn-primary btn-sm">
                <ImagePlus size={13} /> {submitted ? 'Edit your part' : 'Add your part'}
              </button>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={() => !saving && setOpen(false)}
        title="Build your impact ledger"
        subtitle={`${ledger.project.title} · ${ledger.project.client_name}`}
        icon={<Award size={20} />}
        maxWidth="max-w-2xl"
      >
        {form && (
          <div className="space-y-5">
            {error && <div className="alert-error"><span>{error}</span></div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="lg-role">Your role</label>
                <input id="lg-role" value={form.role} onChange={(e) => set('role')(e.target.value)} maxLength={150} placeholder="Solo Full-Stack Developer" className="input" />
              </div>
              <div>
                <label className="field-label" htmlFor="lg-url">Project link (optional)</label>
                <input id="lg-url" type="url" value={form.proof_url} onChange={(e) => set('proof_url')(e.target.value)} placeholder="https://github.com/…" className="input" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="lg-solution">What you built</label>
              <textarea id="lg-solution" rows={4} value={form.technical_solution} onChange={(e) => set('technical_solution')(e.target.value)} className="input"
                placeholder="e.g. Built a web dashboard that scrubs broken phone numbers and lets agents send personalised WhatsApp/SMS pitches in one click." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageField id="lg-before" label="Before screenshot" current={form.remove_before_image ? null : data.before_image} file={form.before_file}
                onFile={set('before_file')} onRemove={() => set('remove_before_image')(true)}
                caption={form.before_caption} onCaption={set('before_caption')} captionPlaceholder="Manual Excel distribution" />
              <ImageField id="lg-after" label="After screenshot" current={form.remove_after_image ? null : data.after_image} file={form.after_file}
                onFile={set('after_file')} onRemove={() => set('remove_after_image')(true)}
                caption={form.after_caption} onCaption={set('after_caption')} captionPlaceholder="1-click clean CRM dashboard" />
            </div>
            <p className="field-hint">PNG, JPG or WebP, up to 5 MB. Blur any customer names or phone numbers before uploading - the ledger is public.</p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button type="button" onClick={() => save(false)} disabled={saving} className="btn-secondary">Save draft</button>
              <button type="button" onClick={() => save(true)} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit for publishing
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ImpactLedgerPanel;
