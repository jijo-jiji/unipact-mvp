import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, FileSignature, Loader2 } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { AGREEMENTS } from '../utils/agreements';
import { getErrorMessage } from '../utils/format';

// Asks the user to read and accept the Talent or Client Service Agreement, then lets them carry on
// with whatever needed it (accepting a job, confirming a team, paying).
const AgreementModal = ({ agreement: agreementKey, onClose, onAccepted }) => {
  const agreement = AGREEMENTS[agreementKey];
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (saving) return;
    setChecked(false);
    setError('');
    onClose();
  };

  const accept = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/users/agreements/accept/', { agreement: agreement.key, version: agreement.version });
      setChecked(false);
      onAccepted?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record your acceptance. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (!agreement) return null;

  return (
    <Modal isOpen onClose={close} dismissible={!saving} maxWidth="max-w-xl"
      title={agreement.title} subtitle={agreement.versionLabel} icon={<FileSignature size={20} />}>
      <form onSubmit={accept} className="space-y-5">
        {error && <div className="alert-error"><span>{error}</span></div>}
        <p className="text-sm text-[#5B6478]">
          {agreement.key === 'TALENT'
            ? 'Before you take a job, please read and accept the agreement between you and UniPact. The main points:'
            : 'Before you confirm a team or pay, please read and accept the agreement between your company and UniPact. The main points:'}
        </p>
        <ul className="space-y-2 text-sm">
          {agreement.summary.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <CheckCircle2 size={15} className="text-[#00AEEF] shrink-0 mt-0.5" /> <span>{point}</span>
            </li>
          ))}
        </ul>
        <a href={agreement.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#0090C6] hover:underline">
          Read the full {agreement.title} <ArrowUpRight size={14} />
        </a>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] cursor-pointer text-sm">
          <input type="checkbox" required checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-[#00AEEF]" />
          <span>I have read and accept the {agreement.title} ({agreement.versionLabel}).</span>
        </label>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button type="button" onClick={close} disabled={saving} className="btn-secondary">Not now</button>
          <button type="submit" disabled={saving || !checked} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />} Accept and continue
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AgreementModal;
