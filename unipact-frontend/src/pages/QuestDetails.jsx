import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Clock, CheckCircle2, Send, Loader2, AlertCircle, Info } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import PageLoader from '../components/PageLoader';
import StatusBadge from '../components/StatusBadge';
import { campaignTypeLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const QuestDetails = () => {
  usePageTitle('Quest details');
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isClub = user?.role === 'CLUB';

  useEffect(() => {
    const fetchQuest = async () => {
      try {
        const response = await api.get(`/campaigns/${id}/`);
        setQuest(response.data);
      } catch {
        setQuest(null);
      } finally {
        setLoading(false);
      }
    };
    fetchQuest();
  }, [id]);

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/campaigns/${id}/apply/`, { message: pitch.trim() });
      showToast('Proposal sent! The company will review it soon.', 'success');
      setQuest((q) => ({ ...q, my_application: { id: res.data.id, status: res.data.status || 'PENDING' } }));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send your proposal.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader message="Loading quest…" />;

  if (!quest) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] font-body">
        <WorkspaceNav />
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <AlertCircle size={40} className="mx-auto text-[#5B6478]/50 mb-3" />
          <h1 className="font-heading font-bold text-xl mb-2">Quest not available</h1>
          <p className="text-sm text-[#5B6478] mb-6">It may have been closed by the company.</p>
          <Link to="/quests" className="btn-primary">Back to quest board</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-[1160px] mx-auto px-4 sm:px-8 py-8 animate-fade-in">
        <Link to="/quests" className="back-link mb-6">
          <ArrowLeft size={15} /> Back to quest board
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="card p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6]">{campaignTypeLabel(quest.type)}</span>
                <StatusBadge status={quest.status} />
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl mb-1">{quest.title}</h1>
              <p className="text-sm text-[#5B6478] flex items-center gap-1.5 mb-6"><Building2 size={14} /> {quest.company_name}</p>
              <h2 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">About this quest</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line">{quest.description}</p>
            </section>

            <section className="card p-6 sm:p-8">
              <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2"><CheckCircle2 size={18} className="text-[#00AEEF]" /> What you need to deliver</h2>
              {quest.requirements?.length > 0 ? (
                <ul className="space-y-2">
                  {quest.requirements.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm bg-[#F5F7FC] p-3 rounded-lg">
                      <span className="w-1.5 h-1.5 bg-[#00AEEF] rounded-full mt-2 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#5B6478]">The company hasn&apos;t listed specific deliverables.</p>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-6 text-center">
              <div className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] mb-1">Budget</div>
              <div className="font-heading text-3xl font-extrabold text-[#0B1E63]">{formatMoney(quest.budget)}</div>
              <div className="mt-2 text-sm text-[#5B6478] inline-flex items-center gap-1.5"><Clock size={14} /> Deadline {formatDate(quest.deadline, 'to be agreed')}</div>
            </section>

            <section className="card p-6">
              {quest.my_application ? (
                <div className="text-center py-4">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-3" />
                  <h2 className="font-heading font-bold text-lg mb-2">Proposal sent</h2>
                  <p className="text-sm text-[#5B6478] mb-5">Status: <StatusBadge status={quest.my_application.status} /></p>
                  <Link to="/student/dashboard" className="btn-secondary w-full">Go to dashboard</Link>
                </div>
              ) : !isClub ? (
                <div className="flex items-start gap-2.5 text-sm text-[#5B6478]">
                  <Info size={16} className="text-[#00AEEF] shrink-0 mt-0.5" />
                  Only student clubs can apply to quests. Individual students are matched to projects by UniPact admins.
                </div>
              ) : quest.status !== 'OPEN' ? (
                <p className="text-sm text-[#5B6478]">This quest is no longer accepting proposals.</p>
              ) : (
                <>
                  <h2 className="font-heading font-bold text-lg mb-1">Send a proposal</h2>
                  <p className="text-sm text-[#5B6478] mb-4">Tell the company why your club is a great fit.</p>
                  {error && <div className="alert-error mb-4"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>}
                  <form onSubmit={handleApply} className="space-y-4">
                    <textarea rows={6} value={pitch} onChange={(e) => setPitch(e.target.value)} required minLength={20}
                      placeholder="Share relevant experience, your team and how you'd approach this." className="input" aria-label="Proposal" />
                    <p className="field-hint -mt-2">{pitch.trim().length < 20 ? `At least 20 characters (${pitch.trim().length}/20)` : 'Looks good.'}</p>
                    <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                      {submitting ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Send size={16} /> Send proposal</>}
                    </button>
                  </form>
                </>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default QuestDetails;
