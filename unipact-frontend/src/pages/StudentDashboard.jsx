import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
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
  X,
  LogOut,
  ExternalLink,
  ChevronRight,
  Sparkles
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
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col selection:bg-[#00AEEF] selection:text-white">

      {/* 1. STICKY TOP NAVBAR (76px per STYLE_GUIDE.md) */}
      <nav className="sticky top-0 z-40 h-[76px] bg-[#F5F7FC]/90 backdrop-blur-md border-b border-[rgba(10,23,72,0.08)] flex items-center px-6 lg:px-12">
        <div className="max-w-[1160px] w-full mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center font-heading font-extrabold text-xl shadow-sm">
              UP
            </div>
            <div>
              <span className="font-heading font-extrabold text-xl text-[#0A1748] tracking-tight block leading-none">
                Uni<span className="text-[#00AEEF]">Pact</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-[#5B6478] uppercase">
                Student Workspace
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 rounded-md bg-white border border-[rgba(10,23,72,0.15)] hover:border-[#00AEEF] text-[#0A1748] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Share2 size={14} className="text-[#00AEEF]" /> {copied ? 'Link Copied!' : 'Share Public Portfolio'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-md border border-[rgba(10,23,72,0.15)] hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-[#5B6478] text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* 2. MAIN CONTAINER (1160px max-width per STYLE_GUIDE.md) */}
      <main className="max-w-[1160px] w-full mx-auto px-6 py-8 space-y-8 flex-1">

        {/* Profile Card Header */}
        <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#0B1E63] text-white flex items-center justify-center shadow-md shrink-0">
              <GraduationCap size={32} className="text-[#00AEEF]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="font-heading font-extrabold text-2xl text-[#0A1748]">
                  {studentProfile.full_name || user?.name || 'Student Talent'}
                </h1>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                    <ShieldCheck size={13} className="text-emerald-600" /> VERIFIED TALENT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <AlertCircle size={13} className="text-amber-600" /> PENDING REVIEW
                  </span>
                )}
              </div>
              <p className="text-[#5B6478] text-xs sm:text-sm">
                {studentProfile.university || 'University Student'} • {studentProfile.major || 'Undergraduate'}
                {studentProfile.club_affiliation_name && (
                  <span className="ml-2 font-medium text-[#0B1E63]">
                    • {studentProfile.club_affiliation_role || 'Member'}, {studentProfile.club_affiliation_name}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/student/profile/${user?.id || 1}`}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5"
            >
              View My Portfolio <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Verification Alert Banner (if pending) */}
        {!isVerified && (
          <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-xl text-xs text-amber-900 flex items-start gap-3.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-950 font-bold uppercase text-xs mb-1">
                Account Verification in Progress
              </strong>
              UniPact Admin is currently validating your student credentials. You will receive an email confirmation once verified and eligible for curated matching.
            </div>
          </div>
        )}

        {/* Incoming Squad Collaboration Invitations Banner */}
        {incomingInvites.length > 0 && (
          <div className="bg-white border-2 border-[#00AEEF] rounded-xl p-6 shadow-md animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center">
                <Users size={18} />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg text-[#0A1748] flex items-center gap-2">
                  Incoming Squad Collaboration Invitations
                  <span className="px-2.5 py-0.5 rounded-full bg-[#00AEEF] text-white text-xs font-extrabold">
                    {incomingInvites.length} Pending
                  </span>
                </h2>
                <p className="text-xs text-[#5B6478]">
                  Peer students have invited you to join their project squad. Review the role and payout terms below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] rounded-lg p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#00AEEF]/10 text-[#0090C6]">
                        Squad Invite
                      </span>
                      <span className="text-[11px] font-semibold text-[#5B6478]">
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <h3 className="font-heading font-bold text-sm text-[#0A1748] mb-0.5">{inv.campaign_title}</h3>
                    <p className="text-xs text-[#5B6478] mb-3">Client: <strong className="text-[#0A1748]">{inv.campaign_company_name}</strong></p>

                    <div className="space-y-1.5 py-2.5 border-y border-[rgba(10,23,72,0.08)] text-xs text-[#0A1748] mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[#5B6478]">Invited By:</span>
                        <span className="font-semibold">{inv.invited_by_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#5B6478]">Proposed Role:</span>
                        <span className="font-semibold text-[#00AEEF]">{inv.role_in_project}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#5B6478]">Payout Share:</span>
                        <span className="font-bold text-emerald-700">{inv.payout_share_percentage}% of milestone</span>
                      </div>
                      {inv.notes && (
                        <div className="pt-2 text-[11px] text-[#5B6478] italic bg-white p-2.5 rounded border border-[rgba(10,23,72,0.06)]">
                          "{inv.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleRespondInvitation(inv.id, 'accept')}
                      disabled={actionLoading === inv.id}
                      className="flex-1 py-2 px-3 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    >
                      <Check size={14} /> Accept & Join Squad
                    </button>
                    <button
                      onClick={() => handleRespondInvitation(inv.id, 'decline')}
                      disabled={actionLoading === inv.id}
                      className="py-2 px-3 rounded-md border border-[rgba(10,23,72,0.15)] hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-[#5B6478] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Active Projects</span>
            <div className="font-heading text-3xl font-extrabold text-[#0B1E63]">{activeProjectsCount}</div>
          </div>
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Completed Work</span>
            <div className="font-heading text-3xl font-extrabold text-emerald-600">{completedCount}</div>
          </div>
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Performance Rating</span>
            <div className="font-heading text-3xl font-extrabold text-amber-500">
              {studentProfile.rating || '5.0'} ★
            </div>
          </div>
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Track Focus</span>
            <div className="font-heading text-base font-bold text-[#0A1748] mt-2">
              {studentProfile.domain_focus === 'SOFTWARE_DEV' ? 'Software Development' : 'Digital Marketing'}
            </div>
          </div>
        </div>

        {/* 4. ACTIVE PROJECT WORKSPACES */}
        <div className="space-y-4">
          <div>
            <h2 className="font-heading font-bold text-xl text-[#0A1748]">Your Assigned Project Workspaces</h2>
            <p className="text-[#5B6478] text-xs">Projects where you are actively collaborating with your squad and client.</p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#5B6478] text-xs bg-white border border-[rgba(10,23,72,0.12)] rounded-xl">
              Loading assigned project workspaces...
            </div>
          ) : assignedJobs.length === 0 ? (
            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-12 text-center rounded-xl shadow-sm">
              <Briefcase className="w-12 h-12 text-[#5B6478]/40 mx-auto mb-3" />
              <h3 className="font-heading font-bold text-[#0A1748] text-base mb-1">No Active Project Assignments Yet</h3>
              <p className="text-[#5B6478] text-xs max-w-md mx-auto leading-relaxed">
                Once UniPact Admin matches your profile or a peer invites you to their squad, your active project workspaces and raw client assets will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {assignedJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white border border-[rgba(10,23,72,0.12)] hover:border-[#00AEEF] p-6 sm:p-8 rounded-xl shadow-sm transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#00AEEF]/10 text-[#0090C6]">
                          {job.type === 'SOFTWARE_DEVELOPMENT' ? 'Software Development' : 'Digital Marketing'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <h3 className="font-heading font-bold text-xl text-[#0A1748]">{job.title}</h3>
                      <p className="text-[#5B6478] text-xs mt-1">
                        Client: <strong className="text-[#0A1748]">{job.company_name}</strong> • Budget: <strong className="text-[#0B1E63]">RM {job.budget}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {job.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleOpenSubmit(job)}
                          className="px-5 py-2.5 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Upload size={14} /> Submit Deliverables
                        </button>
                      )}
                    </div>
                  </div>

                  {job.match_notes && (
                    <div className="p-3.5 bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg text-xs text-[#0A1748] mb-4">
                      <strong className="text-[#00AEEF]">Admin Match Note:</strong> {job.match_notes}
                    </div>
                  )}

                  {/* Project Team Squad Section */}
                  <div className="mt-4 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#00AEEF]" />
                        <span className="font-heading text-xs font-bold text-[#0A1748] uppercase tracking-wider">
                          Project Squad
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#00AEEF]/10 text-[#0090C6] text-[10px] font-extrabold">
                          {(job.assigned_students_details?.length || 1)} Assigned
                        </span>
                        {job.team_invitations && job.team_invitations.filter(i => i.status === 'PENDING').length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                            {job.team_invitations.filter(i => i.status === 'PENDING').length} Pending Invite(s)
                          </span>
                        )}
                      </div>

                      {job.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleOpenInviteModal(job)}
                          className="px-3.5 py-1.5 rounded-md bg-white border border-[rgba(10,23,72,0.15)] hover:border-[#00AEEF] hover:text-[#00AEEF] text-[#0A1748] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto"
                        >
                          <UserPlus size={13} className="text-[#00AEEF]" /> Invite Peer Teammate
                        </button>
                      )}
                    </div>

                    {/* Active Squad Members */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {job.assigned_students_details && job.assigned_students_details.length > 0 ? (
                        job.assigned_students_details.map((member) => (
                          <div
                            key={member.id}
                            className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-3 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#0A1748] truncate">{member.full_name}</span>
                                {member.id === (user?.student_profile?.id || user?.id) && (
                                  <span className="px-1.5 py-0.2 rounded bg-[#00AEEF]/20 text-[#0090C6] text-[9px] font-extrabold">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#5B6478] truncate">{member.university} • {member.major}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-amber-600">{member.rating} ★</span>
                              <a
                                href={`/student/profile/${member.id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="View Portfolio"
                                className="p-1 rounded text-[#5B6478] hover:text-[#00AEEF] hover:bg-white transition-all"
                              >
                                <ArrowUpRight size={14} />
                              </a>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-[#5B6478] italic">No squad members assigned yet.</div>
                      )}
                    </div>

                    {/* Pending Invitations list */}
                    {job.team_invitations && job.team_invitations.filter(i => i.status === 'PENDING').length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase text-[#5B6478] block tracking-wider">
                          Sent Invitations Awaiting Response:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {job.team_invitations.filter(i => i.status === 'PENDING').map((inv) => (
                            <div
                              key={inv.id}
                              className="bg-amber-50/70 border border-amber-200/80 rounded-md p-2.5 text-xs flex items-center justify-between text-amber-900"
                            >
                              <div className="truncate">
                                <span className="font-bold text-[#0A1748] block truncate">{inv.invitee_email}</span>
                                <span className="text-[11px] text-[#5B6478]">{inv.role_in_project} ({inv.payout_share_percentage}% share)</span>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-amber-200/60 text-amber-900 text-[10px] font-bold shrink-0">
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
                    <div className="mt-4 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                      <span className="text-[11px] font-bold text-[#5B6478] uppercase tracking-wider block mb-2">
                        Deliverables Required by Client:
                      </span>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#0A1748]">
                        {job.requirements.map((req, rIdx) => (
                          <li key={rIdx} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00AEEF] shrink-0"></span>
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
      </main>

      {/* 5. DELIVERABLE SUBMISSION MODAL */}
      {activeJob && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white border border-[rgba(10,23,72,0.12)] p-6 sm:p-8 rounded-xl relative shadow-2xl animate-fade-in">
            <h2 className="font-heading font-bold text-xl text-[#0A1748] mb-1">Submit Project Deliverables</h2>
            <p className="text-xs text-[#5B6478] mb-5">
              Project: <strong className="text-[#00AEEF]">{activeJob.title}</strong> ({activeJob.company_name})
            </p>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">Deliverable Title (*)</label>
                <input
                  type="text"
                  required
                  value={delivTitle}
                  onChange={(e) => setDelivTitle(e.target.value)}
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">Repository or Staging URL (Optional)</label>
                <input
                  type="url"
                  value={delivUrl}
                  onChange={(e) => setDelivUrl(e.target.value)}
                  placeholder="https://github.com/... or https://staging.app"
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">Attach Final Deliverable File (PDF, ZIP, MP4)</label>
                <input
                  type="file"
                  onChange={(e) => e.target.files && setDelivFile(e.target.files[0])}
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#5B6478] p-2 text-xs rounded-md focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#0A1748] block mb-1">Your Specific Role (*)</label>
                  <input
                    type="text"
                    required
                    value={contribRole}
                    onChange={(e) => setContribRole(e.target.value)}
                    placeholder="e.g. Lead Full-Stack Architect"
                    className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">
                  Individual Contribution Statement (Feeds into Verified Portfolio)
                </label>
                <textarea
                  rows={3}
                  required
                  value={contribSummary}
                  onChange={(e) => setContribSummary(e.target.value)}
                  placeholder="Summarize what you engineered or produced for this client order..."
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                <button
                  type="button"
                  onClick={() => setActiveJob(null)}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-[#5B6478] hover:text-[#0A1748] border border-[rgba(10,23,72,0.15)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Submitting...' : 'Confirm Deliverable Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. INVITE TEAMMATE MODAL */}
      {inviteModalJob && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-[rgba(10,23,72,0.12)] p-6 sm:p-8 rounded-xl relative shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <h2 className="font-heading font-bold text-lg text-[#0A1748]">Invite Peer Student to Squad</h2>
              </div>
              <button
                onClick={() => setInviteModalJob(null)}
                className="text-[#5B6478] hover:text-[#0A1748]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#5B6478] mb-4">
              Project: <strong className="text-[#00AEEF]">{inviteModalJob.title}</strong> ({inviteModalJob.company_name})
            </p>

            {inviteError && (
              <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">
                  Peer Student Registered Email (*)
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="student@university.edu.my"
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                />
                <p className="text-[11px] text-[#5B6478] mt-1">
                  The student must be a registered and verified talent on UniPact.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#0A1748] block mb-1">
                    Role in Project (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    placeholder="e.g. Frontend Specialist"
                    className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#0A1748] block mb-1">
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
                      className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 pr-8 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2.5 text-[#5B6478] text-xs font-semibold">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">
                  Collaboration Notes / Responsibilities (Optional)
                </label>
                <textarea
                  rows={3}
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  placeholder="Explain the tasks you want them to handle..."
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                <button
                  type="button"
                  onClick={() => setInviteModalJob(null)}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-[#5B6478] hover:text-[#0A1748] border border-[rgba(10,23,72,0.15)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-5 py-2.5 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <UserPlus size={14} />
                  {inviting ? 'Sending Invite...' : 'Send Squad Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. FOOTER */}
      <footer className="mt-auto border-t border-[rgba(10,23,72,0.08)] bg-white py-8 px-6 text-center text-xs text-[#5B6478]">
        UniPact Enterprise Talent Platform • Built to STYLE_GUIDE.md
      </footer>
    </div>
  );
};

export default StudentDashboard;
