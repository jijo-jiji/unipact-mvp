import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertCircle, ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Clock, CreditCard, Download, FileText,
  Flag, Info, Loader2, MessageSquare, Sparkles, Upload, UserPlus, Users, Wallet,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import Modal from '../components/Modal';
import PageLoader from '../components/PageLoader';
import StatusBadge from '../components/StatusBadge';
import ProjectProgress from '../components/ProjectProgress';
import ProjectOverview from '../components/ProjectOverview';
import ImpactLedgerPanel from '../components/ImpactLedgerPanel';
import ProjectMessages from '../components/ProjectMessages';
import { useProjectMessages } from '../hooks/useProjectMessages';
import { campaignTypeLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { latestEvents } from '../utils/projectHistory';
import { nextMilestoneToSubmit, studentNextStep, studentStats } from '../utils/projectSummary';
import { usePageTitle } from '../hooks/usePageTitle';

// The page's sections, as tabs (the same pattern as the client's project page and the admin hub)
const TABS = [
  { key: 'overview', label: 'Overview', icon: <Activity size={16} /> },
  { key: 'work', label: 'Milestones & work', icon: <Flag size={16} /> },
  { key: 'messages', label: 'Messages', icon: <MessageSquare size={16} /> },
  { key: 'team', label: 'Team', icon: <Users size={16} /> },
  { key: 'earnings', label: 'Earnings', icon: <Wallet size={16} /> },
  { key: 'brief', label: 'Brief & files', icon: <FileText size={16} /> },
];

const NO_PAYOUTS = { has_bank_details: false, bank_details: {}, payouts: [] };
const canSubmitMilestone = (m) => ['PENDING', 'IN_PROGRESS', 'REVISION_REQUESTED'].includes(m.status);

// A student's own page for one project they are on: what to do next, the milestones and their work,
// the team, what they earn from it, and the client's brief and files.
const StudentProject = () => {
  usePageTitle('Project');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const myProfileId = user?.student_profile?.id;

  const [campaign, setCampaign] = useState(null);
  const [payoutsData, setPayoutsData] = useState(NO_PAYOUTS);
  const [loading, setLoading] = useState(true);
  // A link in an email (…?tab=messages) opens that section straight away
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => (TABS.some((tab) => tab.key === searchParams.get('tab')) ? searchParams.get('tab') : 'overview'));
  // The project's conversation exists once work has started (and never for club sponsorships, which have no team)
  const chatEnabled = ['IN_PROGRESS', 'COMPLETED', 'ARCHIVED'].includes(campaign?.status) && (campaign?.assigned_students || []).length > 0;
  const chat = useProjectMessages(id, { enabled: chatEnabled, active: chatEnabled && activeTab === 'messages' });

  // Milestone submission (what the client approves and pays against)
  const [milestoneTarget, setMilestoneTarget] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({ url: '', notes: '', file: null });
  const [submittingMilestone, setSubmittingMilestone] = useState(false);
  const [milestoneError, setMilestoneError] = useState('');

  // Sharing a file outside a milestone
  const [sharing, setSharing] = useState(false);
  const [deliverable, setDeliverable] = useState({ title: '', url: '', role: '', summary: '', file: null });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Inviting a teammate
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: '', share: '30', notes: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      const [projectRes, payoutsRes] = await Promise.all([
        api.get(`/campaigns/${id}/`),
        api.get('/payments/payouts/me/').catch(() => ({ data: NO_PAYOUTS })),
      ]);
      setCampaign(projectRes.data);
      setPayoutsData(payoutsRes.data || NO_PAYOUTS);
    } catch (err) {
      if (err.response?.status !== 404) showToast(getErrorMessage(err, 'Could not load this project.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const openMilestoneModal = (milestone) => {
    setMilestoneTarget(milestone);
    setMilestoneForm({ url: milestone.deliverable_url || '', notes: '', file: null });
    setMilestoneError('');
  };

  const handleSubmitMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneForm.url.trim() && !milestoneForm.file) {
      setMilestoneError('Add a link to your work or attach a file.');
      return;
    }
    setSubmittingMilestone(true);
    setMilestoneError('');
    try {
      const formData = new FormData();
      if (milestoneForm.url.trim()) formData.append('deliverable_url', milestoneForm.url.trim());
      formData.append('deliverable_notes', milestoneForm.notes);
      if (milestoneForm.file) formData.append('deliverable_file', milestoneForm.file);
      await api.post(`/campaigns/${id}/milestones/${milestoneTarget.id}/submit/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Milestone submitted. The client has been notified.', 'success');
      setMilestoneTarget(null);
      await fetchProject();
    } catch (err) {
      setMilestoneError(getErrorMessage(err, 'Could not submit this milestone.'));
    } finally {
      setSubmittingMilestone(false);
    }
  };

  const openShareModal = () => {
    setDeliverable({ title: `${campaign.title} – deliverable`, url: '', role: '', summary: '', file: null });
    setSubmitError('');
    setSharing(true);
  };

  const handleShareFile = async (e) => {
    e.preventDefault();
    if (!deliverable.url.trim() && !deliverable.file) {
      setSubmitError('Add a link to your work or attach a file.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const formData = new FormData();
      formData.append('title', deliverable.title);
      if (deliverable.url.trim()) formData.append('external_url', deliverable.url.trim());
      formData.append('contribution_role', deliverable.role);
      formData.append('contribution_summary', deliverable.summary);
      if (deliverable.file) formData.append('file', deliverable.file);
      await api.post(`/campaigns/${id}/student-deliverable/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Shared with the client. They have been notified.', 'success');
      setSharing(false);
      await fetchProject();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not share your work.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openInviteModal = () => {
    setInvite({ email: '', role: '', share: '30', notes: '' });
    setInviteError('');
    setInviteOpen(true);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    try {
      await api.post(`/campaigns/${id}/team/invite/`, {
        email: invite.email.trim(),
        role_in_project: invite.role.trim(),
        payout_share_percentage: parseInt(invite.share, 10) || 0,
        notes: invite.notes,
      });
      showToast(`Invitation sent to ${invite.email.trim()}.`, 'success');
      setInviteOpen(false);
      await fetchProject();
    } catch (err) {
      setInviteError(getErrorMessage(err, 'Could not send the invitation.'));
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <PageLoader message="Loading project…" />;

  // Any signed-in student can load a project's public brief, so check they are actually on this one
  const onTeam = Boolean(campaign) && (campaign.assigned_students || []).includes(myProfileId);
  if (!onTeam) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] font-body">
        <WorkspaceNav />
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <AlertCircle size={40} className="mx-auto text-[#5B6478]/50 mb-3" />
          <h1 className="font-heading font-bold text-xl mb-2">This project isn&apos;t one of yours</h1>
          <p className="text-sm text-[#5B6478] mb-6">It may have been removed, or you are not on its team.</p>
          <button onClick={() => navigate('/student/projects')} className="btn-primary">Back to projects</button>
        </div>
      </div>
    );
  }

  const team = campaign.assigned_students_details || [];
  const milestones = campaign.milestones || [];
  const assets = campaign.client_assets || [];
  const sharedFiles = campaign.student_deliverables || [];
  const invitations = campaign.team_invitations || [];
  const pendingInvites = invitations.filter((i) => i.status === 'PENDING');
  const joinedBy = Object.fromEntries(invitations.filter((i) => i.status === 'ACCEPTED' && i.invitee_student).map((i) => [i.invitee_student, i]));
  const offerStatus = Object.fromEntries((campaign.match_offers || []).map((o) => [o.student, o.status]));
  const pendingOffer = campaign.my_offer?.status === 'PENDING';
  const inProgress = campaign.status === 'IN_PROGRESS';
  const isCompleted = campaign.status === 'COMPLETED';
  const myPayouts = (payoutsData.payouts || []).filter((p) => p.campaign === campaign.id);
  const skills = campaign.required_skills?.length ? campaign.required_skills : campaign.target_platforms || [];

  // The one thing to do next sits in the banner; a milestone's own row doesn't repeat that button
  const next = inProgress ? nextMilestoneToSubmit(campaign) : null;
  const step = studentNextStep(campaign);
  // Work handed in against a milestone lives on the milestone; list it with the other shared files
  const milestoneSubmissions = milestones.filter(
    (m) => ['SUBMITTED', 'APPROVED'].includes(m.status) && (m.deliverable_url || m.deliverable_file || m.deliverable_notes),
  );
  const submittedCount = milestoneSubmissions.length + sharedFiles.length;

  const openTab = (key) => {
    setActiveTab(key);
    requestAnimationFrame(() => document.getElementById('project-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />

      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6 flex-1 animate-fade-in">
        <Link to="/student/projects" className="back-link">
          <ArrowLeft size={15} /> Back to projects
        </Link>

        {/* Header */}
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="badge bg-[#00AEEF]/10 border-transparent text-[#00729F]">{campaignTypeLabel(campaign.type)}</span>
            <StatusBadge status={campaign.status} />
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight">{campaign.title}</h1>
          <p className="text-sm text-[#5B6478] mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>Client: <strong className="text-[#0A1748]">{campaign.company_name}</strong></span>
            <span>
              Team pay: <strong className="text-[#0B1E63]">{formatMoney(campaign.student_pool ?? campaign.budget)}</strong>
              {campaign.student_pool && <span className="text-xs"> (after {campaign.service_fee_percent}% UniPact fee)</span>}
            </span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> Due {formatDate(campaign.deadline, 'flexible')}</span>
          </p>
          <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)]">
            <ProjectProgress campaign={campaign} viewer="student" myProfileId={myProfileId} />
          </div>
          {isCompleted && <ImpactLedgerPanel campaignId={campaign.id} />}
        </section>

        {/* What to do next */}
        {pendingOffer ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border-2 border-[#00AEEF] shadow-sm">
            <div className="flex items-start gap-3 text-sm">
              <Sparkles size={20} className="text-[#00AEEF] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-base">You haven&apos;t answered this offer yet</strong>
                <span className="text-[#5B6478]">Accept or decline it from your workspace. The client&apos;s files unlock once you accept.</span>
              </div>
            </div>
            <Link to="/student/dashboard" className="btn-primary self-start sm:self-auto shrink-0 whitespace-nowrap">Go to my offers</Link>
          </div>
        ) : step.text && (
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white ${step.action ? 'border-2 border-[#00AEEF] shadow-sm' : 'border border-[rgba(10,23,72,0.12)]'}`}>
            <div className="flex items-start gap-3 text-sm">
              {isCompleted ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                : step.action ? <Flag size={18} className="text-[#00AEEF] shrink-0 mt-0.5" />
                  : <Info size={18} className="text-[#00AEEF] shrink-0 mt-0.5" />}
              <span>{step.text}</span>
            </div>
            {inProgress && (next ? (
              <button onClick={() => openMilestoneModal(next)} className="btn-primary self-start sm:self-auto shrink-0 whitespace-nowrap">
                <Upload size={15} /> {next.status === 'REVISION_REQUESTED' ? 'Resubmit' : 'Submit'} milestone {next.step_number}
              </button>
            ) : (
              <button onClick={openShareModal} className={`${milestones.length > 0 ? 'btn-secondary' : 'btn-primary'} self-start sm:self-auto shrink-0 whitespace-nowrap`}>
                <Upload size={15} /> {milestones.length > 0 ? 'Share another file' : 'Submit work'}
              </button>
            ))}
          </div>
        )}

        {/* Sections */}
        <div id="project-tabs" role="tablist" className="flex gap-1 sm:gap-4 border-b border-[rgba(10,23,72,0.12)] overflow-x-auto overflow-y-hidden scroll-mt-24">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 px-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap flex items-center gap-2 transition-colors ${
                activeTab === key ? 'border-[#00AEEF] text-[#00729F]' : 'border-transparent text-[#5B6478] hover:text-[#0A1748]'
              }`}
            >
              {icon} {label}
              {key === 'work' && step.action && next && <span className="badge bg-amber-50 border-amber-200 text-amber-800 px-1.5 py-0">1</span>}
              {key === 'messages' && chat.unread > 0 && <span className="badge bg-[#00AEEF] border-transparent text-[#0A1748] px-1.5 py-0">{chat.unread}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <ProjectOverview
            campaign={campaign}
            stats={studentStats(campaign, myPayouts)}
            events={latestEvents(campaign, { viewer: 'student', myProfileId })}
            myProfileId={myProfileId}
            noTeamText="No one is on this project yet."
            onOpenTab={openTab}
          />
        )}

        {activeTab === 'work' && (
          <div className="space-y-6">
            <section className="card p-6 sm:p-8">
              <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-1">
                <Flag size={18} className="text-[#00AEEF]" /> Milestones ({milestones.length})
              </h2>
              <p className="text-sm text-[#5B6478] mb-4">Submit your work against a milestone. You&apos;re paid for it once the client approves it.</p>
              {milestones.length === 0 ? (
                <p className="text-sm text-[#5B6478]">This project has no milestone plan. Share your work with the client below.</p>
              ) : (
                <div className="space-y-3">
                  {milestones.map((m) => (
                    <div key={m.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 text-sm">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div className="font-semibold text-base">{m.step_number}. {m.title}</div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-[#0B1E63]">{formatMoney(m.amount)}</span>
                          <StatusBadge status={m.status} />
                        </div>
                      </div>
                      {m.description && <p className="text-[#5B6478] mt-1">{m.description}</p>}
                      {['PENDING', 'IN_PROGRESS'].includes(m.status) && (
                        <p className="mt-2 text-xs text-[#5B6478]">
                          {inProgress ? 'Not submitted yet.' : 'You can submit this once the project has started.'}
                        </p>
                      )}
                      {m.status === 'REVISION_REQUESTED' && (
                        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                          <strong>Client feedback</strong> (revision {m.revisions_used} of {m.max_revisions}): {m.deliverable_notes || 'No written feedback.'}
                        </p>
                      )}
                      {m.status === 'SUBMITTED' && (
                        <p className="mt-2 text-xs text-[#5B6478]">
                          With the client for review since {formatDate(m.submitted_at)}.
                          {m.review_due_at && ` If they don't respond by ${formatDate(m.review_due_at)}, it is accepted automatically.`}
                        </p>
                      )}
                      {m.status === 'APPROVED' && (
                        <p className="mt-2 text-xs text-[#5B6478]">
                          Accepted{m.auto_approved ? ' automatically' : ''}{m.approved_at ? ` on ${formatDate(m.approved_at)}` : ''}. UniPact pays you within 7 working days.
                        </p>
                      )}
                      {inProgress && canSubmitMilestone(m) && m.id !== next?.id && (
                        <button onClick={() => openMilestoneModal(m)} className="btn-secondary btn-sm mt-3">
                          <Upload size={13} /> {m.status === 'REVISION_REQUESTED' ? 'Resubmit' : 'Submit milestone'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-heading text-lg font-bold">Submitted work ({submittedCount})</h2>
                {inProgress && (
                  <button onClick={openShareModal} className="btn-secondary btn-sm">
                    <Upload size={13} /> Share another file
                  </button>
                )}
              </div>
              {submittedCount === 0 ? (
                <p className="text-sm text-[#5B6478]">Nothing submitted yet. What you and your teammates hand in appears here.</p>
              ) : (
                <div className="space-y-3">
                  {milestoneSubmissions.map((m) => (
                    <div key={`milestone-${m.id}`} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 text-sm">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                        <div className="font-semibold text-base">Milestone {m.step_number}: {m.title}</div>
                        <span className="text-xs text-[#5B6478]">{formatDate(m.submitted_at, '')}</span>
                      </div>
                      <div className="text-[#5B6478] mb-2">{m.status === 'APPROVED' ? 'Approved by the client' : 'With the client for review'}</div>
                      {m.deliverable_notes && <p className="bg-white p-3 rounded border border-[rgba(10,23,72,0.06)] mb-2">{m.deliverable_notes}</p>}
                      <div className="flex flex-wrap gap-4">
                        {m.deliverable_url && <a href={m.deliverable_url} target="_blank" rel="noreferrer" className="text-[#00729F] font-semibold hover:underline inline-flex items-center gap-1">Open link <ArrowUpRight size={13} /></a>}
                        {m.deliverable_file && <a href={m.deliverable_file} target="_blank" rel="noreferrer" className="text-[#00729F] font-semibold hover:underline inline-flex items-center gap-1"><Download size={13} /> Download file</a>}
                      </div>
                    </div>
                  ))}
                  {sharedFiles.map((s) => (
                    <div key={s.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 text-sm">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                        <div className="font-semibold text-base">{s.title}</div>
                        <span className="text-xs text-[#5B6478]">{formatDate(s.submitted_at)}</span>
                      </div>
                      <div className="text-[#5B6478] mb-2">{s.student_name}{s.contribution_role && <> · {s.contribution_role}</>}</div>
                      {s.contribution_summary && <p className="bg-white p-3 rounded border border-[rgba(10,23,72,0.06)] mb-2">{s.contribution_summary}</p>}
                      <div className="flex flex-wrap gap-4">
                        {s.external_url && <a href={s.external_url} target="_blank" rel="noreferrer" className="text-[#00729F] font-semibold hover:underline inline-flex items-center gap-1">Open link <ArrowUpRight size={13} /></a>}
                        {s.file && <a href={s.file} target="_blank" rel="noreferrer" className="text-[#00729F] font-semibold hover:underline inline-flex items-center gap-1"><Download size={13} /> Download file</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'messages' && <ProjectMessages chat={chat} viewer="student" started={chatEnabled && !pendingOffer} />}

        {activeTab === 'team' && (
          <section className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-heading text-lg font-bold flex items-center gap-2">
                <Users size={18} className="text-[#00AEEF]" /> Project team ({team.length})
              </h2>
              {!isCompleted && !pendingOffer && (
                <button onClick={openInviteModal} className="btn-secondary btn-sm">
                  <UserPlus size={13} /> Invite teammate
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {team.map((member) => {
                const joined = joinedBy[member.id];
                return (
                  <Link key={member.id} to={`/student/profile/${member.user_id}`} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] hover:border-[#00AEEF] rounded-lg p-4 text-sm group">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold group-hover:text-[#00729F]">{member.full_name}</span>
                      {member.id === myProfileId && <span className="badge bg-[#00AEEF]/15 border-transparent text-[#00729F] px-1.5 py-0 text-[10px]">You</span>}
                    </div>
                    {campaign.status === 'MATCHED' && offerStatus[member.id] && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-1 ${offerStatus[member.id] === 'ACCEPTED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {offerStatus[member.id] === 'ACCEPTED' ? <><CheckCircle2 size={12} /> Accepted</> : <><Clock size={12} /> Waiting to accept</>}
                      </span>
                    )}
                    <div className="text-xs text-[#5B6478] mt-0.5">{[member.university, member.major].filter(Boolean).join(' • ')}</div>
                    {joined && (
                      <div className="text-xs text-[#0A1748] mt-1">
                        {joined.role_in_project} · {joined.payout_share_percentage}% of each payout · invited by {joined.invited_by_name}
                      </div>
                    )}
                    {member.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {member.skills.map((skill) => (
                          <span key={skill} className="text-[11px] px-2 py-0.5 rounded bg-white border border-[rgba(10,23,72,0.08)]">{skill}</span>
                        ))}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-[#00729F] inline-flex items-center gap-1 mt-2">View portfolio <ArrowUpRight size={12} /></span>
                  </Link>
                );
              })}
            </div>
            {pendingInvites.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)]">
                <h3 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">Invitations waiting for a reply</h3>
                <ul className="space-y-2 text-sm">
                  {pendingInvites.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                      <span className="min-w-0 break-all">{inv.invitee_email}</span>
                      <span className="text-xs">{inv.role_in_project} · {inv.payout_share_percentage}% · sent {formatDate(inv.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-[#5B6478] mt-5">
              A teammate you invite keeps the payout share you agree with them; whoever UniPact matched to the project shares the rest.
            </p>
          </section>
        )}

        {activeTab === 'earnings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="card p-6 sm:p-8">
                <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-1">
                  <Wallet size={18} className="text-[#00AEEF]" /> How this project pays
                </h2>
                <p className="text-sm text-[#5B6478] mb-4">
                  The team earns {formatMoney(campaign.student_pool ?? campaign.budget)} in total
                  {campaign.student_pool && `, which is the client's fee after UniPact's ${campaign.service_fee_percent}% service fee`}.
                  Each milestone&apos;s amount is released when the client approves it, and UniPact pays it out within 7 working days.
                </p>
                {milestones.length === 0 ? (
                  <p className="text-sm text-[#5B6478]">This project has no milestone plan yet.</p>
                ) : (
                  <ul className="divide-y divide-[rgba(10,23,72,0.08)] text-sm">
                    {milestones.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="font-medium break-words">{m.step_number}. {m.title}</span>
                          <span className="block text-xs text-[#5B6478]">
                            {Number(m.percentage)}% of the team pay
                            {m.status === 'APPROVED' && m.approved_at && ` · released ${formatDate(m.approved_at)}`}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-heading font-bold text-[#0B1E63]">{formatMoney(m.amount)}</span>
                          <span className={`badge ${
                            m.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : m.status === 'SUBMITTED' ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {m.status === 'APPROVED' ? 'Released' : m.status === 'SUBMITTED' ? 'With the client' : 'Not released yet'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {team.length > 1 && <p className="text-xs text-[#5B6478] mt-4">These are the team&apos;s amounts. Each one is split between teammates by their agreed shares.</p>}
              </section>
            </div>

            <div className="space-y-6">
              <section className="card p-6 text-sm">
                <h2 className="font-heading text-lg font-bold mb-3">Your payouts</h2>
                {myPayouts.length === 0 ? (
                  <p className="text-[#5B6478]">None yet. A payout is created for you each time the client approves a milestone.</p>
                ) : (
                  <ul className="space-y-4">
                    {myPayouts.map((p) => (
                      <li key={p.id}>
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium min-w-0 break-words">{p.milestone_title || 'Project payout'}</span>
                          <span className="font-heading font-bold text-[#0B1E63] shrink-0">{formatMoney(p.amount)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <StatusBadge status={p.status} label={p.status === 'PENDING' ? 'Awaiting bank details' : undefined} />
                          <span className="text-xs text-[#5B6478]">
                            {p.paid_at ? `Paid ${formatDate(p.paid_at)}` : p.due_at ? `Expected by ${formatDate(p.due_at)}` : ''}
                          </span>
                        </div>
                        {p.transfer_reference && <div className="text-xs text-[#5B6478] mt-1 break-all">Ref {p.transfer_reference}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card p-6 text-sm">
                <h2 className="font-heading text-lg font-bold flex items-center gap-2 mb-3">
                  <CreditCard size={18} className="text-[#00AEEF]" /> Payout account
                </h2>
                {payoutsData.has_bank_details ? (
                  <p>
                    <span className="font-semibold">{payoutsData.bank_details?.bank_name}</span>
                    <span className="block text-xs font-mono text-[#5B6478] mt-0.5">****{payoutsData.bank_details?.bank_account_number?.slice(-4)}</span>
                  </p>
                ) : (
                  <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    No bank account on file. Add one so UniPact can pay you.
                  </p>
                )}
                <Link to="/settings#payouts" className="text-sm font-semibold text-[#00729F] hover:underline inline-block mt-3">
                  {payoutsData.has_bank_details ? 'Update bank details' : 'Add bank details'}
                </Link>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'brief' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="card p-6 sm:p-8 space-y-4 lg:col-span-2">
              <h2 className="font-heading text-lg font-bold">Project brief</h2>
              {campaign.description && <p className="text-sm leading-relaxed whitespace-pre-line">{campaign.description}</p>}
              {campaign.match_notes && (
                <p className="text-sm bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-3">
                  <strong className="text-[#00729F]">Why you were matched:</strong> {campaign.match_notes}
                </p>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {campaign.software_sub_type && <div><dt className="text-[#5B6478]">Project type</dt><dd className="font-semibold">{campaign.software_sub_type}</dd></div>}
                {campaign.campaign_objective && <div><dt className="text-[#5B6478]">Objective</dt><dd className="font-semibold">{campaign.campaign_objective}</dd></div>}
                {skills.length > 0 && <div><dt className="text-[#5B6478]">Skills</dt><dd className="font-semibold">{skills.join(', ')}</dd></div>}
                {campaign.project_outcome && <div className="sm:col-span-2"><dt className="text-[#5B6478]">Expected outcome</dt><dd>{campaign.project_outcome}</dd></div>}
              </dl>
              {campaign.requirements?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">What the client needs</h3>
                  <ul className="space-y-1.5 text-sm">
                    {campaign.requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2"><CheckCircle2 size={15} className="text-[#00AEEF] shrink-0 mt-0.5" /> {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <aside className="card p-6 h-fit space-y-4">
              <div>
                <h2 className="font-heading text-lg font-bold">Files from the client</h2>
                <p className="text-sm text-[#5B6478]">Briefs, brand assets and raw material for this project.</p>
              </div>
              {assets.length === 0 ? (
                <p className="text-sm text-[#5B6478] italic">
                  {pendingOffer ? 'The client\'s files unlock once you accept the offer.' : 'The client hasn\'t shared any files yet.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {assets.map((a) => (
                    <li key={a.id}>
                      <a href={a.file} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-[rgba(10,23,72,0.08)] bg-[#F5F7FC] hover:border-[#00AEEF] text-sm group">
                        <FileText size={16} className="text-[#00AEEF] shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.title}</span>
                          <span className="block text-xs text-[#5B6478]">{formatDate(a.uploaded_at)}</span>
                        </span>
                        <Download size={15} className="text-[#5B6478] group-hover:text-[#00729F] shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </main>

      {/* Milestone submission modal (managed escrow) */}
      <Modal
        isOpen={!!milestoneTarget}
        onClose={() => !submittingMilestone && setMilestoneTarget(null)}
        title={milestoneTarget?.status === 'REVISION_REQUESTED' ? 'Resubmit milestone' : 'Submit milestone'}
        subtitle={milestoneTarget ? `${milestoneTarget.title} · ${campaign.title}` : ''}
        icon={<Flag size={20} />}
        maxWidth="max-w-xl"
      >
        {milestoneError && (
          <div className="alert-error mb-4"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{milestoneError}</span></div>
        )}
        <form onSubmit={handleSubmitMilestone} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="milestone-url">Link to your work</label>
            <input id="milestone-url" type="url" value={milestoneForm.url} onChange={(e) => setMilestoneForm({ ...milestoneForm, url: e.target.value })} placeholder="https://github.com/… or https://staging.example.com" className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="milestone-file">Or attach a file</label>
            <input id="milestone-file" type="file" onChange={(e) => setMilestoneForm({ ...milestoneForm, file: e.target.files?.[0] || null })} className="input file:mr-3 file:rounded file:border-0 file:bg-[#0B1E63] file:text-white file:px-3 file:py-1 file:text-xs" />
            <p className="field-hint">Provide a link, a file, or both.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="milestone-notes">Notes for the client (optional)</label>
            <textarea id="milestone-notes" rows={3} value={milestoneForm.notes} onChange={(e) => setMilestoneForm({ ...milestoneForm, notes: e.target.value })} placeholder="What's included in this milestone?" className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
            <button type="button" onClick={() => setMilestoneTarget(null)} disabled={submittingMilestone} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submittingMilestone} className="btn-primary">
              {submittingMilestone ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : 'Submit milestone'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Sharing a file outside a milestone */}
      <Modal
        isOpen={sharing}
        onClose={() => !submitting && setSharing(false)}
        title={milestones.length > 0 ? 'Share another file' : 'Submit your work'}
        subtitle={`${campaign.title} · ${campaign.company_name}`}
        icon={<Upload size={20} />}
        maxWidth="max-w-xl"
      >
        {submitError && (
          <div className="alert-error mb-4"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{submitError}</span></div>
        )}
        <form onSubmit={handleShareFile} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="deliv-title">Title</label>
            <input id="deliv-title" required value={deliverable.title} onChange={(e) => setDeliverable({ ...deliverable, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="deliv-url">Link to your work</label>
            <input id="deliv-url" type="url" value={deliverable.url} onChange={(e) => setDeliverable({ ...deliverable, url: e.target.value })} placeholder="https://github.com/… or https://staging.example.com" className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="deliv-file">Or attach a file</label>
            <input id="deliv-file" type="file" onChange={(e) => setDeliverable({ ...deliverable, file: e.target.files?.[0] || null })} className="input file:mr-3 file:rounded file:border-0 file:bg-[#0B1E63] file:text-white file:px-3 file:py-1 file:text-xs" />
            <p className="field-hint">PDF, ZIP, MP4 or any file the client asked for. Provide a link, a file, or both.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="deliv-role">Your role on this deliverable</label>
            <input id="deliv-role" required value={deliverable.role} onChange={(e) => setDeliverable({ ...deliverable, role: e.target.value })} placeholder="e.g. Lead full-stack developer" className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="deliv-summary">What did you do?</label>
            <textarea id="deliv-summary" rows={3} required value={deliverable.summary} onChange={(e) => setDeliverable({ ...deliverable, summary: e.target.value })} placeholder="Summarise what you built or produced. This appears on your verified portfolio." className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
            <button type="button" onClick={() => setSharing(false)} disabled={submitting} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : 'Share with the client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invite teammate modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => !inviting && setInviteOpen(false)}
        title="Invite a teammate"
        subtitle={`${campaign.title} · ${campaign.company_name}`}
        icon={<UserPlus size={20} />}
      >
        {inviteError && (
          <div className="alert-error mb-4"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{inviteError}</span></div>
        )}
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="invite-email">Student&apos;s email</label>
            <input id="invite-email" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="classmate@university.edu.my" className="input" />
            <p className="field-hint">We&apos;ll email them the invitation. If they&apos;re not on UniPact yet, they can sign up with this email and find it on their dashboard.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="invite-role">Their role</label>
              <input id="invite-role" required value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} placeholder="e.g. UI/UX designer" className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="invite-share">Payout share</label>
              <div className="relative">
                <input id="invite-share" type="number" min="0" max="100" step="1" required value={invite.share} onChange={(e) => setInvite({ ...invite, share: e.target.value })} className="input pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6478] text-sm">%</span>
              </div>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="invite-notes">Notes (optional)</label>
            <textarea id="invite-notes" rows={3} value={invite.notes} onChange={(e) => setInvite({ ...invite, notes: e.target.value })} placeholder="What would you like them to work on?" className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
            <button type="button" onClick={() => setInviteOpen(false)} disabled={inviting} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={inviting} className="btn-primary">
              {inviting ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><UserPlus size={15} /> Send invitation</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentProject;
