import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Trophy, Clock, CheckCircle2, Star, FileText, Download, Upload, Sparkles,
  CalendarDays, Loader2, ArrowUpRight, AlertCircle, Info, Lock,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import WorkspaceNav from '../components/WorkspaceNav';
import PaymentModal from '../components/PaymentModal';
import ConfirmationModal from '../components/ConfirmationModal';
import Modal from '../components/Modal';
import PageLoader from '../components/PageLoader';
import StatusBadge from '../components/StatusBadge';
import { campaignTypeLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

// Fees mirror the backend: FinalizeMatchView (V3 match) and AwardApplicationView (club award)
const MATCH_FINDERS_FEE = 150;
const CLUB_FINDERS_FEE = 100;

const STEPS = [
  { status: 'OPEN', label: 'Posted' },
  { status: 'MATCHED', label: 'Matched' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'COMPLETED', label: 'Completed' },
];

const ASSET_TYPES = [
  { value: 'DOCUMENT', label: 'Document / brief' },
  { value: 'BRAND', label: 'Brand asset / logo' },
  { value: 'RAW_VIDEO', label: 'Raw video footage' },
  { value: 'RAW_PHOTO', label: 'Raw photography' },
  { value: 'AUDIO_STEM', label: 'Audio' },
  { value: 'OTHER', label: 'Other' },
];

const Progress = ({ status }) => {
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-2 sm:gap-3 overflow-x-auto overflow-y-hidden" aria-label="Project progress">
      {STEPS.map((step, i) => {
        const done = i < current || status === 'COMPLETED';
        const active = i === current && status !== 'COMPLETED';
        return (
          <li key={step.status} className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
              done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'bg-[#00AEEF] border-[#00AEEF] text-white' : 'bg-white border-[rgba(10,23,72,0.2)] text-[#5B6478]'
            }`}>
              {done ? <CheckCircle2 size={14} /> : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold text-[#0A1748]' : 'text-[#5B6478]'}`}>{step.label}</span>
            {i < STEPS.length - 1 && <span className="w-6 sm:w-10 h-px bg-[rgba(10,23,72,0.2)]" />}
          </li>
        );
      })}
    </ol>
  );
};

const ManageCampaign = () => {
  usePageTitle('Manage project');
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [payment, setPayment] = useState(null); // { amount, description, onPaid }
  const [confirmState, setConfirmState] = useState({ isOpen: false });
  const [review, setReview] = useState({ isOpen: false, rating: 5, comment: '' });
  const [asset, setAsset] = useState({ file: null, title: '', type: 'DOCUMENT' });
  const [uploading, setUploading] = useState(false);

  const isFreeTier = (user?.company_profile?.tier || user?.tier) !== 'PRO';

  const fetchCampaign = useCallback(async () => {
    try {
      const response = await api.get(`/campaigns/${id}/`);
      setCampaign(response.data);
    } catch (error) {
      showToast(error.response?.status === 404 ? 'That project could not be found.' : getErrorMessage(error, 'Failed to load the project.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // ---- V3 match confirmation ----
  const finalizeMatch = async () => {
    setBusy(true);
    try {
      await api.post(`/campaigns/${id}/finalize/`, { mock_pay: false });
      showToast('Match confirmed. Your student team can start work now.', 'success');
      await fetchCampaign();
    } catch (error) {
      if (error.response?.status === 402) {
        setPayment({ amount: MATCH_FINDERS_FEE, description: `Finder's fee · ${campaign.title}`, onPaid: finalizeMatch });
      } else {
        showToast(getErrorMessage(error, 'Could not confirm the match.'), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmMatch = () => {
    setConfirmState({
      isOpen: true,
      title: 'Confirm this student match?',
      message: isFreeTier
        ? `Confirming locks in the team and starts the project. As a Free plan client, a one-time finder's fee of ${formatMoney(MATCH_FINDERS_FEE)} applies.`
        : 'Confirming locks in the team and starts the project. Finder\'s fees are waived on your Pro plan.',
      confirmText: isFreeTier ? 'Continue to payment' : 'Confirm match',
      onConfirm: finalizeMatch,
    });
  };

  // ---- V2.2.1 club award ----
  const executeAward = async (applicationId, clubName) => {
    try {
      await api.post(`/campaigns/application/${applicationId}/award/`);
      showToast(`Contract awarded to ${clubName}.`, 'success');
      await fetchCampaign();
    } catch (error) {
      if (error.response?.status === 402) {
        setPayment({
          amount: CLUB_FINDERS_FEE,
          description: `Finder's fee · ${campaign.title}`,
          onPaid: () => executeAward(applicationId, clubName),
        });
      } else {
        showToast(getErrorMessage(error, 'Could not award the contract.'), 'error');
      }
    }
  };

  const handleAwardClick = (applicationId, clubName) => {
    setConfirmState({
      isOpen: true,
      title: 'Award this contract?',
      message: `Award the contract to ${clubName}? Other applicants will be marked as not selected. This cannot be undone.`,
      confirmText: 'Award contract',
      onConfirm: () => executeAward(applicationId, clubName),
    });
  };

  // ---- Completion & review ----
  const submitReviewAndComplete = async () => {
    setBusy(true);
    try {
      await api.post(`/campaigns/${id}/complete/`, { rating: review.rating, feedback: review.comment });
      showToast('Project completed and your review has been saved.', 'success');
      setReview((r) => ({ ...r, isOpen: false }));
      await fetchCampaign();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not complete the project.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- File vault ----
  const handleUploadAsset = async (e) => {
    e.preventDefault();
    if (!asset.file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', asset.file);
      formData.append('title', asset.title.trim() || asset.file.name);
      formData.append('asset_type', asset.type);
      await api.post(`/campaigns/${id}/assets/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('File shared with your project team.', 'success');
      setAsset({ file: null, title: '', type: asset.type });
      e.target.reset();
      await fetchCampaign();
    } catch (error) {
      showToast(getErrorMessage(error, 'Upload failed.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <PageLoader message="Loading project…" />;

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] font-body">
        <WorkspaceNav />
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <AlertCircle size={40} className="mx-auto text-[#5B6478]/50 mb-3" />
          <h1 className="font-heading font-bold text-xl mb-2">Project not found</h1>
          <p className="text-sm text-[#5B6478] mb-6">It may have been removed, or it belongs to another account.</p>
          <button onClick={() => navigate('/company/dashboard')} className="btn-primary">Back to projects</button>
        </div>
      </div>
    );
  }

  const team = campaign.assigned_students_details || [];
  const offerStatus = Object.fromEntries((campaign.match_offers || []).map((o) => [o.student, o.status]));
  const deliverables = campaign.student_deliverables || [];
  const assets = campaign.client_assets || [];
  const applications = campaign.applications || [];
  const clubAwaitingReview = applications.some((a) => a.status === 'SUBMITTED');
  const canComplete = campaign.status === 'IN_PROGRESS' && (deliverables.length > 0 || clubAwaitingReview);
  const isCompleted = campaign.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />

      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6 flex-1 animate-fade-in">
        <Link to="/company/dashboard" className="back-link">
          <ArrowLeft size={15} /> Back to projects
        </Link>

        {/* Header */}
        <section className="card p-6 sm:p-8 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6]">{campaignTypeLabel(campaign.type)}</span>
                <StatusBadge status={campaign.status} />
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight">{campaign.title}</h1>
              <p className="text-sm text-[#5B6478] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>Budget <strong className="text-[#0B1E63]">{formatMoney(campaign.budget)}</strong></span>
                <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> Due {formatDate(campaign.deadline, 'flexible')}</span>
                <span>Posted {formatDate(campaign.created_at)}</span>
              </p>
            </div>
          </div>
          <div className="pt-5 border-t border-[rgba(10,23,72,0.08)]">
            <Progress status={campaign.status} />
          </div>
        </section>

        {/* Next step callout */}
        {campaign.status === 'OPEN' && team.length === 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-[rgba(10,23,72,0.12)] text-sm">
            <Sparkles size={18} className="text-[#00AEEF] shrink-0 mt-0.5" />
            <span><strong>What happens next:</strong> a UniPact admin reviews verified students and proposes the best match. You&apos;ll see the team here to confirm.</span>
          </div>
        )}
        {campaign.status === 'MATCHED' && campaign.awaiting_student_acceptance && (
          <div className="flex items-start gap-3 p-5 rounded-xl bg-white border border-[rgba(10,23,72,0.12)] text-sm">
            <Clock size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-base">Waiting for the students to accept</strong>
              <span className="text-[#5B6478]">
                A UniPact admin has picked your team and asked each student to accept. We&apos;ll email you as soon as they do, and you can confirm the match here.
              </span>
            </div>
          </div>
        )}
        {campaign.status === 'MATCHED' && !campaign.awaiting_student_acceptance && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border-2 border-[#00AEEF] shadow-sm">
            <div className="flex items-start gap-3 text-sm">
              <Sparkles size={20} className="text-[#00AEEF] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-base">Your student team is ready</strong>
                <span className="text-[#5B6478]">Every student has accepted. Review the team below, then confirm to start the project.</span>
              </div>
            </div>
            <button onClick={handleConfirmMatch} disabled={busy} className="btn-primary self-start sm:self-auto">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Confirm match
            </button>
          </div>
        )}
        {campaign.status === 'IN_PROGRESS' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-[rgba(10,23,72,0.12)]">
            <div className="flex items-start gap-3 text-sm">
              <Info size={18} className="text-[#00AEEF] shrink-0 mt-0.5" />
              <span>
                {canComplete
                  ? 'Work has been submitted. When you are happy with it, approve and complete the project.'
                  : 'The team is working on it. You can approve the project once they submit their work.'}
              </span>
            </div>
            <button onClick={() => setReview({ isOpen: true, rating: 5, comment: '' })} disabled={!canComplete || busy} className="btn-primary self-start sm:self-auto shrink-0 whitespace-nowrap">
              <CheckCircle2 size={15} /> Approve & complete
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-3 text-sm text-emerald-900">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong className="block text-base">Project completed</strong>Thanks for working with UniPact talent. The work now appears on the team&apos;s portfolios.</span>
            </div>
            {campaign.report_url && (
              <a href={campaign.report_url} target="_blank" rel="noreferrer" className="btn-secondary self-start sm:self-auto">
                <Download size={15} /> Download report
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Team */}
            {team.length > 0 && (
              <section className="card p-6 sm:p-8">
                <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-4">
                  <Users size={18} className="text-[#00AEEF]" /> Student team ({team.length})
                </h2>
                {campaign.match_notes && (
                  <p className="text-sm bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-3 mb-4">
                    <strong className="text-[#0090C6]">Admin&apos;s note:</strong> {campaign.match_notes}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {team.map((s) => (
                    <Link key={s.id} to={`/student/profile/${s.user_id}`} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] hover:border-[#00AEEF] rounded-lg p-4 text-sm group">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold group-hover:text-[#0090C6]">{s.full_name}</span>
                        <span className="text-amber-600 font-semibold inline-flex items-center gap-0.5"><Star size={13} className="fill-amber-400 text-amber-400" /> {s.rating}</span>
                      </div>
                      {campaign.status === 'MATCHED' && offerStatus[s.id] && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-1 ${offerStatus[s.id] === 'ACCEPTED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {offerStatus[s.id] === 'ACCEPTED' ? <><CheckCircle2 size={12} /> Accepted</> : <><Clock size={12} /> Waiting to accept</>}
                        </span>
                      )}
                      <div className="text-xs text-[#5B6478] mt-0.5">{[s.university, s.major].filter(Boolean).join(' • ')}</div>
                      {s.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.skills.slice(0, 4).map((skill) => (
                            <span key={skill} className="text-[11px] px-2 py-0.5 rounded bg-white border border-[rgba(10,23,72,0.08)]">{skill}</span>
                          ))}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-[#0090C6] inline-flex items-center gap-1 mt-2">View portfolio <ArrowUpRight size={12} /></span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Deliverables */}
            {(team.length > 0 || deliverables.length > 0) && (
              <section className="card p-6 sm:p-8">
                <h2 className="font-heading text-lg font-bold mb-4">Submitted work ({deliverables.length})</h2>
                {deliverables.length === 0 ? (
                  <p className="text-sm text-[#5B6478]">Nothing submitted yet. You&apos;ll see links and files here as soon as the team uploads them.</p>
                ) : (
                  <div className="space-y-3">
                    {deliverables.map((del) => (
                      <div key={del.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 text-sm">
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                          <div className="font-semibold text-base">{del.title}</div>
                          <span className="text-xs text-[#5B6478]">{formatDate(del.submitted_at)}</span>
                        </div>
                        <div className="text-[#5B6478] mb-2">{del.student_name}{del.contribution_role && <> · {del.contribution_role}</>}</div>
                        {del.contribution_summary && <p className="bg-white p-3 rounded border border-[rgba(10,23,72,0.06)] mb-2">{del.contribution_summary}</p>}
                        <div className="flex flex-wrap gap-4">
                          {del.external_url && <a href={del.external_url} target="_blank" rel="noreferrer" className="text-[#0090C6] font-semibold hover:underline inline-flex items-center gap-1">Open link <ArrowUpRight size={13} /></a>}
                          {del.file && <a href={del.file} target="_blank" rel="noreferrer" className="text-[#0090C6] font-semibold hover:underline inline-flex items-center gap-1"><Download size={13} /> Download file</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Club applications (V2.2.1) */}
            {applications.length > 0 && (
              <section className="card p-6 sm:p-8">
                <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-4">
                  <Trophy size={18} className="text-[#00AEEF]" /> Club applications ({applications.length})
                </h2>
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 flex flex-col md:flex-row justify-between gap-4 text-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/club/profile/${app.club_user_id}`} className="font-semibold hover:text-[#0090C6]">{app.club_name}</Link>
                          <StatusBadge status={isCompleted && ['AWARDED', 'SUBMITTED'].includes(app.status) ? 'COMPLETED' : app.status} />
                        </div>
                        <p className="text-[#5B6478] mt-1">“{app.message}”</p>
                        <div className="text-xs text-[#5B6478] mt-2 flex items-center gap-1.5"><Clock size={12} /> Applied {formatDate(app.submitted_at)}</div>
                        {app.deliverables?.length > 0 && (
                          <div className="flex flex-wrap gap-3 mt-2">
                            {app.deliverables.map((d) => (
                              <a key={d.id} href={d.file} target="_blank" rel="noreferrer" className="text-[#0090C6] font-semibold hover:underline inline-flex items-center gap-1 text-xs">
                                <Download size={12} /> Submission {formatDate(d.uploaded_at)}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      {campaign.status === 'OPEN' && app.status === 'PENDING' && (
                        <button onClick={() => handleAwardClick(app.id, app.club_name)} className="btn-primary btn-sm self-start">
                          <Trophy size={14} /> Award contract
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Brief */}
            <section className="card p-6 sm:p-8 space-y-4">
              <h2 className="font-heading text-lg font-bold">Project brief</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line">{campaign.description}</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {campaign.software_sub_type && <div><dt className="text-[#5B6478]">Project type</dt><dd className="font-semibold">{campaign.software_sub_type}</dd></div>}
                {campaign.campaign_objective && <div><dt className="text-[#5B6478]">Objective</dt><dd className="font-semibold">{campaign.campaign_objective}</dd></div>}
                {campaign.required_skills?.length > 0 && <div><dt className="text-[#5B6478]">Skills</dt><dd className="font-semibold">{campaign.required_skills.join(', ')}</dd></div>}
                {campaign.target_platforms?.length > 0 && <div><dt className="text-[#5B6478]">Platforms</dt><dd className="font-semibold">{campaign.target_platforms.join(', ')}</dd></div>}
                {campaign.project_outcome && <div className="sm:col-span-2"><dt className="text-[#5B6478]">Expected outcome</dt><dd>{campaign.project_outcome}</dd></div>}
              </dl>
              {campaign.requirements?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">Deliverables</h3>
                  <ul className="space-y-1.5 text-sm">
                    {campaign.requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2"><CheckCircle2 size={15} className="text-[#00AEEF] shrink-0 mt-0.5" /> {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {/* File vault */}
          <aside className="card p-6 h-fit space-y-4">
            <div>
              <h2 className="font-heading text-lg font-bold">Project files</h2>
              <p className="text-sm text-[#5B6478]">Briefs, brand assets and raw footage shared with your student team.</p>
            </div>
            {assets.length === 0 ? (
              <p className="text-sm text-[#5B6478] italic">No files shared yet.</p>
            ) : (
              <ul className="space-y-2">
                {assets.map((a) => (
                  <li key={a.id}>
                    <a href={a.file} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-[rgba(10,23,72,0.08)] bg-[#F5F7FC] hover:border-[#00AEEF] text-sm group">
                      <FileText size={16} className="text-[#00AEEF] shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.title}</span>
                        <span className="block text-xs text-[#5B6478]">{ASSET_TYPES.find((t) => t.value === a.asset_type)?.label || a.asset_type} · {formatDate(a.uploaded_at)}</span>
                      </span>
                      <Download size={15} className="text-[#5B6478] group-hover:text-[#0090C6] shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {!isCompleted && (
              <form onSubmit={handleUploadAsset} className="space-y-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                <div>
                  <label className="field-label" htmlFor="asset-file">Add a file</label>
                  <input id="asset-file" type="file" required onChange={(e) => setAsset({ ...asset, file: e.target.files?.[0] || null })} className="input text-xs file:mr-2 file:rounded file:border-0 file:bg-[#0B1E63] file:text-white file:px-2.5 file:py-1 file:text-xs" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <input value={asset.title} onChange={(e) => setAsset({ ...asset, title: e.target.value })} placeholder="Name (optional)" className="input" aria-label="File name" />
                  <select value={asset.type} onChange={(e) => setAsset({ ...asset, type: e.target.value })} className="input" aria-label="File type">
                    {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={!asset.file || uploading} className="btn-secondary w-full">
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload file
                </button>
              </form>
            )}
          </aside>
        </div>
      </main>

      {/* Review modal */}
      <Modal
        isOpen={review.isOpen}
        onClose={() => !busy && setReview((r) => ({ ...r, isOpen: false }))}
        title="Approve & complete project"
        subtitle="Rate the work. Your rating appears on the team's portfolio."
        icon={<Star size={20} />}
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <div>
            <span className="field-label">Rating</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={review.rating === value}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                  onClick={() => setReview((r) => ({ ...r, rating: value }))}
                  className="p-1 rounded hover:scale-110 transition-transform"
                >
                  <Star size={30} className={value <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-[rgba(10,23,72,0.2)]'} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="review-comment">Feedback (optional)</label>
            <textarea id="review-comment" rows={4} value={review.comment} onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))} className="input" placeholder="What went well? Anything they could improve?" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setReview((r) => ({ ...r, isOpen: false }))} disabled={busy} className="btn-secondary">Cancel</button>
            <button onClick={submitReviewAndComplete} disabled={busy} className="btn-primary">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Complete project
            </button>
          </div>
        </div>
      </Modal>

      <PaymentModal
        isOpen={!!payment}
        onClose={() => setPayment(null)}
        amount={payment?.amount}
        description={payment?.description}
        campaignId={campaign.id}
        onSuccess={() => payment?.onPaid?.()}
      />

      <ConfirmationModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((s) => ({ ...s, isOpen: false }))}
        onConfirm={confirmState.onConfirm || (() => {})}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
      />
    </div>
  );
};

export default ManageCampaign;
