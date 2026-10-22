import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import ClubCommittee from '../components/ClubCommittee';
import StudentProjectCard from '../components/StudentProjectCard';
import AgreementModal from '../components/AgreementModal';
import { agreementRequiredBy } from '../utils/agreements';
import { campaignTypeLabel, domainLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { studentNextStep } from '../utils/projectSummary';
import {
  GraduationCap,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Share2,
  Upload,
  Users,
  Check,
  X,
  ExternalLink,
  CalendarDays,
  Compass,
  Loader2,
  CheckCircle2,
  Clock,
  Sparkles,
  CreditCard,
  Wallet,
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
  usePageTitle('Workspace');
  const { user } = useAuth();
  const { showToast } = useToast();
  const isClub = user?.role === 'CLUB';
  // Committee members joined through a club invitation: they belong to a club but don't run one
  const membership = isClub && !user?.club_profile ? user?.club_membership : null;
  const isClubMember = isClub && !user?.club_profile;

  const [assignedJobs, setAssignedJobs] = useState([]);
  const [clubApplications, setClubApplications] = useState([]);
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [payoutsData, setPayoutsData] = useState({
    total_earned: '0.00',
    pending_amount: '0.00',
    has_bank_details: false,
    bank_details: {},
    payouts: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Decline offer modal state
  const [declineJob, setDeclineJob] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  const [agreementGate, setAgreementGate] = useState(null); // { agreement, retry }: accept it, then carry on
  const fetchDashboard = useCallback(async () => {
    try {
      if (isClubMember) {
        // Nothing to load: quest applications are managed by the club president
      } else if (isClub) {
        const res = await api.get('/campaigns/applications/me/');
        setClubApplications(res.data);
      } else {
        const [jobsRes, invitesRes, payoutsRes] = await Promise.all([
          api.get('/campaigns/student/assigned/'),
          api.get('/campaigns/team/invitations/me/'),
          api.get('/payments/payouts/me/').catch(() => ({ data: { total_earned: '0.00', pending_amount: '0.00', has_bank_details: false, bank_details: {}, payouts: [] } })),
        ]);
        setAssignedJobs(jobsRes.data);
        setIncomingInvites(invitesRes.data);
        if (payoutsRes?.data) setPayoutsData(payoutsRes.data);
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load your workspace.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [isClub, isClubMember, showToast]);


  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const studentProfile = user?.student_profile || {};
  const verificationStatus = isClub ? user?.club_profile?.verification_status : studentProfile.verification_status;
  const isVerified = isClubMember || verificationStatus === 'VERIFIED';
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
      if (agreementRequiredBy(err)) setAgreementGate({ agreement: agreementRequiredBy(err), retry: () => handleRespondInvitation(inv, action) });
      else showToast(getErrorMessage(err, 'Could not update the invitation.'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Admin match offers the student hasn't answered yet are shown apart from their projects
  const offers = assignedJobs.filter((j) => j.status === 'MATCHED' && j.my_offer?.status === 'PENDING');
  const projects = assignedJobs.filter((j) => !offers.includes(j));
  // The workspace shows the few that matter now (ones waiting on the student first, then other active
  // ones, then finished ones); the Projects page has them all
  const projectPriority = (j) => (studentNextStep(j).action ? 0 : ['IN_PROGRESS', 'MATCHED'].includes(j.status) ? 1 : 2);
  const featuredProjects = [...projects].sort((x, y) => projectPriority(x) - projectPriority(y)).slice(0, 3);
  const activeCount = projects.filter((j) => ['IN_PROGRESS', 'MATCHED'].includes(j.status)).length;
  const completedCount = projects.filter((j) => j.status === 'COMPLETED').length;

  const respondToOffer = async (job, action, reason = '') => {
    setActionLoading(`offer-${job.id}`);
    try {
      const res = await api.post(`/campaigns/${job.id}/offer/respond/`, { action, reason });
      showToast(res.data?.message || (action === 'accept' ? 'Project accepted.' : 'Offer declined.'), 'success');
      setDeclineJob(null);
      await fetchDashboard();
    } catch (err) {
      if (agreementRequiredBy(err)) {
        // The Talent Agreement comes before a first job: accept it, then the offer is accepted
        setAgreementGate({ agreement: agreementRequiredBy(err), retry: () => respondToOffer(job, action, reason) });
      } else {
        showToast(getErrorMessage(err, 'Could not update the offer.'), 'error');
        await fetchDashboard();
      }
    } finally {
      setActionLoading(null);
    }
  };
  const displayName = isClub ? user?.club_profile?.club_name || user?.name : studentProfile.full_name || user?.name;

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />

      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-8 flex-1">
        <EmailVerificationBanner />

        {/* Profile header */}
        <section className="card p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#0B1E63] flex items-center justify-center shadow-md shrink-0 overflow-hidden border border-[rgba(10,23,72,0.12)]">
              {(user?.avatar_url || studentProfile.profile_photo || user?.club_profile?.logo) ? (
                <img
                  src={user?.avatar_url || studentProfile.profile_photo || user?.club_profile?.logo}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="w-full h-full items-center justify-center"
                style={{ display: (user?.avatar_url || studentProfile.profile_photo || user?.club_profile?.logo) ? 'none' : 'flex' }}
              >
                {isClub ? <Users size={30} className="text-[#00AEEF]" /> : <GraduationCap size={32} className="text-[#00AEEF]" />}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-1"><span className="eyebrow-dot" /> Welcome back</p>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="font-heading font-extrabold text-2xl text-[#0A1748]">{displayName || 'Your workspace'}</h1>
                {isClubMember ? null : isVerified ? (
                  <span className="badge bg-emerald-50 border-emerald-200 text-emerald-700"><ShieldCheck size={13} /> Verified</span>
                ) : (
                  <span className="badge bg-amber-50 border-amber-200 text-amber-800"><AlertCircle size={13} /> Pending review</span>
                )}
              </div>
              <p className="text-[#5B6478] text-sm">
                {isClubMember
                  ? membership ? `${membership.role}, ${membership.club_name}` : 'Club committee member'
                  : isClub
                  ? user?.club_profile?.university || 'Student club'
                  : [studentProfile.university, studentProfile.major].filter(Boolean).join(' • ') || 'University student'}
                {!isClub && studentProfile.club_affiliation_name && (
                  <span className="text-[#0B1E63] font-medium"> • {studentProfile.club_affiliation_role || 'Member'}, {studentProfile.club_affiliation_name}</span>
                )}
              </p>
            </div>
          </div>

          {isClubMember ? (
            membership && (
              <Link to={`/club/profile/${membership.club_id}`} className="btn-primary self-start md:self-auto">
                <Users size={16} /> View club roster
              </Link>
            )
          ) : isClub ? (
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
        ) : isClubMember ? (
          <ClubMemberHome membership={membership} />
        ) : isClub ? (
          <>
            <ClubCommittee clubUserId={user?.id} />
            <ClubApplications applications={clubApplications} />
          </>
        ) : (
          <>
            {/* Missing Bank Details Warning Alert */}
            {!payoutsData.has_bank_details && (
              <div className="card border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-amber-950">Add Malaysian Bank Details for Project Payouts</h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      You haven&apos;t set up your payout account yet. Add your bank account number or DuitNow ID in Settings so UniPact can disburse your milestone earnings.
                    </p>
                  </div>
                </div>
                <Link to="/settings#payouts" className="btn-secondary bg-white text-xs font-semibold whitespace-nowrap self-start sm:self-auto hover:border-amber-400">
                  <CreditCard size={14} /> Add bank details &rarr;
                </Link>
              </div>
            )}

            {/* Earnings & Managed Escrow Payout Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
              <div className="card p-5 bg-white border border-[rgba(10,23,72,0.1)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[#5B6478] mb-1">
                    <span className="text-xs font-medium">Total Earned</span>
                    <Wallet size={16} className="text-[#00AEEF]" />
                  </div>
                  <p className="font-heading font-extrabold text-2xl text-[#0B1E63]">
                    {formatMoney(payoutsData.total_earned)}
                  </p>
                </div>
                <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1 font-medium">
                  <CheckCircle2 size={12} /> Disbursed to your Malaysian bank
                </p>
              </div>

              <div className="card p-5 bg-white border border-[rgba(10,23,72,0.1)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[#5B6478] mb-1">
                    <span className="text-xs font-medium">Pending Escrow</span>
                    <Clock size={16} className="text-[#00729F]" />
                  </div>
                  <p className="font-heading font-extrabold text-2xl text-[#00729F]">
                    {formatMoney(payoutsData.pending_amount)}
                  </p>
                </div>
                <p className="text-xs text-[#5B6478] mt-2 flex items-center gap-1">
                  <Clock size={12} /> Milestone in progress or ready for payout
                </p>
              </div>

              <div className="card p-5 bg-white border border-[rgba(10,23,72,0.1)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[#5B6478] mb-1">
                    <span className="text-xs font-medium">Payout Account</span>
                    <CreditCard size={16} className="text-[#5B6478]" />
                  </div>
                  {payoutsData.has_bank_details ? (
                    <div>
                      <p className="font-semibold text-sm text-[#0A1748] truncate">
                        {payoutsData.bank_details?.bank_name}
                      </p>
                      <p className="text-xs font-mono text-[#5B6478] mt-0.5">
                        ****{payoutsData.bank_details?.bank_account_number?.slice(-4)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-amber-700 font-medium">No account on file</p>
                      <Link to="/settings#payouts" className="text-xs text-[#00729F] hover:underline font-semibold mt-1 inline-block">
                        Configure bank &rarr;
                      </Link>
                    </div>
                  )}
                </div>
                <Link to="/settings#payouts" className="text-xs text-[#5B6478] hover:text-[#0A1748] underline mt-2 block">
                  Update bank details
                </Link>
              </div>
            </div>

            {/* Payouts History Table (if any payouts exist) */}
            {payoutsData.payouts && payoutsData.payouts.length > 0 && (
              <section className="card p-6 space-y-4 animate-fade-in">
                <SectionHeading
                  title="Stipends & Payout History"
                  description="Milestone stipends disbursed from client project escrow to your bank account."
                />
                <div className="divide-y divide-[rgba(10,23,72,0.08)]">
                  {payoutsData.payouts.map((p) => (
                    <div key={p.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-[#0A1748]">{p.campaign_title}</p>
                        <p className="text-xs text-[#5B6478] mt-0.5">
                          {p.bank_name ? `${p.bank_name} (****${p.bank_account_number?.slice(-4)})` : 'Bank Transfer'}
                          {p.paid_at && ` • Disbursed ${formatDate(p.paid_at)}`}
                          {!p.paid_at && p.due_at && ` • Expected by ${formatDate(p.due_at)}`}
                          {p.transfer_reference && (
                            <span className="font-mono text-[#0B1E63] font-medium ml-1.5 bg-[#0B1E63]/5 px-1.5 py-0.5 rounded">
                              Ref: {p.transfer_reference}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <span className="font-heading font-bold text-base text-[#0A1748]">
                          {formatMoney(p.amount)}
                        </span>
                        <StatusBadge status={p.status} label={p.status === 'PENDING' ? 'Awaiting bank details' : undefined} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Admin match offers waiting for an answer */}
            {offers.length > 0 && (
              <section className="space-y-4 animate-fade-in">
                <SectionHeading
                  title={`Project offers (${offers.length})`}
                  description="A UniPact admin picked you for these client projects. Accept to join the team, or decline if the timing or scope doesn't work for you."
                />

                {offers.map((job) => (
                  <OfferCard
                    key={job.id}
                    job={job}
                    busy={actionLoading === `offer-${job.id}`}
                    onAccept={() => respondToOffer(job, 'accept')}
                    onDecline={() => { setDeclineJob(job); setDeclineReason(''); }}
                  />
                ))}
              </section>
            )}

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
                { label: 'Client rating', value: studentProfile.rating ? `${studentProfile.rating} ★` : 'No ratings yet', className: studentProfile.rating ? 'text-amber-700' : 'text-[#5B6478] text-base sm:text-lg pt-1.5' },
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
              <SectionHeading
                title="Your projects"
                description="Projects you have been matched to or joined as a teammate. Open one to submit work, see your team and track your payouts."
                action={projects.length > 0 && (
                  <Link to="/student/projects" className="btn-secondary btn-sm self-start">
                    All projects ({projects.length}) <ArrowRight size={14} />
                  </Link>
                )}
              />

              {projects.length === 0 ? (
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
                <div className="space-y-4">
                  {featuredProjects.map((job) => (
                    <StudentProjectCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {agreementGate && (
        <AgreementModal
          agreement={agreementGate.agreement}
          onClose={() => setAgreementGate(null)}
          onAccepted={() => {
            const { retry } = agreementGate;
            setAgreementGate(null);
            retry?.();
          }}
        />
      )}

      {/* Decline offer modal */}
      <Modal
        isOpen={!!declineJob}
        onClose={() => !actionLoading && setDeclineJob(null)}
        title="Decline this project?"
        subtitle={declineJob ? `${declineJob.title} · ${declineJob.company_name}` : ''}
        icon={<X size={20} />}
      >
        <form onSubmit={(e) => { e.preventDefault(); respondToOffer(declineJob, 'decline', declineReason.trim()); }} className="space-y-4">
          <p className="text-sm text-[#5B6478]">The UniPact team will offer the project to someone else. Declining doesn&apos;t affect future matches.</p>
          <div>
            <label className="field-label" htmlFor="decline-reason">Reason (optional, only shared with UniPact admins)</label>
            <textarea id="decline-reason" rows={3} maxLength={500} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="e.g. Final exams that month, or the stack isn't a fit" className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.08)]">
            <button type="button" onClick={() => setDeclineJob(null)} disabled={!!actionLoading} className="btn-secondary">Keep the offer</button>
            <button type="submit" disabled={!!actionLoading} className="btn-danger">
              {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} Decline project
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

// An admin's match that the student still has to accept or decline (wireframe §9)
const OfferCard = ({ job, busy, onAccept, onDecline }) => {
  const skills = job.required_skills?.length ? job.required_skills : job.target_platforms || [];
  const teamSize = (job.match_offers || []).length;
  return (
    <article className="card border-2 border-[#00AEEF] p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="badge bg-[#00AEEF] border-transparent text-[#0A1748]"><Sparkles size={12} /> New offer</span>
        <span className="badge bg-[#00AEEF]/10 border-transparent text-[#00729F]">{campaignTypeLabel(job.type)}</span>
        {teamSize > 1 && <span className="badge bg-[#F5F7FC] border-[rgba(10,23,72,0.12)] text-[#0A1748]"><Users size={12} /> Team of {teamSize}</span>}
      </div>
      <h3 className="font-heading font-bold text-xl text-[#0A1748]">{job.title}</h3>
      <p className="text-[#5B6478] text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>Client: <strong className="text-[#0A1748]">{job.company_name}</strong></span>
        <span>Team pay: <strong className="text-[#0B1E63]">{formatMoney(job.student_pool ?? job.budget)}</strong>{job.student_pool && <span className="text-xs"> (after {job.service_fee_percent}% UniPact fee)</span>}</span>
        <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> Due {formatDate(job.deadline, 'flexible')}</span>
      </p>

      {job.description && <p className="mt-4 text-sm text-[#0A1748] leading-relaxed">{job.description}</p>}

      {job.match_notes && (
        <div className="mt-4 p-3.5 bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg text-sm">
          <strong className="text-[#00729F]">Why you were picked:</strong> {job.match_notes}
        </div>
      )}

      {(job.requirements?.length > 0 || skills.length > 0) && (
        <div className="mt-5 pt-5 border-t border-[rgba(10,23,72,0.08)] grid grid-cols-1 md:grid-cols-2 gap-5">
          {job.requirements?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">What the client needs</h4>
              <ul className="space-y-1.5 text-sm">
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle2 size={15} className="text-[#00AEEF] shrink-0 mt-0.5" /> {req}</li>
                ))}
              </ul>
            </div>
          )}
          {skills.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => <span key={s} className="text-xs px-2 py-1 rounded bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)]">{s}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-[rgba(10,23,72,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-[#5B6478] max-w-md">
          Client files unlock once you accept. The client is asked to confirm after the whole team has accepted.
        </p>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <button type="button" onClick={onDecline} disabled={busy} className="btn-secondary flex-1 sm:flex-none">
            <X size={15} /> Decline
          </button>
          <button type="button" onClick={onAccept} disabled={busy} className="btn-primary flex-1 sm:flex-none whitespace-nowrap">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Accept project
          </button>
        </div>
      </div>
    </article>
  );
};

// V2.2.1 club track: what a committee member sees after accepting an invitation
const ClubMemberHome = ({ membership }) => (
  <section className="card p-8 sm:p-10 text-center">
    <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
      <CheckCircle2 size={26} />
    </div>
    <h2 className="font-heading font-bold text-xl mb-1">
      {membership ? `You're on the ${membership.club_name} committee` : 'You\'re on your club\'s committee'}
    </h2>
    <p className="text-[#5B6478] text-sm max-w-md mx-auto">
      {membership && <>Your role: <strong className="text-[#0A1748]">{membership.role}</strong>. </>}
      Your club president manages quest applications and deliverables. You appear on the club&apos;s public roster.
    </p>
    <div className="flex flex-wrap justify-center gap-3 mt-6">
      {membership && <Link to={`/club/profile/${membership.club_id}`} className="btn-primary"><Users size={15} /> View club roster</Link>}
      <Link to="/settings" className="btn-secondary">Account settings</Link>
    </div>
  </section>
);

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
                <Link to={`/quest/${app.campaign}`} className="font-heading font-bold text-base hover:text-[#00729F]">{app.campaign_title}</Link>
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
