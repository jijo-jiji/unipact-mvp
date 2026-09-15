import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert, CheckCircle2, XCircle, Search, Activity, Users, ChevronLeft, ChevronRight, Ban,
  Briefcase, UserCheck, Check, Sparkles, Lock, FileText, Loader2, Inbox,
} from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import ConfirmationModal from '../components/ConfirmationModal';
import StatusBadge from '../components/StatusBadge';
import PageLoader from '../components/PageLoader';
import { campaignTypeLabel, domainLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const TABS = [
  { key: 'dashboard', label: 'Overview', icon: <Activity size={16} /> },
  { key: 'entities', label: 'Users', icon: <Users size={16} /> },
  { key: 'matchmaking', label: 'Matchmaking', icon: <Sparkles size={16} /> },
];

const LOG_COLORS = {
  FINANCIAL: 'text-emerald-700',
  SECURITY: 'text-red-600',
  MARKETPLACE: 'text-[#0090C6]',
  GROWTH: 'text-[#0B1E63]',
};

// Which student domains suit each campaign type
const DOMAIN_FIT = {
  SOFTWARE_DEVELOPMENT: ['SOFTWARE_DEV', 'BOTH'],
  DIGITAL_MARKETING: ['MARKETING', 'BOTH'],
};

const useDebounced = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const AdminDashboard = () => {
  usePageTitle('Admin hub');
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [confirmState, setConfirmState] = useState({ isOpen: false });

  // Overview
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ pending_reviews: 0, system_flags: 0, total_users: 0, total_revenue: 0 });
  const [logs, setLogs] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [verdictLoading, setVerdictLoading] = useState(null);

  // Users
  const [entities, setEntities] = useState([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityPage, setEntityPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ next: false, prev: false, count: 0 });
  const [entityFilters, setEntityFilters] = useState({ role: '', rank: '', tier: '', search: '' });
  const debouncedSearch = useDebounced(entityFilters.search);

  // Matchmaking
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState('OPEN');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [matchNotes, setMatchNotes] = useState('');
  const [matchSubmitting, setMatchSubmitting] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get('/users/admin/logs/');
      setLogs(res.data);
    } catch {
      // The feed is best-effort; keep showing the last logs we had
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [queueRes, statsRes] = await Promise.all([api.get('/users/admin/queue/'), api.get('/users/admin/stats/')]);
      setReviews(queueRes.data);
      setStats(statsRes.data);
      fetchLogs();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load admin data.'), 'error');
    } finally {
      setDashboardLoading(false);
    }
  }, [fetchLogs, showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Poll the activity feed only while the overview is visible
  useEffect(() => {
    if (activeTab !== 'dashboard') return undefined;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchLogs]);

  const fetchEntities = useCallback(async () => {
    setEntityLoading(true);
    try {
      const params = { page: entityPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (entityFilters.role) params.role = entityFilters.role;
      if (entityFilters.role === 'CLUB' && entityFilters.rank) params.club_profile__rank = entityFilters.rank;
      if (entityFilters.role === 'COMPANY' && entityFilters.tier) params.company_profile__tier = entityFilters.tier;

      const res = await api.get('/users/admin/entities/', { params });
      setEntities(res.data.results || []);
      setPageInfo({ next: !!res.data.next, prev: !!res.data.previous, count: res.data.count || 0 });
    } catch (err) {
      if (err.response?.status === 404 && entityPage > 1) {
        setEntityPage(1); // page no longer exists after filtering
      } else {
        showToast(getErrorMessage(err, 'Could not load users.'), 'error');
      }
    } finally {
      setEntityLoading(false);
    }
  }, [entityPage, debouncedSearch, entityFilters.role, entityFilters.rank, entityFilters.tier, showToast]);

  const fetchMatchmakingData = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const params = campaignFilter !== 'ALL' ? { status: campaignFilter } : {};
      const [campRes, studRes] = await Promise.all([api.get('/campaigns/', { params }), api.get('/users/admin/students/')]);
      setCampaigns(campRes.data.results || campRes.data || []);
      setStudents(studRes.data || []);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load matchmaking data.'), 'error');
    } finally {
      setCampaignsLoading(false);
    }
  }, [campaignFilter, showToast]);

  useEffect(() => {
    if (activeTab === 'entities') fetchEntities();
  }, [activeTab, fetchEntities]);

  useEffect(() => {
    if (activeTab === 'matchmaking') fetchMatchmakingData();
  }, [activeTab, fetchMatchmakingData]);

  const updateFilters = (changes) => {
    setEntityFilters((f) => ({ ...f, ...changes }));
    setEntityPage(1);
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) || null;

  const handleSelectCampaign = (camp) => {
    setSelectedCampaignId(camp.id);
    setSelectedStudentIds(camp.assigned_students || []);
    setMatchNotes(camp.match_notes || '');
    // Below the lg breakpoint the match panel sits under the project list, so bring it into view
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => document.getElementById('match-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const toggleStudent = (studentId) =>
    setSelectedStudentIds((prev) => (prev.includes(studentId) ? prev.filter((i) => i !== studentId) : [...prev, studentId]));

  const visibleStudents = useMemo(() => {
    const fit = DOMAIN_FIT[selectedCampaign?.type] || [];
    const q = studentSearch.trim().toLowerCase();
    return students
      .filter((s) => !q || [s.full_name, s.email, s.university, ...(s.skills || [])].join(' ').toLowerCase().includes(q))
      .map((s) => ({ ...s, isFit: fit.includes(s.domain_focus) }))
      .sort((a, b) => Number(b.verification_status === 'VERIFIED') - Number(a.verification_status === 'VERIFIED') || Number(b.isFit) - Number(a.isFit));
  }, [students, studentSearch, selectedCampaign?.type]);

  const handleAssignMatch = async () => {
    setMatchSubmitting(true);
    try {
      await api.post(`/campaigns/${selectedCampaign.id}/match/`, { student_ids: selectedStudentIds, match_notes: matchNotes });
      showToast(`Matched ${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? '' : 's'} to "${selectedCampaign.title}". The client can now confirm.`, 'success');
      if (campaignFilter === 'OPEN') setCampaignFilter('MATCHED');
      else await fetchMatchmakingData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not assign the match.'), 'error');
    } finally {
      setMatchSubmitting(false);
    }
  };

  const finalizeMatch = async () => {
    setMatchSubmitting(true);
    try {
      await api.post(`/campaigns/${selectedCampaign.id}/finalize/`, {});
      showToast(`"${selectedCampaign.title}" is locked and now in progress.`, 'success');
      await fetchMatchmakingData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not finalize the match.'), 'error');
    } finally {
      setMatchSubmitting(false);
    }
  };

  const handleVerdict = async (entity, action) => {
    const key = `${entity.type}-${entity.id}`;
    setVerdictLoading(key);
    try {
      await api.post(`/users/admin/verify/${entity.type}/${entity.id}/`, { action });
      if (action === 'high_risk') {
        setReviews((list) => list.map((r) => (r.type === entity.type && r.id === entity.id ? { ...r, verification_status: 'HIGH_RISK' } : r)));
        setStats((s) => ({ ...s, system_flags: s.system_flags + 1 }));
      } else {
        setReviews((list) => list.filter((r) => !(r.type === entity.type && r.id === entity.id)));
        setStats((s) => ({ ...s, pending_reviews: Math.max(0, s.pending_reviews - 1) }));
      }
      const name = entity.company_name || entity.club_name || entity.full_name;
      showToast(action === 'approve' ? `${name} is now verified.` : action === 'reject' ? `${name} was rejected.` : `${name} was flagged as high risk.`, 'success');
      fetchLogs();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not save the decision.'), 'error');
    } finally {
      setVerdictLoading(null);
    }
  };

  const confirmVerdict = (entity, action) => {
    if (action === 'approve') return handleVerdict(entity, action);
    const name = entity.company_name || entity.club_name || entity.full_name;
    setConfirmState({
      isOpen: true,
      isDanger: true,
      title: action === 'reject' ? `Reject ${name}?` : `Flag ${name} as high risk?`,
      message: action === 'reject' ? 'They will not be able to take part in the marketplace.' : 'Their account stays in the queue for manual review.',
      confirmText: action === 'reject' ? 'Reject' : 'Flag account',
      onConfirm: () => handleVerdict(entity, action),
    });
  };

  const handleBlockUser = (ent) => {
    const blocking = ent.status === 'Active';
    setConfirmState({
      isOpen: true,
      isDanger: blocking,
      title: blocking ? `Block ${ent.entity_name}?` : `Unblock ${ent.entity_name}?`,
      message: blocking ? 'They will be signed out and unable to log in until unblocked.' : 'They will be able to sign in again.',
      confirmText: blocking ? 'Block user' : 'Unblock user',
      onConfirm: async () => {
        try {
          const res = await api.post(`/users/admin/users/${ent.id}/block/`);
          setEntities((list) => list.map((e) => (e.id === ent.id ? { ...e, status: res.data.is_active ? 'Active' : 'Blocked' } : e)));
          showToast(res.data.message, 'success');
        } catch (err) {
          showToast(getErrorMessage(err, 'Could not update the user.'), 'error');
        }
      },
    });
  };

  if (dashboardLoading) return <PageLoader message="Loading admin hub…" />;

  const canAssign = selectedCampaign && ['OPEN', 'MATCHED'].includes(selectedCampaign.status);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />

      <main className="max-w-[1160px] mx-auto px-4 sm:px-8 py-8">
        <div className="mb-6">
          <p className="eyebrow mb-1"><span className="eyebrow-dot" /> Admin</p>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">Operations hub</h1>
          <p className="text-sm text-[#5B6478] mt-1">Verify new accounts, manage users and match students to client projects.</p>
        </div>

        <div role="tablist" className="flex gap-1 sm:gap-4 mb-8 border-b border-[rgba(10,23,72,0.12)] overflow-x-auto overflow-y-hidden">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 px-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap flex items-center gap-2 transition-colors ${
                activeTab === key ? 'border-[#00AEEF] text-[#0090C6]' : 'border-transparent text-[#5B6478] hover:text-[#0A1748]'
              }`}
            >
              {icon} {label}
              {key === 'dashboard' && reviews.length > 0 && <span className="badge bg-amber-50 border-amber-200 text-amber-800 px-1.5 py-0">{reviews.length}</span>}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Awaiting review', value: stats.pending_reviews, className: 'text-amber-600' },
                { label: 'High-risk flags', value: stats.system_flags, className: 'text-red-600' },
                { label: 'Total users', value: stats.total_users, className: 'text-[#0B1E63]' },
                { label: 'Revenue collected', value: formatMoney(stats.total_revenue), className: 'text-emerald-600' },
              ].map((stat) => (
                <div key={stat.label} className="card p-5">
                  <div className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] mb-1">{stat.label}</div>
                  <div className={`font-heading text-2xl sm:text-3xl font-extrabold ${stat.className}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <section className="lg:col-span-2">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2 mb-4">
                  <ShieldAlert size={18} className="text-amber-500" /> Verification queue
                </h2>
                <div className="space-y-4">
                  {reviews.map((entity) => {
                    const key = `${entity.type}-${entity.id}`;
                    const doc = entity.ssm_document || entity.verification_document;
                    const busy = verdictLoading === key;
                    return (
                      <div key={key} className="card p-5">
                        <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-base flex flex-wrap items-center gap-2">
                              {entity.company_name || entity.club_name || entity.full_name}
                              <span className="badge bg-[#F5F7FC] border-[rgba(10,23,72,0.12)] text-[#5B6478]">{entity.type.toLowerCase()}</span>
                            </h3>
                            <div className="text-sm text-[#5B6478] mt-1 break-words">
                              {entity.email}
                              {entity.university && ` · ${entity.university}`}
                              {entity.type === 'STUDENT' && entity.domain_focus && ` · ${domainLabel(entity.domain_focus)}`}
                              {entity.company_details && ` · SSM ${entity.company_details}`}
                            </div>
                          </div>
                          <StatusBadge status={entity.verification_status} />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                          <button onClick={() => confirmVerdict(entity, 'approve')} disabled={busy} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                          </button>
                          {doc ? (
                            <a href={doc} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><FileText size={14} /> View document</a>
                          ) : (
                            <span className="btn-secondary btn-sm opacity-50 cursor-not-allowed" title="No document uploaded"><FileText size={14} /> No document</span>
                          )}
                          {entity.type === 'COMPANY' && entity.verification_status !== 'HIGH_RISK' && (
                            <button onClick={() => confirmVerdict(entity, 'high_risk')} disabled={busy} className="btn-secondary btn-sm text-amber-700 hover:text-amber-800 hover:border-amber-300">
                              <ShieldAlert size={14} /> Flag risk
                            </button>
                          )}
                          <button onClick={() => confirmVerdict(entity, 'reject')} disabled={busy} className="btn-danger btn-sm">
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {reviews.length === 0 && (
                    <div className="card p-10 text-center text-sm text-[#5B6478]">
                      <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={28} />
                      All caught up. No accounts are waiting for review.
                    </div>
                  )}
                </div>
              </section>

              <section className="card p-5 h-[600px] flex flex-col">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2 pb-3 border-b border-[rgba(10,23,72,0.08)]">
                  <Activity size={16} className="text-[#00AEEF]" /> Activity
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </h2>
                <ul className="flex-1 overflow-y-auto space-y-3 pt-3 text-sm">
                  {logs.map((log) => (
                    <li key={log.id} className="border-b border-[rgba(10,23,72,0.06)] pb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-semibold ${LOG_COLORS[log.category] || 'text-[#5B6478]'}`}>{log.category.toLowerCase()}</span>
                        <span className="text-[#5B6478]">{new Date(log.created_at).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <p className={`mt-0.5 ${log.level === 'CRITICAL' ? 'text-red-700 font-semibold' : 'text-[#0A1748]'}`}>{log.message}</p>
                    </li>
                  ))}
                  {logs.length === 0 && <li className="text-[#5B6478]">No activity yet.</li>}
                </ul>
              </section>
            </div>
          </>
        )}

        {/* USERS */}
        {activeTab === 'entities' && (
          <div className="space-y-6">
            <div className="card p-5 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="field-label" htmlFor="entity-search">Search</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478]" />
                  <input id="entity-search" type="search" placeholder="Name or email" className="input pl-9" value={entityFilters.search} onChange={(e) => updateFilters({ search: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="entity-role">Account type</label>
                <select id="entity-role" className="input min-w-[170px]" value={entityFilters.role} onChange={(e) => updateFilters({ role: e.target.value, rank: '', tier: '' })}>
                  <option value="">All accounts</option>
                  <option value="STUDENT">Students</option>
                  <option value="COMPANY">Companies</option>
                  <option value="CLUB">Clubs</option>
                </select>
              </div>
              {entityFilters.role === 'CLUB' && (
                <div>
                  <label className="field-label" htmlFor="entity-rank">Club rank</label>
                  <select id="entity-rank" className="input" value={entityFilters.rank} onChange={(e) => updateFilters({ rank: e.target.value })}>
                    <option value="">All ranks</option>
                    {['S', 'A', 'B', 'C'].map((r) => <option key={r} value={r}>{r}-class</option>)}
                  </select>
                </div>
              )}
              {entityFilters.role === 'COMPANY' && (
                <div>
                  <label className="field-label" htmlFor="entity-tier">Plan</label>
                  <select id="entity-tier" className="input" value={entityFilters.tier} onChange={(e) => updateFilters({ tier: e.target.value })}>
                    <option value="">All plans</option>
                    <option value="FREE">Free</option>
                    <option value="PRO">Pro</option>
                  </select>
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              {/* Phones: one card per user instead of a sideways-scrolling table */}
              <ul className="lg:hidden divide-y divide-[rgba(10,23,72,0.08)]">
                {entityLoading ? (
                  <li className="p-10 text-center text-sm text-[#5B6478]"><Loader2 size={18} className="animate-spin inline mr-2 text-[#00AEEF]" /> Loading users…</li>
                ) : entities.length === 0 ? (
                  <li className="p-10 text-center text-sm text-[#5B6478]">No users match these filters.</li>
                ) : (
                  entities.map((ent) => (
                    <li key={ent.id} className="p-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold break-words">{ent.entity_name}</div>
                          <div className="text-[#5B6478] break-all">{ent.email}</div>
                        </div>
                        <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6] shrink-0">{ent.role.toLowerCase()}</span>
                      </div>
                      {ent.details && ent.details !== '-' && <div className="text-xs text-[#5B6478] mt-1.5">{ent.details}</div>}
                      <div className="flex items-center justify-between gap-3 mt-3">
                        {ent.status === 'Active'
                          ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Active</span>
                          : <span className="inline-flex items-center gap-1 text-red-600"><Ban size={14} /> Blocked</span>}
                        <button onClick={() => handleBlockUser(ent)} className={ent.status === 'Active' ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}>
                          {ent.status === 'Active' ? <><Ban size={13} /> Block</> : 'Unblock'}
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[720px]">
                  <thead className="bg-[#F5F7FC] text-[#5B6478] text-xs uppercase tracking-wider whitespace-nowrap">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Details</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(10,23,72,0.08)]">
                    {entityLoading ? (
                      <tr><td colSpan="6" className="p-10 text-center text-[#5B6478]"><Loader2 size={18} className="animate-spin inline mr-2 text-[#00AEEF]" /> Loading users…</td></tr>
                    ) : entities.length === 0 ? (
                      <tr><td colSpan="6" className="p-10 text-center text-[#5B6478]">No users match these filters.</td></tr>
                    ) : (
                      entities.map((ent) => (
                        <tr key={ent.id} className="hover:bg-[#F5F7FC]/60">
                          <td className="px-4 py-3 font-semibold">{ent.entity_name}</td>
                          <td className="px-4 py-3 text-[#5B6478]">{ent.email}</td>
                          <td className="px-4 py-3"><span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6]">{ent.role.toLowerCase()}</span></td>
                          <td className="px-4 py-3 text-[#5B6478]">{ent.details}</td>
                          <td className="px-4 py-3">
                            {ent.status === 'Active'
                              ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Active</span>
                              : <span className="inline-flex items-center gap-1 text-red-600"><Ban size={14} /> Blocked</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleBlockUser(ent)} className={ent.status === 'Active' ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}>
                              {ent.status === 'Active' ? <><Ban size={13} /> Block</> : 'Unblock'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-[rgba(10,23,72,0.08)] flex justify-between items-center text-sm text-[#5B6478]">
                <span>{pageInfo.count} user{pageInfo.count === 1 ? '' : 's'} · page {entityPage}</span>
                <div className="flex gap-2">
                  <button onClick={() => setEntityPage((p) => Math.max(1, p - 1))} disabled={!pageInfo.prev} className="btn-secondary btn-sm" aria-label="Previous page"><ChevronLeft size={15} /></button>
                  <button onClick={() => setEntityPage((p) => p + 1)} disabled={!pageInfo.next} className="btn-secondary btn-sm" aria-label="Next page"><ChevronRight size={15} /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MATCHMAKING */}
        {activeTab === 'matchmaking' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-5 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2"><Briefcase size={17} className="text-[#00AEEF]" /> Client projects</h2>
                <div className="flex gap-1" role="group" aria-label="Filter projects">
                  {[['OPEN', 'Needs match'], ['MATCHED', 'Matched'], ['ALL', 'All']].map(([value, label]) => (
                    <button key={value} onClick={() => setCampaignFilter(value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${campaignFilter === value ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.15)] hover:text-[#0A1748]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {campaignsLoading ? (
                <div className="card p-10 text-center text-sm text-[#5B6478]"><Loader2 size={18} className="animate-spin inline mr-2 text-[#00AEEF]" /> Loading projects…</div>
              ) : campaigns.length === 0 ? (
                <div className="card p-10 text-center text-sm text-[#5B6478]"><Inbox className="mx-auto mb-2 opacity-50" /> No projects in this view.</div>
              ) : (
                <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                  {campaigns.map((camp) => {
                    const isSelected = selectedCampaignId === camp.id;
                    return (
                      <button key={camp.id} onClick={() => handleSelectCampaign(camp)} aria-pressed={isSelected}
                        className={`w-full text-left card p-4 transition-all ${isSelected ? 'border-2 border-[#00AEEF] bg-[#00AEEF]/5' : 'hover:border-[#00AEEF]/50'}`}>
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className="font-semibold">{camp.title}</h3>
                          <StatusBadge status={camp.status} />
                        </div>
                        <div className="text-sm text-[#5B6478]">{camp.company_name} · {formatMoney(camp.budget)} · {campaignTypeLabel(camp.type)}</div>
                        {camp.assigned_students_details?.length > 0 && (
                          <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1">
                            <UserCheck size={13} /> {camp.assigned_students_details.map((s) => s.full_name).join(', ')}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section id="match-panel" className="lg:col-span-7 scroll-mt-24">
              {!selectedCampaign ? (
                <div className="card h-full min-h-[400px] p-8 flex flex-col items-center justify-center text-center">
                  <Sparkles size={32} className="mb-3 text-[#00AEEF]/60" />
                  <div className="font-semibold">Select a project</div>
                  <p className="text-sm text-[#5B6478] mt-1 max-w-sm">Pick a client project from the list to review its requirements and choose the students to match.</p>
                </div>
              ) : (
                <div className="card p-6 space-y-6">
                  <div className="pb-4 border-b border-[rgba(10,23,72,0.08)]">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h2 className="font-heading text-xl font-bold">{selectedCampaign.title}</h2>
                        <p className="text-sm text-[#5B6478] mt-1">{selectedCampaign.company_name} · {formatMoney(selectedCampaign.budget)} · due {formatDate(selectedCampaign.deadline, 'flexible')}</p>
                      </div>
                      <StatusBadge status={selectedCampaign.status} />
                    </div>
                    <p className="text-sm mt-3 line-clamp-4">{selectedCampaign.description}</p>
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 bg-[#F5F7FC] p-3 rounded-lg text-sm">
                      <div><dt className="text-xs text-[#5B6478]">Category</dt><dd className="font-medium">{campaignTypeLabel(selectedCampaign.type)}{selectedCampaign.software_sub_type ? ` · ${selectedCampaign.software_sub_type}` : ''}</dd></div>
                      <div><dt className="text-xs text-[#5B6478]">Skills / platforms</dt><dd className="font-medium">{(selectedCampaign.required_skills?.length ? selectedCampaign.required_skills : selectedCampaign.target_platforms || []).join(', ') || 'Any'}</dd></div>
                      <div><dt className="text-xs text-[#5B6478]">Deliverables</dt><dd className="font-medium">{selectedCampaign.requirements?.length || 0}</dd></div>
                    </dl>
                  </div>

                  <div>
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                      <h3 className="font-semibold flex items-center gap-2"><Users size={15} className="text-[#00AEEF]" /> Student talent ({students.length})</h3>
                      <span className="text-sm text-[#0090C6] font-medium">{selectedStudentIds.length} selected</span>
                    </div>
                    <div className="relative mb-3">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478]" />
                      <input type="search" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search by name, university or skill" className="input pl-9" aria-label="Search students" />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                      {visibleStudents.map((stud) => {
                        const isChecked = selectedStudentIds.includes(stud.id);
                        const isVerified = stud.verification_status === 'VERIFIED';
                        return (
                          <label key={stud.id}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                              !isVerified ? 'opacity-60 cursor-not-allowed bg-[#F5F7FC] border-[rgba(10,23,72,0.08)]' : isChecked ? 'bg-[#00AEEF]/5 border-[#00AEEF] cursor-pointer' : 'bg-white border-[rgba(10,23,72,0.12)] hover:border-[#00AEEF]/50 cursor-pointer'
                            }`}>
                            <span className="flex items-center gap-3 min-w-0">
                              <input type="checkbox" checked={isChecked} disabled={!isVerified && !isChecked} onChange={() => toggleStudent(stud.id)} className="w-4 h-4 accent-[#00AEEF] shrink-0" />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold truncate">{stud.full_name}</span>
                                <span className="block text-xs text-[#5B6478] truncate">{stud.university} · {domainLabel(stud.domain_focus)}{stud.skills?.length ? ` · ${stud.skills.slice(0, 3).join(', ')}` : ''}</span>
                              </span>
                            </span>
                            <span className="flex flex-col items-end gap-1 shrink-0">
                              {isVerified ? <StatusBadge status="VERIFIED" /> : <StatusBadge status="PENDING_VERIFICATION" label="Not verified" />}
                              {stud.isFit && isVerified && <span className="text-[10px] font-semibold text-[#0090C6] inline-flex items-center gap-0.5"><Check size={11} /> Good fit</span>}
                            </span>
                          </label>
                        );
                      })}
                      {visibleStudents.length === 0 && <div className="text-center p-4 text-sm text-[#5B6478]">No students found.</div>}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-[rgba(10,23,72,0.08)]">
                    <div>
                      <label className="field-label" htmlFor="match-notes">Note for the client and students</label>
                      <textarea id="match-notes" value={matchNotes} onChange={(e) => setMatchNotes(e.target.value)} rows={3} className="input" placeholder="e.g. Ahmad leads the build based on his Django experience; Farhan handles UI." />
                    </div>
                    {!canAssign && <p className="text-sm text-[#5B6478]">This project is {selectedCampaign.status.toLowerCase().replace('_', ' ')}, so the team can no longer be changed.</p>}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={handleAssignMatch} disabled={!canAssign || matchSubmitting || selectedStudentIds.length === 0} className="btn-primary flex-1">
                        {matchSubmitting ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                        {selectedCampaign.status === 'MATCHED' ? 'Update match' : 'Match selected students'}
                      </button>
                      {selectedCampaign.status === 'MATCHED' && (
                        <button
                          onClick={() => setConfirmState({
                            isOpen: true,
                            title: 'Lock this match?',
                            message: `This starts "${selectedCampaign.title}" on behalf of the client. Normally the client confirms the match themselves.`,
                            confirmText: 'Lock & start project',
                            onConfirm: finalizeMatch,
                          })}
                          disabled={matchSubmitting}
                          className="btn-navy"
                        >
                          <Lock size={15} /> Lock & start
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <ConfirmationModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((s) => ({ ...s, isOpen: false }))}
        onConfirm={confirmState.onConfirm || (() => {})}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDanger={confirmState.isDanger}
      />
    </div>
  );
};

export default AdminDashboard;
