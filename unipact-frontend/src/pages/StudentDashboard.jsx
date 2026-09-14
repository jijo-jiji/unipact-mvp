import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Share2,
  Code2,
  Video,
  FileText,
  Upload,
  Users,
  UserPlus,
  Check,
  X
} from 'lucide-react';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [assignedJobs, setAssignedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Deliverable modal state
  const [activeJob, setActiveJob] = useState(null);
  const [delivTitle, setDelivTitle] = useState('');
  const [delivUrl, setDelivUrl] = useState('');
  const [contribRole, setContribRole] = useState('');
  const [contribSummary, setContribSummary] = useState('');
  const [delivFile, setDelivFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Incoming invitations state
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  // Invite Teammate modal state
  const [inviteModalJob, setInviteModalJob] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteShare, setInviteShare] = useState('30');
  const [inviteNotes, setInviteNotes] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/campaigns/student/assigned/');
      setAssignedJobs(res.data);
    } catch (err) {
      console.error('Failed to fetch assigned jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingInvites = async () => {
    try {
      const res = await api.get('/campaigns/team/invitations/me/');
      setIncomingInvites(res.data);
    } catch (err) {
      console.error('Failed to fetch incoming team invitations', err);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchIncomingInvites();
  }, []);

  const studentProfile = user?.student_profile || {};
  const isVerified = user?.is_verified || studentProfile.verification_status === 'VERIFIED';

  const handleCopyLink = () => {
    const url = `${window.location.origin}/student/profile/${user?.id || 1}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRespondInvitation = async (invitationId, action) => {
    try {
      setActionLoading(invitationId);
      await api.post(`/campaigns/team/invitation/${invitationId}/respond/`, { action });
      await fetchIncomingInvites();
      await fetchDashboard();
    } catch (err) {
      console.error('Failed to respond to team invitation', err);
      alert(err.response?.data?.error || 'Failed to process team invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenInviteModal = (job) => {
    setInviteModalJob(job);
    setInviteEmail('');
    setInviteRole('');
    setInviteShare('30');
    setInviteNotes('');
    setInviteError('');
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteModalJob) return;
    setInviting(true);
    setInviteError('');
    try {
      await api.post(`/campaigns/${inviteModalJob.id}/team/invite/`, {
        invitee_email: inviteEmail,
        role_in_project: inviteRole,
        payout_share_percentage: parseFloat(inviteShare) || 0,
        notes: inviteNotes
      });
      setInviteModalJob(null);
      await fetchDashboard();
      alert(`Squad invitation sent successfully to ${inviteEmail}!`);
    } catch (err) {
      console.error('Failed to send team invitation', err);
      setInviteError(err.response?.data?.error || 'Failed to send team invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleOpenSubmit = (job) => {
    setActiveJob(job);
    setDelivTitle(`${job.title} - Final Deliverable`);
    setContribRole('Lead Contributor');
    setContribSummary('');
    setDelivUrl('');
    setDelivFile(null);
  };

  const handleSubmitDeliverable = async (e) => {
    e.preventDefault();
    if (!activeJob) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', delivTitle);
      if (delivUrl) formData.append('external_url', delivUrl);
      formData.append('contribution_role', contribRole);
      formData.append('contribution_summary', contribSummary);
      if (delivFile) formData.append('file', delivFile);

      await api.post(`/campaigns/${activeJob.id}/student-deliverable/`, formData);
      alert('Deliverable submitted successfully!');
      setActiveJob(null);

      // Refresh jobs
      await fetchDashboard();
    } catch (err) {
      console.error(err);
      alert('Failed to submit deliverable');
    } finally {
      setSubmitting(false);
    }
  };

  const activeProjectsCount = assignedJobs.filter(j => j.status === 'IN_PROGRESS' || j.status === 'MATCHED').length;
  const completedCount = assignedJobs.filter(j => j.status === 'COMPLETED').length;

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-tech)] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-400 flex items-center justify-center text-cyan-400">
              <GraduationCap size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white">
                  {studentProfile.full_name || user?.name || 'Student Talent'}
                </h1>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500 text-green-400 text-xs font-semibold">
                    <ShieldCheck size={12} /> VERIFIED TALENT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500 text-yellow-400 text-xs font-semibold">
                    <AlertCircle size={12} /> PENDING REVIEW
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs mt-1">
                {studentProfile.university || 'University Student'} • {studentProfile.major || 'Undergraduate'}
                {studentProfile.club_affiliation_name && (
                  <span className="ml-2 text-slate-500 font-mono">
                    [{studentProfile.club_affiliation_role || 'Member'}, {studentProfile.club_affiliation_name}]
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 rounded bg-cyan-400/10 border border-cyan-400 text-cyan-300 hover:bg-cyan-400 hover:text-black text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Share2 size={14} /> {copied ? 'Link Copied!' : 'Share Public Portfolio'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded border border-slate-700 text-slate-400 hover:text-white text-xs"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Verification Alert Banner */}
        {!isVerified && (
          <div className="bg-yellow-950/30 border-l-4 border-yellow-500 p-4 rounded text-xs text-yellow-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-white uppercase mb-0.5">Account Under Admin Verification</strong>
              UniPact Admin is currently validating your student credentials. You will receive an email confirmation once verified and eligible for curated matching.
            </div>
          </div>
        )}

        {/* Incoming Squad Collaboration Invitations Banner */}
        {incomingInvites.length > 0 && (
          <div className="bg-cyan-950/40 border-2 border-cyan-400/80 rounded-lg p-5 shadow-lg shadow-cyan-950/50 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400">
                <Users size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Incoming Squad Collaboration Invitations
                  <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-black text-[11px] font-extrabold">
                    {incomingInvites.length} Pending
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  Peer students have invited you to join their project squad. Review the role and payout terms below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {incomingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-black/60 border border-cyan-500/40 rounded-lg p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                        Squad Invite
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-0.5">{inv.campaign_title}</h3>
                    <p className="text-xs text-slate-400 mb-2">Client: <span className="text-slate-200 font-medium">{inv.campaign_company_name}</span></p>

                    <div className="space-y-1.5 py-2 border-y border-slate-800 text-xs text-slate-300 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Invited By:</span>
                        <span className="font-semibold text-white">{inv.invited_by_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Proposed Role:</span>
                        <span className="font-semibold text-cyan-300">{inv.role_in_project}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Payout Share:</span>
                        <span className="font-bold text-green-400">{inv.payout_share_percentage}% of milestone</span>
                      </div>
                      {inv.notes && (
                        <div className="pt-1 text-[11px] text-slate-400 italic bg-black/30 p-2 rounded">
                          "{inv.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleRespondInvitation(inv.id, 'accept')}
                      disabled={actionLoading === inv.id}
                      className="flex-1 py-2 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Check size={14} /> Accept & Join Squad
                    </button>
                    <button
                      onClick={() => handleRespondInvitation(inv.id, 'decline')}
                      disabled={actionLoading === inv.id}
                      className="py-2 px-3 rounded border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-5 rounded">
            <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">Active Projects</span>
            <div className="text-3xl font-extrabold text-cyan-400">{activeProjectsCount}</div>
          </div>
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-5 rounded">
            <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">Completed Work</span>
            <div className="text-3xl font-extrabold text-green-400">{completedCount}</div>
          </div>
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-5 rounded">
            <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">Performance Rating</span>
            <div className="text-3xl font-extrabold text-yellow-400">
              {studentProfile.rating || '5.0'} ★
            </div>
          </div>
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-5 rounded">
            <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">Track Focus</span>
            <div className="text-sm font-bold text-white mt-2">
              {studentProfile.domain_focus === 'SOFTWARE_DEV' ? 'Software Development' : 'Digital Marketing'}
            </div>
          </div>
        </div>

        {/* Active Project Workspaces */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Your Assigned Project Workspaces</h2>
              <p className="text-slate-400 text-xs">Projects where you are actively collaborating with your squad and client.</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading assigned project workspaces...</div>
          ) : assignedJobs.length === 0 ? (
            <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-12 text-center rounded">
              <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white text-base font-bold mb-1">No Active Project Assignments Yet</h3>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                Once UniPact Admin matches your profile or a peer invites you to their squad, your active project workspaces and raw client assets will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {assignedJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-[var(--bg-panel)] border border-[var(--border-tech)] hover:border-cyan-500/50 p-6 rounded transition-all shadow-md"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-400/30">
                          {job.type === 'SOFTWARE_DEVELOPMENT' ? 'Software Development' : 'Digital Marketing'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white">{job.title}</h3>
                      <p className="text-slate-400 text-xs">
                        Client: <strong className="text-slate-200">{job.company_name}</strong> • Budget: RM {job.budget}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {job.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleOpenSubmit(job)}
                          className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                        >
                          <Upload size={14} /> Submit Deliverables
                        </button>
                      )}
                    </div>
                  </div>

                  {job.match_notes && (
                    <div className="p-3 bg-black/40 border border-slate-700/50 rounded text-xs text-slate-300 mb-4">
                      <strong className="text-cyan-400">Admin Match Note:</strong> {job.match_notes}
                    </div>
                  )}

                  {/* Project Team Squad Section */}
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-cyan-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Project Squad
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 text-[10px] font-extrabold">
                          {(job.assigned_students_details?.length || 1)} Assigned
                        </span>
                        {job.team_invitations && job.team_invitations.filter(i => i.status === 'PENDING').length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-semibold">
                            {job.team_invitations.filter(i => i.status === 'PENDING').length} Pending Invite(s)
                          </span>
                        )}
                      </div>

                      {job.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleOpenInviteModal(job)}
                          className="px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-400/60 text-cyan-300 hover:bg-cyan-500 hover:text-black text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                        >
                          <UserPlus size={13} /> Invite Peer Teammate
                        </button>
                      )}
                    </div>

                    {/* Active Squad Members */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {job.assigned_students_details && job.assigned_students_details.length > 0 ? (
                        job.assigned_students_details.map((member) => (
                          <div
                            key={member.id}
                            className="bg-black/40 border border-slate-800 rounded p-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white truncate">{member.full_name}</span>
                                {member.id === (user?.student_profile?.id || user?.id) && (
                                  <span className="px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 text-[9px] font-extrabold">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{member.university} • {member.major}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              <span className="text-[11px] font-mono text-yellow-400">{member.rating} ★</span>
                              <a
                                href={`/student/profile/${member.id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="View Portfolio"
                                className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                              >
                                <ArrowUpRight size={13} />
                              </a>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 italic">No squad members assigned yet.</div>
                      )}
                    </div>

                    {/* Pending Invitations list */}
                    {job.team_invitations && job.team_invitations.filter(i => i.status === 'PENDING').length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
                          Sent Invitations Awaiting Response:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {job.team_invitations.filter(i => i.status === 'PENDING').map((inv) => (
                            <div
                              key={inv.id}
                              className="bg-yellow-950/20 border border-yellow-500/30 rounded p-2 text-xs flex items-center justify-between text-yellow-200"
                            >
                              <div className="truncate">
                                <span className="font-bold text-white block truncate">{inv.invitee_email}</span>
                                <span className="text-[11px] text-slate-400">{inv.role_in_project} ({inv.payout_share_percentage}% share)</span>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-[10px] font-bold shrink-0">
                                PENDING
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deliverables checklist */}
                  {job.requirements && job.requirements.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Deliverables Required by Client:
                      </span>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                        {job.requirements.map((req, rIdx) => (
                          <li key={rIdx} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deliverable Submission Modal */}
      {activeJob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[var(--bg-panel)] border border-cyan-400 p-6 rounded relative shadow-2xl animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-1">Submit Project Deliverables</h2>
            <p className="text-xs text-slate-400 mb-5">
              Project: <strong className="text-cyan-400">{activeJob.title}</strong> ({activeJob.company_name})
            </p>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Deliverable Title (*)</label>
                <input
                  type="text"
                  required
                  value={delivTitle}
                  onChange={(e) => setDelivTitle(e.target.value)}
                  className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2 text-xs rounded focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Repository or Staging URL (Optional)</label>
                <input
                  type="url"
                  value={delivUrl}
                  onChange={(e) => setDelivUrl(e.target.value)}
                  placeholder="https://github.com/... or https://staging.app"
                  className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2 text-xs rounded focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Attach Final Deliverable File (PDF, ZIP, MP4)</label>
                <input
                  type="file"
                  onChange={(e) => e.target.files && setDelivFile(e.target.files[0])}
                  className="w-full bg-black/50 border border-[var(--border-tech)] text-slate-300 p-2 text-xs rounded focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Your Specific Role (*)</label>
                  <input
                    type="text"
                    required
                    value={contribRole}
                    onChange={(e) => setContribRole(e.target.value)}
                    placeholder="e.g. Lead Full-Stack Architect"
                    className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2 text-xs rounded focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Individual Contribution Statement (Feeds into Project Report & Portfolio per REQ-3.5.4)
                </label>
                <textarea
                  rows={3}
                  required
                  value={contribSummary}
                  onChange={(e) => setContribSummary(e.target.value)}
                  placeholder="Summarize what you engineered or produced for this client order..."
                  className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2 text-xs rounded focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveJob(null)}
                  className="px-4 py-2 rounded text-xs text-slate-400 hover:text-white border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Confirm Deliverable Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Teammate Modal */}
      {inviteModalJob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-panel)] border border-cyan-400 p-6 rounded-lg relative shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserPlus className="text-cyan-400" size={20} />
                <h2 className="text-lg font-bold text-white">Invite Peer Student to Squad</h2>
              </div>
              <button
                onClick={() => setInviteModalJob(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Project: <strong className="text-cyan-400">{inviteModalJob.title}</strong> ({inviteModalJob.company_name})
            </p>

            {inviteError && (
              <div className="p-3 mb-4 rounded bg-red-950/40 border border-red-500/50 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Peer Student Registered Email (*)
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="student@university.edu.my"
                  className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2.5 text-xs rounded focus:border-cyan-400 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  The student must be a registered and verified talent on UniPact.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Role in Project (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    placeholder="e.g. Frontend Specialist / Content Creator"
                    className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2.5 text-xs rounded focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Proposed Payout Share (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="0.5"
                      required
                      value={inviteShare}
                      onChange={(e) => setInviteShare(e.target.value)}
                      className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2.5 pr-8 text-xs rounded focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2.5 text-slate-400 text-xs">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Collaboration Notes / Responsibilities (Optional)
                </label>
                <textarea
                  rows={3}
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  placeholder="Explain the tasks you want them to handle (e.g., build React dashboard, produce 2 TikTok reels)..."
                  className="w-full bg-black/50 border border-[var(--border-tech)] text-white p-2.5 text-xs rounded focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setInviteModalJob(null)}
                  className="px-4 py-2 rounded text-xs text-slate-400 hover:text-white border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-5 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserPlus size={14} />
                  {inviting ? 'Sending Invite...' : 'Send Squad Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
