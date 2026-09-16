import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, RotateCw, Send, Trash2, UserPlus, Users } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import StatusBadge from './StatusBadge';
import { formatDate, getErrorMessage } from '../utils/format';

// V2.2.1 club track: the president invites committee members by email and tracks who has joined
const ClubCommittee = ({ clubUserId }) => {
  const { showToast } = useToast();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', role: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/users/club/invite/');
      setInvites(res.data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load your committee.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const res = await api.post('/users/club/invite/', { email: form.email.trim(), role: form.role.trim() });
      setInvites((list) => [res.data, ...list]);
      setForm({ email: '', role: '' });
      showToast(`Invitation emailed to ${res.data.email}.`, 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the invitation.'));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (invite) => {
    setBusyId(invite.id);
    try {
      const res = await api.post(`/users/club/invite/${invite.id}/resend/`);
      setInvites((list) => list.map((i) => (i.id === invite.id ? res.data : i)));
      showToast(`A new link was emailed to ${invite.email}.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not resend the invitation.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (invite) => {
    setBusyId(invite.id);
    try {
      await api.delete(`/users/club/invite/${invite.id}/`);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
      showToast(`Invitation for ${invite.email} cancelled.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not cancel the invitation.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const joined = invites.filter((i) => i.status === 'ACTIVE').length;

  return (
    <section className="card p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading font-bold text-xl flex items-center gap-2"><Users size={20} className="text-[#00AEEF]" /> Committee</h2>
          <p className="text-sm text-[#5B6478] mt-0.5">
            Invite your committee by email. They get a link to set up their account and appear on your club&apos;s public roster.
          </p>
        </div>
        <Link to={`/club/profile/${clubUserId}`} className="btn-secondary btn-sm self-start sm:self-auto">View public roster</Link>
      </div>

      {error && <div className="alert-error mb-4" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>}
      <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 md:items-end p-4 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)]">
        <div>
          <label className="field-label" htmlFor="committee-email">Email</label>
          <input id="committee-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="member@siswa.edu.my" className="input bg-white" />
        </div>
        <div>
          <label className="field-label" htmlFor="committee-role">Committee role</label>
          <input id="committee-role" required maxLength={50} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Treasurer" className="input bg-white" />
        </div>
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Send invite
        </button>
      </form>

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#5B6478]"><Loader2 size={16} className="animate-spin text-[#00AEEF]" /> Loading committee…</div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-[#5B6478] text-center py-6">No one invited yet. Start with your vice president or treasurer.</p>
        ) : (
          <>
            <p className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] mb-2">{joined} of {invites.length} joined</p>
            <ul className="divide-y divide-[rgba(10,23,72,0.08)] border-y border-[rgba(10,23,72,0.08)]">
              {invites.map((invite) => (
                <li key={invite.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm break-all">{invite.name || invite.email}</span>
                      <StatusBadge status={invite.status} />
                    </div>
                    <div className="text-xs text-[#5B6478] mt-0.5">
                      {invite.role}
                      {invite.name && <> · {invite.email}</>}
                      {invite.status !== 'ACTIVE' && <> · invited {formatDate(invite.created_at)}</>}
                    </div>
                  </div>
                  {invite.status !== 'ACTIVE' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => handleResend(invite)} disabled={busyId === invite.id} className="btn-secondary btn-sm">
                        {invite.status === 'EXPIRED' ? <RotateCw size={13} /> : <Send size={13} />} {invite.status === 'EXPIRED' ? 'Send new link' : 'Resend'}
                      </button>
                      <button type="button" onClick={() => handleCancel(invite)} disabled={busyId === invite.id} className="btn btn-sm text-[#5B6478] hover:text-red-700 hover:bg-red-50" aria-label={`Cancel invitation for ${invite.email}`}>
                        <Trash2 size={13} /> Cancel
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
};

export default ClubCommittee;
