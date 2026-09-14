import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Search,
  Activity,
  Database,
  Lock,
  LogOut,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  Ban,
  Briefcase,
  Layers,
  UserCheck,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { logout } = useAuth();

  // TABS: 'dashboard' | 'entities' | 'matchmaking'
  const [activeTab, setActiveTab] = useState('dashboard');

  // DASHBOARD DATA
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    pending_reviews: 0,
    system_flags: 0,
    total_users: 0,
    revenue: "RM 0"
  });
  const [logs, setLogs] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // ENTITIES DATA
  const [entities, setEntities] = useState([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityPage, setEntityPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  // FILTERS
  const [entityFilters, setEntityFilters] = useState({
    role: '', // 'CLUB' | 'COMPANY' | 'STUDENT'
    rank: '', // 'S', 'A', 'B', 'C'
    tier: '', // 'FREE', 'PRO'
    search: ''
  });

  // MATCHMAKING HUB STATE (V3.0 SCREEN 13)
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [matchNotes, setMatchNotes] = useState('');
  const [matchSubmitting, setMatchSubmitting] = useState(false);
  const [matchSuccessMsg, setMatchSuccessMsg] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'MATCHED'

  // INITIAL LOAD (DASHBOARD)
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // FETCH ENTITIES WHEN TAB/FILTERS CHANGE
  useEffect(() => {
    if (activeTab === 'entities') {
      fetchEntities();
    } else if (activeTab === 'matchmaking') {
      fetchMatchmakingData();
    }
  }, [activeTab, entityPage, entityFilters, campaignFilter]);

  const fetchDashboardData = async () => {
    try {
      const [queueRes, statsRes] = await Promise.all([
        api.get('/users/admin/queue/'),
        api.get('/users/admin/stats/')
      ]);
      setReviews(queueRes.data);
      setStats(statsRes.data);
      fetchLogs();
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/users/admin/logs/');
      setLogs(res.data);
    } catch (err) {
      console.error("Log poller error", err);
    }
  };

  const fetchEntities = async () => {
    setEntityLoading(true);
    try {
      const params = {
        page: entityPage,
        search: entityFilters.search,
      };
      if (entityFilters.role) params.role = entityFilters.role;
      if (entityFilters.role === 'CLUB' && entityFilters.rank) params.club_profile__rank = entityFilters.rank;
      if (entityFilters.role === 'COMPANY' && entityFilters.tier) params.company_profile__tier = entityFilters.tier;

      const res = await api.get('/users/admin/entities/', { params });
      setEntities(res.data.results || []);
      setHasNextPage(!!res.data.next);
      setHasPrevPage(!!res.data.previous);
    } catch (err) {
      console.error("Failed to fetch entities", err);
    } finally {
      setEntityLoading(false);
    }
  };

  const fetchMatchmakingData = async () => {
    setCampaignsLoading(true);
    try {
      const params = {};
      if (campaignFilter !== 'ALL') params.status = campaignFilter;
      const [campRes, studRes] = await Promise.all([
        api.get('/campaigns/', { params }),
        api.get('/users/admin/entities/?role=STUDENT')
      ]);
      const fetchedCampaigns = campRes.data.results || campRes.data || [];
      setCampaigns(fetchedCampaigns);
      setStudents(studRes.data.results || studRes.data || []);

      if (selectedCampaign) {
        const refreshed = fetchedCampaigns.find(c => c.id === selectedCampaign.id);
        if (refreshed) {
          setSelectedCampaign(refreshed);
          setSelectedStudentIds(refreshed.assigned_students || []);
          setMatchNotes(refreshed.match_notes || '');
        }
      }
    } catch (err) {
      console.error("Failed to fetch matchmaking data", err);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleSelectCampaign = (camp) => {
    setSelectedCampaign(camp);
    setSelectedStudentIds(camp.assigned_students || []);
    setMatchNotes(camp.match_notes || '');
    setMatchSuccessMsg('');
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAssignMatch = async () => {
    if (!selectedCampaign) return;
    if (selectedStudentIds.length === 0) {
      alert("Please select at least one student candidate to match.");
      return;
    }
    setMatchSubmitting(true);
    setMatchSuccessMsg('');
    try {
      await api.post(`/campaigns/${selectedCampaign.id}/match/`, {
        student_ids: selectedStudentIds,
        match_notes: matchNotes
      });
      setMatchSuccessMsg(`Successfully matched ${selectedStudentIds.length} talent(s) to "${selectedCampaign.title}".`);
      fetchMatchmakingData();
    } catch (err) {
      console.error("Match assignment failed", err);
      alert(err.response?.data?.error || "Failed to assign match.");
    } finally {
      setMatchSubmitting(false);
    }
  };

  const handleFinalizeMatch = async () => {
    if (!selectedCampaign) return;
    if (!window.confirm(`Lock project and deduct 10% platform fee for "${selectedCampaign.title}"?`)) return;
    setMatchSubmitting(true);
    try {
      const res = await api.post(`/campaigns/${selectedCampaign.id}/finalize/`);
      setMatchSuccessMsg(`Project locked! Platform fee: ${res.data.platform_fee_collected}. Status: ${res.data.status}`);
      fetchMatchmakingData();
    } catch (err) {
      console.error("Finalize match failed", err);
      alert(err.response?.data?.error || "Failed to finalize match.");
    } finally {
      setMatchSubmitting(false);
    }
  };

  const handleVerdict = async (entity, action) => {
    try {
      await api.post(`/users/admin/verify/${entity.type}/${entity.id}/`, { action });
      setReviews(reviews.filter(r => r.id !== entity.id || r.type !== entity.type));
      setStats(prev => ({ ...prev, pending_reviews: prev.pending_reviews - 1 }));
      alert(`Entity ${action.toUpperCase()}D successfully.`);
    } catch (err) {
      console.error(err);
      alert("Failed to process verdict.");
    }
  };

  const handleBlockUser = async (userId, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus === 'Active' ? 'BLOCK' : 'UNBLOCK'} this user?`)) return;
    try {
      const res = await api.post(`/users/admin/users/${userId}/block/`);
      setEntities(entities.map(e => e.id === userId ? { ...e, status: res.data.is_active ? 'Active' : 'Blocked' } : e));
    } catch (err) {
      console.error(err);
      alert("Failed to update block status.");
    }
  };

  const getLogColor = (log) => {
    if (log.category === 'FINANCIAL') return 'text-green-500';
    if (log.category === 'SECURITY') {
      return log.level === 'CRITICAL' ? 'text-red-500 font-bold animate-pulse' : 'text-red-400';
    }
    if (log.category === 'MARKETPLACE') return 'text-blue-400';
    return 'text-gray-400';
  };

  if (dashboardLoading) return <div className="text-white p-10 font-mono">Loading System Core...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6">

      {/* 1. SYSTEM HEADER */}
      <div className="border-b border-green-900 pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl text-green-500 font-bold uppercase tracking-widest flex items-center gap-3">
            <Database size={24} /> System Core // Admin
          </h1>
          <p className="text-green-800 text-xs mt-1">
            Uptime: 99.9% | Active Nodes: {stats.total_users} | Threat Level: <span className="text-white">NOMINAL</span>
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div className="text-xs text-gray-500 uppercase">Administrator</div>
          <div className="text-white font-bold">ROOT_USER</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-400 border border-red-900 hover:border-red-500 px-3 py-1 bg-red-900/10 transition-all mt-1"
          >
            <LogOut size={12} /> TERMINATE SESSION
          </button>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div className="flex gap-4 mb-8 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-2 px-4 text-sm uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'dashboard' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <div className="flex items-center gap-2"><Activity size={16} /> Dashboard</div>
        </button>
        <button
          onClick={() => setActiveTab('entities')}
          className={`pb-2 px-4 text-sm uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'entities' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <div className="flex items-center gap-2"><Users size={16} /> Entity Management</div>
        </button>
        <button
          onClick={() => setActiveTab('matchmaking')}
          className={`pb-2 px-4 text-sm uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'matchmaking' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <div className="flex items-center gap-2"><Sparkles size={16} /> Matchmaking Hub (V3.0)</div>
        </button>
      </div>

      {/* TAB CONTENT: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <>
          {/* STATS ROW */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Pending Reviews', value: stats.pending_reviews, color: 'text-yellow-500' },
              { label: 'System Flags', value: stats.system_flags, color: 'text-red-500' },
              { label: 'Total Users', value: stats.total_users, color: 'text-blue-500' },
              { label: 'Revenue Pool', value: stats.revenue, color: 'text-green-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 p-4">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* VERIFICATION QUEUE */}
            <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white uppercase tracking-wider text-sm flex items-center gap-2">
                  <ShieldAlert size={16} className="text-yellow-500" /> Entity Verification Queue
                </h2>
              </div>

              <div className="space-y-4">
                {reviews.map((entity) => (
                  <div key={`${entity.type}-${entity.id}`} className="bg-gray-900 border border-gray-800 p-4 hover:border-gray-600 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {entity.company_name || entity.club_name || entity.full_name}
                          <span className="bg-gray-800 text-gray-400 text-[10px] px-1 ml-2 rounded">{entity.type}</span>
                        </h3>
                        <div className="text-xs text-gray-500 font-mono mt-1">
                          EMAIL: {entity.email} | {entity.university ? `UNI: ${entity.university}` : `DETAILS: ${entity.company_details?.substring(0, 30) || entity.domain_focus || ''}...`}
                        </div>
                      </div>
                      {entity.verification_status === 'HIGH_RISK' && (
                        <div className="bg-red-900/20 text-red-500 border border-red-900 px-2 py-1 text-[10px] uppercase font-bold animate-pulse">High Risk Detect</div>
                      )}
                      {(entity.verification_status === 'PENDING_REVIEW' || entity.verification_status === 'PENDING_VERIFICATION') && (
                        <div className="bg-yellow-900/20 text-yellow-500 border border-yellow-900 px-2 py-1 text-[10px] uppercase font-bold">Pending</div>
                      )}
                    </div>
                    <div className="flex gap-3 border-t border-gray-800 pt-4">
                      <button onClick={() => handleVerdict(entity, 'approve')} className="flex-1 bg-green-900/20 hover:bg-green-600 hover:text-black border border-green-800 text-green-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all">
                        <CheckCircle size={14} /> Verify Entity
                      </button>
                      <button onClick={() => window.open(entity.ssm_document || entity.verification_document || entity.student_card, '_blank')} disabled={!entity.ssm_document && !entity.verification_document && !entity.student_card} className="flex-1 bg-blue-900/20 hover:bg-blue-600 hover:text-black border border-blue-800 text-blue-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                        <Search size={14} /> View Docs
                      </button>
                      {entity.type === 'COMPANY' && (
                        <button onClick={() => handleVerdict(entity, 'high_risk')} className="flex-1 bg-orange-900/20 hover:bg-orange-600 hover:text-black border border-orange-800 text-orange-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all">
                          <ShieldAlert size={14} /> Flag Risk
                        </button>
                      )}
                      <button onClick={() => handleVerdict(entity, 'reject')} className="flex-1 bg-red-900/20 hover:bg-red-600 hover:text-black border border-red-800 text-red-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div className="p-8 text-center text-gray-600 border border-dashed border-gray-800">
                    <CheckCircle className="mx-auto mb-2 opacity-50" />
                    Queue Empty. System Nominal.
                  </div>
                )}
              </div>
            </div>

            {/* LIVE FEED */}
            <div className="bg-gray-900/30 border border-gray-800 p-4 h-[600px] overflow-y-auto">
              <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-4 flex items-center gap-2 sticky top-0 bg-[#111] py-2 border-b border-gray-800">
                <Activity size={14} /> Live Feed {logs.length > 0 && <span className="text-[10px] bg-green-900 text-green-400 px-1 rounded animate-pulse">LIVE</span>}
              </h3>
              <div className="space-y-3 font-mono text-[10px]">
                {logs.map((log) => (
                  <div key={log.id} className="text-gray-500 border-b border-gray-800/50 pb-2">
                    <span className={getLogColor(log)}>[{new Date(log.created_at).toLocaleTimeString()}]</span>
                    <span className="ml-2 text-gray-300">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB CONTENT: ENTITIES */}
      {activeTab === 'entities' && (
        <div className="">
          {/* FILTERS */}
          <div className="bg-gray-900/50 border border-gray-800 p-4 mb-6 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-500 mb-1 block">Search Entity</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Name or Email..."
                  className="w-full bg-black border border-gray-700 text-white pl-8 pr-3 py-2 text-sm focus:border-green-500 outline-none"
                  value={entityFilters.search}
                  onChange={(e) => setEntityFilters({ ...entityFilters, search: e.target.value })}
                />
                <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Entity Type</label>
              <select
                className="bg-black border border-gray-700 text-white px-3 py-2 text-sm focus:border-green-500 outline-none min-w-[150px]"
                value={entityFilters.role}
                onChange={(e) => setEntityFilters({ ...entityFilters, role: e.target.value, rank: '', tier: '' })}
              >
                <option value="">All Entities</option>
                <option value="CLUB">Student Club (v2.2.1)</option>
                <option value="COMPANY">Client / Company</option>
                <option value="STUDENT">Student Talent (V3.0)</option>
              </select>
            </div>

            {/* DYNAMIC FILTER: RANK or TIER */}
            {entityFilters.role === 'CLUB' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Club Rank</label>
                <select
                  className="bg-black border border-gray-700 text-white px-3 py-2 text-sm focus:border-green-500 outline-none min-w-[100px]"
                  value={entityFilters.rank}
                  onChange={(e) => setEntityFilters({ ...entityFilters, rank: e.target.value })}
                >
                  <option value="">All Ranks</option>
                  <option value="S">S-Class</option>
                  <option value="A">A-Class</option>
                  <option value="B">B-Class</option>
                  <option value="C">C-Class</option>
                </select>
              </div>
            )}

            {entityFilters.role === 'COMPANY' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Company Tier</label>
                <select
                  className="bg-black border border-gray-700 text-white px-3 py-2 text-sm focus:border-green-500 outline-none min-w-[100px]"
                  value={entityFilters.tier}
                  onChange={(e) => setEntityFilters({ ...entityFilters, tier: e.target.value })}
                >
                  <option value="">All Tiers</option>
                  <option value="FREE">Free Tier</option>
                  <option value="PRO">Pro Tier</option>
                </select>
              </div>
            )}
          </div>

          {/* TABLE */}
          <div className="bg-gray-900 border border-gray-800 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111] text-gray-400 uppercase text-xs">
                <tr>
                  <th className="p-4">Entity Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entityLoading ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">Scanning Database...</td></tr>
                ) : entities.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">No entities found matching parameters.</td></tr>
                ) : (
                  entities.map((ent) => (
                    <tr key={ent.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-4 font-bold text-white">{String(ent.entity_name)}</td>
                      <td className="p-4 text-gray-400 font-mono text-xs">{String(ent.email)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-[10px] rounded uppercase font-bold 
                          ${ent.role === 'COMPANY' ? 'bg-blue-900/20 text-blue-400' : ent.role === 'STUDENT' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-purple-900/20 text-purple-400'}`}>
                          {String(ent.role)}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300">
                        {String(ent.details)}
                      </td>
                      <td className="p-4">
                        {ent.status === 'Active' ? (
                          <span className="flex items-center gap-1 text-green-500 text-xs"><CheckCircle size={12} /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500 text-xs"><ShieldAlert size={12} /> Blocked</span>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleBlockUser(ent.id, ent.status)}
                          className={`border px-3 py-1 text-xs uppercase font-bold transition-all flex items-center gap-2
                             ${ent.status === 'Active'
                              ? 'border-red-900 text-red-500 hover:bg-red-900/20'
                              : 'border-green-900 text-green-500 hover:bg-green-900/20'}`}
                        >
                          {ent.status === 'Active' ? <><ShieldAlert size={12} /> Block</> : 'Unblock'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div className="p-4 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
              <div>Page {entityPage}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEntityPage(p => Math.max(1, p - 1))}
                  disabled={!hasPrevPage}
                  className="p-2 border border-gray-700 bg-black hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-black transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setEntityPage(p => p + 1)}
                  disabled={!hasNextPage}
                  className="p-2 border border-gray-700 bg-black hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-black transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MATCHMAKING HUB (SCREEN 13) */}
      {activeTab === 'matchmaking' && (
        <div>
          {/* NOTIFICATION MESSAGE */}
          {matchSuccessMsg && (
            <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm flex items-center gap-3">
              <CheckCircle size={18} />
              <span>{matchSuccessMsg}</span>
            </div>
          )}

          {/* DUAL PANE LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT PANE: CLIENT JOBS LIST (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h2 className="text-xs uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Briefcase size={14} className="text-emerald-400" />
                  Client Job Postings ({campaigns.length})
                </h2>
                <div className="flex gap-1 text-[11px]">
                  {['ALL', 'OPEN', 'MATCHED'].map(f => (
                    <button
                      key={f}
                      onClick={() => setCampaignFilter(f)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${campaignFilter === f ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/50' : 'bg-gray-900 text-gray-500 border border-gray-800 hover:text-white'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {campaignsLoading ? (
                <div className="p-8 text-center text-gray-600 border border-gray-800">Loading Job Postings...</div>
              ) : campaigns.length === 0 ? (
                <div className="p-8 text-center text-gray-600 border border-dashed border-gray-800">No postings found.</div>
              ) : (
                <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                  {campaigns.map(camp => {
                    const isSelected = selectedCampaign?.id === camp.id;
                    return (
                      <div
                        key={camp.id}
                        onClick={() => handleSelectCampaign(camp)}
                        className={`p-4 border rounded cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-950/20' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'}`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h3 className="font-bold text-white text-sm hover:text-emerald-400 transition-colors">
                            {camp.title}
                          </h3>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${camp.status === 'MATCHED' ? 'bg-amber-900/30 text-amber-400 border border-amber-800' : camp.status === 'OPEN' ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-gray-800 text-gray-400'}`}>
                            {camp.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mb-2">
                          By: <span className="text-gray-300">{camp.company?.company_name || 'Client'}</span> &bull; Budget: <span className="text-emerald-400 font-bold">RM {camp.budget}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            {camp.type}
                          </span>
                          {camp.project_sub_type && (
                            <span className="text-[10px] bg-gray-800 text-emerald-400 px-1.5 py-0.5 rounded">
                              {camp.project_sub_type}
                            </span>
                          )}
                        </div>
                        {camp.tech_stack_requirements && (
                          <div className="text-[10px] text-gray-500 truncate">
                            Stack: {camp.tech_stack_requirements}
                          </div>
                        )}
                        {camp.assigned_students_details && camp.assigned_students_details.length > 0 && (
                          <div className="mt-2 text-[10px] text-emerald-500 flex items-center gap-1">
                            <UserCheck size={12} /> Assigned: {camp.assigned_students_details.map(s => s.full_name).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT PANE: MATCHING CONSOLE (7 cols) */}
            <div className="lg:col-span-7">
              {!selectedCampaign ? (
                <div className="h-full min-h-[400px] border border-dashed border-gray-800 rounded p-8 flex flex-col items-center justify-center text-center text-gray-600">
                  <Sparkles size={32} className="mb-3 opacity-40 text-emerald-400" />
                  <div className="text-sm font-bold text-gray-400">Matchmaking Console Inactive</div>
                  <div className="text-xs text-gray-600 mt-1 max-w-sm">
                    Select a client job posting on the left to review requirements, handpick verified student talent, and bind matches.
                  </div>
                </div>
              ) : (
                <div className="border border-gray-800 bg-gray-900/40 rounded p-6 space-y-6">
                  {/* SELECTED CAMPAIGN HEADER */}
                  <div className="border-b border-gray-800 pb-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">Selected Job Posting</div>
                        <h2 className="text-xl font-bold text-white mt-1">{selectedCampaign.title}</h2>
                        <div className="text-xs text-gray-400 mt-1">
                          Client: <span className="text-white">{selectedCampaign.company?.company_name}</span> &bull; Budget: <span className="text-emerald-400 font-bold">RM {selectedCampaign.budget}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded uppercase ${selectedCampaign.status === 'MATCHED' ? 'bg-amber-900/30 text-amber-400 border border-amber-800' : selectedCampaign.status === 'OPEN' ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-gray-800 text-gray-400'}`}>
                          {selectedCampaign.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-4 bg-black/50 p-3 rounded border border-gray-800 text-xs">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Category / Sub-Type</div>
                        <div className="text-white font-medium">{selectedCampaign.type} &bull; {selectedCampaign.project_sub_type || 'Standard'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Tech Stack / Format</div>
                        <div className="text-emerald-400 font-mono text-[11px] truncate">{selectedCampaign.tech_stack_requirements || 'Any'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Timeline</div>
                        <div className="text-gray-300">{selectedCampaign.timeline_deadline ? new Date(selectedCampaign.timeline_deadline).toLocaleDateString() : 'Flexible'}</div>
                      </div>
                    </div>
                  </div>

                  {/* CANDIDATE STUDENT POOL */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs uppercase tracking-wider text-gray-300 flex items-center gap-2">
                        <Users size={14} className="text-emerald-400" />
                        Verified Student Talent Pool ({students.length})
                      </h3>
                      <span className="text-[11px] text-emerald-400">
                        {selectedStudentIds.length} candidate(s) selected
                      </span>
                    </div>

                    <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                      {students.map(stud => {
                        const isChecked = selectedStudentIds.includes(stud.id);
                        return (
                          <div
                            key={stud.id}
                            onClick={() => toggleStudentSelection(stud.id)}
                            className={`p-3 rounded border flex items-center justify-between cursor-pointer transition-colors ${isChecked ? 'bg-emerald-950/30 border-emerald-500/60' : 'bg-black/40 border-gray-800 hover:border-gray-700'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-gray-700 bg-black'}`}>
                                {isChecked && <Check size={12} className="stroke-[3]" />}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-white">{stud.entity_name}</div>
                                <div className="text-[10px] text-gray-400 font-mono">{stud.email} &bull; {stud.details}</div>
                              </div>
                            </div>
                            <span className="text-[9px] uppercase px-2 py-0.5 rounded font-bold bg-emerald-900/20 text-emerald-400 border border-emerald-900">
                              V3 VERIFIED
                            </span>
                          </div>
                        );
                      })}
                      {students.length === 0 && (
                        <div className="text-center p-4 text-xs text-gray-600 border border-dashed border-gray-800">
                          No student talent registered yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MATCHING NOTES & ACTION */}
                  <div className="space-y-4 pt-2 border-t border-gray-800">
                    <div>
                      <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">
                        Matchmaking Rationale / Team Composition Notes
                      </label>
                      <textarea
                        value={matchNotes}
                        onChange={(e) => setMatchNotes(e.target.value)}
                        placeholder="e.g. Lead Full-Stack developer assigned based on Next.js/Tailwind experience. High portfolio confidence..."
                        className="w-full bg-black border border-gray-800 focus:border-emerald-500 rounded p-2.5 text-xs text-white outline-none h-20"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleAssignMatch}
                        disabled={matchSubmitting || selectedStudentIds.length === 0}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-black py-2.5 rounded font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <UserCheck size={14} />
                        {matchSubmitting ? 'ASSIGNING MATCH...' : 'ASSIGN SELECTED CANDIDATES'}
                      </button>

                      {selectedCampaign.status === 'MATCHED' && (
                        <button
                          onClick={handleFinalizeMatch}
                          disabled={matchSubmitting}
                          className="bg-purple-900/30 hover:bg-purple-600 hover:text-white border border-purple-800 text-purple-400 px-4 py-2.5 rounded font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                          title="Finalize match and lock contract (collects 10% platform fee)"
                        >
                          <Lock size={14} /> FINALIZE & LOCK CONTRACT
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
