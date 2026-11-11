import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, Loader2, Trash2 } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';
import { formatDate, formatMoney, getErrorMessage } from '../utils/format';

const LinkBox = ({ label, url, open, onToggle, filename }) => {
  const { showToast } = useToast();
  const qrRef = useRef(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied.', 'success');
    } catch {
      showToast('Could not copy. Select the link and copy it yourself.', 'error');
    }
  };
  const download = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    a.click();
  };
  return (
    <div className="rounded-xl border border-[rgba(10,23,72,0.12)] p-4 flex gap-4">
      <div ref={qrRef} className="shrink-0 bg-white p-1.5 rounded-md border border-[rgba(10,23,72,0.08)]">
        <QRCodeCanvas value={url} size={512} marginSize={2} fgColor="#0A1748" style={{ width: 96, height: 96 }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{label}</p>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={open} onChange={(e) => onToggle(e.target.checked)} /> Open
          </label>
        </div>
        <p className="text-sm text-[#00729F] break-all mt-1">{url}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={copy}><Copy size={13} /> Copy link</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={download}><Download size={13} /> QR image</button>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ value, label, note }) => (
  <div className="rounded-xl bg-[#F5F7FC] p-4">
    <p className="font-heading font-bold text-2xl text-[#0B1E63] tabular-nums">{value ?? '—'}</p>
    <p className="text-sm font-semibold mt-1">{label}</p>
    {note && <p className="text-xs text-[#5B6478] mt-0.5">{note}</p>}
  </div>
);

const AdminWorkshopModal = ({ workshop, onClose, onChanged }) => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  // Mounted once per workshop (the parent passes key={workshop.id}), so state starts from the props
  const [current, setCurrent] = useState(workshop);
  const [cost, setCost] = useState(workshop.cost ?? '');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/impact/admin/workshops/${workshop.id}/results/`);
      setData(res.data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load the results.'), 'error');
    }
  }, [workshop, showToast]);

  useEffect(() => {
    api.get(`/impact/admin/workshops/${workshop.id}/results/`)
      .then((res) => setData(res.data))
      .catch((err) => showToast(getErrorMessage(err, 'Could not load the results.'), 'error'));
  }, [workshop.id, showToast]);

  const update = async (changes) => {
    try {
      const res = await api.patch(`/impact/admin/workshops/${workshop.id}/`, changes);
      setCurrent(res.data);
      onChanged();
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the workshop.'), 'error');
    }
  };

  const removeAttendee = async (a) => {
    if (!window.confirm(`Remove ${a.full_name}'s check-in? Use this for duplicates or if they ask for their details to be deleted.`)) return;
    try {
      await api.delete(`/impact/admin/attendees/${a.id}/`);
      onChanged();
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not remove the check-in.'), 'error');
    }
  };

  const base = `${window.location.origin}/w/${current.checkin_code}`;
  const s = data?.summary;
  const slug = current.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <Modal isOpen onClose={onClose} title={current.title} subtitle={`${formatDate(current.held_on)} · ${current.kind_label}`} maxWidth="max-w-4xl">
      <div className="space-y-6">
        <section className="grid md:grid-cols-2 gap-3">
          <LinkBox label="Check-in (show at the start)" url={base} open={current.checkin_open} onToggle={(v) => update({ checkin_open: v })} filename={`checkin-${slug}.png`} />
          <LinkBox label="Feedback (show at the end)" url={`${base}/feedback`} open={current.feedback_open} onToggle={(v) => update({ feedback_open: v })} filename={`feedback-${slug}.png`} />
        </section>

        {!s && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#00AEEF]" /></div>}
        {s && (
          <>
            <section>
              <h3 className="font-heading font-bold text-lg mb-3">Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat value={s.attendees} label="Checked in" note={s.attendees ? `${s.b40_self_declared} said B40 · ${s.b40_verified} verified B40` : null} />
                <Stat
                  value={s.confidence_before !== null ? `${s.confidence_before} → ${s.confidence_after}` : null}
                  label="Confidence (1-5)"
                  note={s.feedback_count ? `Before → after, ${s.feedback_count} who gave feedback` : 'Waiting for feedback'}
                />
                <Stat value={s.nps !== null ? (s.nps > 0 ? `+${s.nps}` : s.nps) : null} label="Recommend score (NPS)" note={s.recommend_average !== null ? `Average ${s.recommend_average} / 10` : null} />
                <Stat value={s.have_account} label="Have a UniPact account" note={`${s.joined_after} joined on or after the workshop day`} />
                <Stat value={s.earned} label="Earned since" note={s.earned_pct !== null ? `${s.earned_pct}% of attendees · ${s.earned_within_90_days} within ${s.follow_up_days} days` : null} />
                <Stat value={formatMoney(s.total_earned)} label="Paid to attendees since" note="Disbursed payouts after the workshop date" />
                <Stat value={s.cost_per_attendee !== null ? formatMoney(s.cost_per_attendee) : null} label="Cost per attendee" />
                <Stat value={s.cost_per_earner !== null ? formatMoney(s.cost_per_earner) : null} label="Cost per student who earned" />
              </div>
              <form
                className="flex flex-wrap items-end gap-3 mt-4"
                onSubmit={(e) => { e.preventDefault(); update({ cost: cost === '' ? null : cost }); }}
              >
                <label className="block">
                  <span className="field-label">What the workshop cost (RM)</span>
                  <input className="input" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Venue, food, speaker" />
                </label>
                <button type="submit" className="btn btn-navy btn-sm">Save cost</button>
              </form>
            </section>

            <section>
              <h3 className="font-heading font-bold text-lg mb-2">Attendees</h3>
              {data.attendees.length === 0 ? (
                <p className="text-sm text-[#5B6478]">No one has checked in yet. Show the check-in QR code at the start of the workshop.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[#5B6478]">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Name</th>
                        <th className="py-2 px-3 font-medium">B40</th>
                        <th className="py-2 px-3 font-medium text-right">Before → after</th>
                        <th className="py-2 px-3 font-medium text-right">Recommend</th>
                        <th className="py-2 px-3 font-medium">Account</th>
                        <th className="py-2 px-3 font-medium text-right">Earned since</th>
                        <th className="py-2 pl-3" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(10,23,72,0.08)]">
                      {data.attendees.map((a) => (
                        <tr key={a.id} className="align-top">
                          <td className="py-2 pr-3">
                            <p className="font-semibold">{a.full_name}</p>
                            <p className="text-xs text-[#5B6478]">{a.email}{a.university ? ` · ${a.university}` : ''}</p>
                            {a.feedback_comment && <p className="text-xs text-[#5B6478] italic mt-1">“{a.feedback_comment}”</p>}
                          </td>
                          <td className="py-2 px-3">{a.b40_self_declared}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{a.confidence_before} → {a.confidence_after ?? '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{a.recommend_score ?? '—'}</td>
                          <td className="py-2 px-3">{a.student_name ? <span className="text-emerald-700">Linked</span> : <span className="text-[#5B6478]">Not yet</span>}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{a.earned_since !== null ? formatMoney(a.earned_since) : '—'}</td>
                          <td className="py-2 pl-3 text-right">
                            <button type="button" className="text-[#5B6478] hover:text-red-600 p-1" onClick={() => removeAttendee(a)} aria-label={`Remove ${a.full_name}`}>
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
};

export default AdminWorkshopModal;
