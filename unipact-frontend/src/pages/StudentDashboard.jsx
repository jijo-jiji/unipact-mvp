import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { campaignTypeLabel, domainLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';
import {
  GraduationCap,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
  Share2,
  Upload,
  Users,
  UserPlus,
  Check,
  X,
  ExternalLink,
  FileText,
  Download,
  CalendarDays,
  Compass,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

const SectionHeading = ({ title, description, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
    <div>
      <h2 className="font-heading font-bold text-xl text-[#0A1748]">{title}</h2>
      {description && <p className="text-sm text-[#5B6478] mt-0.5">{description}</p>}
    </div>
    {action}
  </div>
);

const StudentDashboard = () => {
  usePageTitle('My workspace');
  const { user } = useAuth();
  const { showToast } = useToast();
  const isClub = user?.role === 'CLUB';

  const [assignedJobs, setAssignedJobs] = useState([]);
  const [clubApplications, setClubApplications] = useState([]);
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Deliverable modal state
  const [activeJob, setActiveJob] = useState(null);
  const [deliverable, setDeliverable] = useState({ title: '', url: '', role: '', summary: '', file: null });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Invite teammate modal state
  const [inviteModalJob, setInviteModalJob] = useState(null);
  const [invite, setInvite] = useState({ email: '', role: '', share: '30', notes: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      if (isClub) {
        const res = await api.get('/campaigns/applications/me/');
        setClubApplications(res.data);
      } else {
        const [jobsRes, invitesRes] = await Promise.all([
          api.get('/campaigns/student/assigned/'),
          api.get('/campaigns/team/invitations/me/'),
        ]);
        setAssignedJobs(jobsRes.data);
        setIncomingInvites(invitesRes.data);
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load your workspace.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [isClub, showToast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const studentProfile = user?.student_profile || {};
  const verificationStatus = isClub ? user?.club_profile?.verification_status : studentProfile.verification_status;
  const isVerified = verificationStatus === 'VERIFIED';
  const portfolioPath = `/student/profile/${user?.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${portfolioPath}`);
      showToast('Portfolio link copied to your clipboard.', 'success');
    } catch {
      showToast('Could not copy automatically. Open your portfolio and copy the address bar link.', 'error');
    }
  };

  const handleRespondInvitation = async (inv, action) => {
    setActionLoading(inv.id);
    try {
      const res = await api.post(`/campaigns/team/invitations/${inv.id}/respond/`, { action });
      showToast(res.data?.message || (action === 'accept' ? 'You joined the team.' : 'Invitation declined.'), 'success');
      await fetchDashboard();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the invitation.'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openInviteModal = (job) => {
    setInviteModalJob(job);
    setInvite({ email: '', role: '', share: '30', notes: '' });
    setInviteError('');
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    try {
      await api.post(`/campaigns/${inviteModalJob.id}/team/invite/`, {
        email: invite.email.trim(),
        role_in_project: invite.role.trim(),
        payout_share_percentage: parseInt(invite.share, 10) || 0,
        notes: invite.notes,
      });
      showToast(`Invitation sent to ${invite.email.trim()}.`, 'success');
      setInviteModalJob(null);
      await fetchDashboard();
    } catch (err) {
      setInviteError(getErrorMessage(err, 'Could not send the invitation.'));
    } finally {
      setInviting(false);
    }
  };

  const openSubmitModal = (job) => {
    setActiveJob(job);
    setDeliverable({ title: `${job.title} – deliverable`, url: '', role: '', summary: '', file: null });
    setSubmitError('');
  };

  const handleSubmitDeliverable = async (e) => {
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

      await api.post(`/campaigns/${activeJob.id}/student-deliverable/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Deliverable submitted. The client has been notified.', 'success');
      setActiveJob(null);
      await fetchDashboard();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not submit your deliverable.'));
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = assignedJobs.filter((j) => ['IN_PROGRESS', 'MATCHED'].includes(j.status)).length;
  const completedCount = assignedJobs.filter((j) => j.status === 'COMPLETED').length;
  const displayName = isClub ? user?.club_profile?.club_name || user?.name : studentProfile.full_name || user?.name;

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />

      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-8 flex-1">

        {/* Profile header */}
        <section className="card p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#0B1E63] flex items-center justify-center shadow-md shrink-0">
              {isClub ? <Users size={30} className="text-[#00AEEF]" /> : <GraduationCap size={32} className="text-[#00AEEF]" />}
            </div>
            <div>
              <p className="eyebrow mb-1"><span className="eyebrow-dot" /> Welcome back</p>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="font-heading font-extrabold text-2xl text-[#0A1748]">{displayName || 'Your workspace'}</h1>
                {isVerified ? (
                  <span className="badge bg-emerald-50 border-emerald-200 text-emerald-700"><ShieldCheck size={13} /> Verified</span>
                ) : (
                  <span className="badge bg-amber-50 border-amber-200 text-amber-800"><AlertCircle size={13} /> Pending review</span>
                )}
              </div>
              <p className="text-[#5B6478] text-sm">
                {isClub
                  ? user?.club_profile?.university || 'Student club'
                  : [studentProfile.university, studentProfile.major].filter(Boolean).join(' • ') || 'University student'}
                {!isClub && studentProfile.club_affiliation_name && (
                  <span className="text-[#0B1E63] font-medium"> • {studentProfile.club_affiliation_role || 'Member'}, {studentProfile.club_affiliation_name}</span>
                )}
              </p>
            </div>
          </div>

          {isClub ? (
            <Link to="/quests" className="btn-primary self-start md:self-auto">
              <Compass size={16} /> Browse open quests
            </Link>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleCopyLink} className="btn-secondary">
                <Share2 size={15} className="text-[#00AEEF]" /> Copy portfolio link
              </button>
              <Link to={portfolioPath} className="btn-primary">
                View my portfolio <ExternalLink size={15} />
              </Link>
            </div>
          )}
        </section>

        {!isVerified && (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl text-sm text-amber-900 flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-950 font-semibold mb-0.5">Your account is being verified</strong>
              {isClub
                ? 'A UniPact admin is reviewing your club documents. You can browse quests in the meantime.'
                : 'A UniPact admin is checking your student credentials. Once verified, you become eligible for curated project matches.'}
            </div>
          </div>
        )}

        {loading ? (
          <div className="card p-12 flex items-center justify-center gap-3 text-[#5B6478] text-sm">
            <Loader2 size={18} className="animate-spin text-[#00AEEF]" /> Loading your workspace…
          </div>
        ) : isClub ? (
          <ClubApplications applications={clubApplications} />
        ) : (
          <>
            {/* Incoming team invitations */}
            {incomingInvites.length > 0 && (
              <section className="card border-2 border-[#00AEEF] p-6 animate-fade-in">
                <SectionHeading
                  title={`Team invitations (${incomingInvites.length})`}
                  description="Other students have invited you to join their project team. Review the role and payout share before accepting."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {incomingInvites.map((inv) => (
                    <div key={inv.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] rounded-lg p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="font-heading font-bold text-base text-[#0A1748]">{inv.campaign_title}</h3>
                          <span className="text-xs text-[#5B6478] whitespace-nowrap">{formatDate(inv.created_at)}</span>
                        </div>
                        <dl className="text-sm space-y-1.5 py-3 border-y border-[rgba(10,23,72,0.08)] mb-3">
                          {[
                            ['Client', inv.campaign_company_name],
                            ['Invited by', inv.invited_by_name],
                            ['Your role', inv.role_in_project],
                            ['Payout share', `${inv.payout_share_percentage}%`],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-3">
                              <dt className="text-[#5B6478]">{label}</dt>
                              <dd className="font-semibold text-right">{value || '—'}</dd>
                            </div>
                          ))}
                        </dl>
                        {inv.notes && <p className="text-sm text-[#5B6478] italic mb-3">“{inv.notes}”</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleRespondInvitation(inv, 'accept')} disabled={actionLoading === inv.id} className="btn-primary flex-1">
                          <Check size={15} /> Accept & join
                        </button>
                        <button onClick={() => handleRespondInvitation(inv, 'decline')} disabled={actionLoading === inv.id} className="btn-danger">
                          <X size={15} /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Metrics */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active projects', value: activeCount, className: 'text-[#0B1E63]' },
                { label: 'Completed', value: completedCount, className: 'text-emerald-600' },
                { label: 'Client rating', value: `${studentProfile.rating || '5.00'} ★`, className: 'text-amber-500' },
                { label: 'Track', value: domainLabel(studentProfile.domain_focus), className: 'text-[#0A1748] text-base sm:text-lg pt-1.5' },
              ].map((m) => (
                <div key={m.label} className="card p-5">
                  <span className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] block mb-1">{m.label}</span>
                  <div className={`font-heading text-3xl font-extrabold ${m.className}`}>{m.value}</div>
                </div>
              ))}
            </section>

            {/* Project workspaces */}
            <section className="space-y-4">
              <SectionHeading title="Your projects" description="Projects you have been matched to or joined as a teammate." />

              {assignedJobs.length === 0 ? (
                <div className="card p-12 text-center">
                  <Briefcase className="w-12 h-12 text-[#5B6478]/40 mx-auto mb-3" />
                  <h3 className="font-heading font-bold text-lg mb-1">No projects yet</h3>
                  <p className="text-[#5B6478] text-sm max-w-md mx-auto">
                    When a UniPact admin matches you to a client project, or a classmate invites you to their team, it will show up here.
                    Keeping your portfolio up to date improves your chances.
                  </p>
                  <Link to={portfolioPath} className="btn-secondary mt-5">View my portfolio</Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {assignedJobs.map((job) => (
                    <ProjectCard
                      key={job.id}
                      job={job}
                      myProfileId={studentProfile.id}
                      onSubmit={() => openSubmitModal(job)}
                      onInvite={() => openInviteModal(job)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Deliverable submission modal */}
      <Modal
        isOpen={!!activeJob}
        onClose={() => !submitting && setActiveJob(null)}
        title="Submit your work"
        subtitle={activeJob ? `${activeJob.title} · ${activeJob.company_name}` : ''}
        icon={<Upload size={20} />}
        maxWidth="max-w-xl"
      >
        {submitError && (
          <div className="alert-error mb-4"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{submitError}</span></div>
        )}
        <form onSubmit={handleSubmitDeliverable} className="space-y-4">
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
            <button type="button" onClick={() => setActiveJob(null)} disabled={submitting} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : 'Submit deliverable'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invite teammate modal */}
      <Modal
        isOpen={!!inviteModalJob}
        onClose={() => !inviting && setInviteModalJob(null)}
        title="Invite a teammate"
        subtitle={inviteModalJob ? `${inviteModalJob.title} · ${inviteModalJob.company_name}` : ''}
        icon={<UserPlus size={20} />}
      >
        {inviteError && (
          <div className="alert-error mb-4"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{inviteError}</span></div>
        )}
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="invite-email">Student&apos;s email</label>
            <input id="invite-email" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="classmate@university.edu.my" className="input" />
            <p className="field-hint">Use the email they registered on UniPact with, so the invite shows up on their dashboard.</p>
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
            <button type="button" onClick={() => setInviteModalJob(null)} disabled={inviting} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={inviting} className="btn-primary">
              {inviting ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><UserPlus size={15} /> Send invitation</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const ProjectCard = ({ job, myProfileId, onSubmit, onInvite }) => {
  const pendingInvites = (job.team_invitations || []).filter((i) => i.status === 'PENDING');
  const team = job.assigned_students_details || [];
  const assets = job.client_assets || [];
  const submissions = job.student_deliverables || [];
  const isOpen = job.status !== 'COMPLETED';

  return (
    <article className="card p-6 sm:p-8 hover:border-[#00AEEF] transition-colors">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6]">{campaignTypeLabel(job.type)}</span>
            <StatusBadge status={job.status} />
          </div>
          <h3 className="font-heading font-bold text-xl text-[#0A1748]">{job.title}</h3>
          <p className="text-[#5B6478] text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>Client: <strong className="text-[#0A1748]">{job.company_name}</strong></span>
            <span>Budget: <strong className="text-[#0B1E63]">{formatMoney(job.budget)}</strong></span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> Due {formatDate(job.deadline, 'flexible')}</span>
          </p>
        </div>
        {isOpen && (
          <button onClick={onSubmit} className="btn-primary self-start">
            <Upload size={15} /> Submit work
          </button>
        )}
      </div>

      {job.status === 'MATCHED' && (
        <p className="mt-4 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
          You&apos;ve been matched! Work starts once the client confirms the match.
        </p>
      )}

      {job.description && <p className="mt-4 text-sm text-[#0A1748] leading-relaxed">{job.description}</p>}

      {job.match_notes && (
        <div className="mt-4 p-3.5 bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg text-sm">
          <strong className="text-[#0090C6]">Why you were matched:</strong> {job.match_notes}
        </div>
      )}

      {/* Requirements */}
      {job.requirements?.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)]">
          <h4 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">What the client needs</h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {job.requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-[#00AEEF] shrink-0 mt-0.5" /> {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Client files */}
      {assets.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)]">
          <h4 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">Files from the client ({assets.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {assets.map((asset) => (
              <a key={asset.id} href={asset.file} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-[rgba(10,23,72,0.08)] bg-[#F5F7FC] hover:border-[#00AEEF] text-sm group">
                <FileText size={16} className="text-[#00AEEF] shrink-0" />
                <span className="truncate flex-1 font-medium">{asset.title}</span>
                <Download size={15} className="text-[#5B6478] group-hover:text-[#0090C6] shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider flex items-center gap-2">
            <Users size={14} className="text-[#00AEEF]" /> Project team ({team.length})
          </h4>
          {isOpen && (
            <button onClick={onInvite} className="btn-secondary btn-sm">
              <UserPlus size={13} /> Invite teammate
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {team.map((member) => (
            <div key={member.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-3 flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold truncate">{member.full_name}</span>
                  {member.id === myProfileId && <span className="badge bg-[#00AEEF]/15 border-transparent text-[#0090C6] px-1.5 py-0 text-[10px]">You</span>}
                </div>
                <p className="text-xs text-[#5B6478] truncate">{member.university}</p>
              </div>
              <Link to={`/student/profile/${member.user_id}`} title={`View ${member.full_name}'s portfolio`} className="p-1.5 rounded text-[#5B6478] hover:text-[#0090C6] hover:bg-white shrink-0">
                <ArrowUpRight size={15} />
              </Link>
            </div>
          ))}
        </div>
        {pendingInvites.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingInvites.map((inv) => (
              <span key={inv.id} className="badge bg-amber-50 border-amber-200 text-amber-900 font-normal">
                Invited {inv.invitee_email} as {inv.role_in_project} ({inv.payout_share_percentage}%) · awaiting reply
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Submissions */}
      {submissions.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)]">
          <h4 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">Submitted work ({submissions.length})</h4>
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm p-3 rounded-lg bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)]">
                <span><strong>{s.title}</strong> <span className="text-[#5B6478]">by {s.student_name} · {formatDate(s.submitted_at)}</span></span>
                <span className="flex gap-3">
                  {s.external_url && <a href={s.external_url} target="_blank" rel="noreferrer" className="text-[#0090C6] font-semibold hover:underline">Open link</a>}
                  {s.file && <a href={s.file} target="_blank" rel="noreferrer" className="text-[#0090C6] font-semibold hover:underline">Download file</a>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
};

// V2.2.1 club track: applications to company quests
const ClubApplications = ({ applications }) => (
  <section className="space-y-4">
    <SectionHeading
      title="Your quest applications"
      description="Track the proposals your club has sent to companies."
      action={<Link to="/quests" className="btn-secondary btn-sm self-start"><Compass size={14} /> Find more quests</Link>}
    />
    {applications.length === 0 ? (
      <div className="card p-12 text-center">
        <Compass className="w-12 h-12 text-[#5B6478]/40 mx-auto mb-3" />
        <h3 className="font-heading font-bold text-lg mb-1">No applications yet</h3>
        <p className="text-[#5B6478] text-sm max-w-md mx-auto">Browse the quest board to find company campaigns your club can take on.</p>
        <Link to="/quests" className="btn-primary mt-5">Browse open quests</Link>
      </div>
    ) : (
      <div className="card divide-y divide-[rgba(10,23,72,0.08)]">
        {applications.map((app) => (
          <div key={app.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Link to={`/quest/${app.campaign}`} className="font-heading font-bold text-base hover:text-[#0090C6]">{app.campaign_title}</Link>
                <StatusBadge status={app.status} />
              </div>
              <p className="text-sm text-[#5B6478]">Budget {formatMoney(app.campaign_budget)} · Applied {formatDate(app.submitted_at)}</p>
            </div>
            {app.status === 'AWARDED' && (
              <Link to={`/quest/deliver/${app.id}`} className="btn-primary btn-sm self-start sm:self-auto">
                <Upload size={14} /> Upload deliverable
              </Link>
            )}
          </div>
        ))}
      </div>
    )}
  </section>
);

export default StudentDashboard;
