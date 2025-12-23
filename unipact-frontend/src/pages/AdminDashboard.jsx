import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Search,
  Activity,
  Database,
  Lock,
  LogOut
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    pending_reviews: 0,
    system_flags: 0,
    total_users: 0,
    revenue: "RM 0"
  });
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const { logout } = useAuth();

  // FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [queueRes, statsRes] = await Promise.all([
          api.get('/users/admin/queue/'),
          api.get('/users/admin/stats/')
        ]);
        setReviews(queueRes.data);
        setStats(statsRes.data);
      } catch (err) {
        console.error("Failed to fetch admin data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Poll Logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/users/admin/logs/');
        setLogs(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchLogs(); // Initial
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleVerdict = async (entity, action) => {
    try {
      // action: 'approve' | 'reject' | 'high_risk'
      // entity: { id, type }
      await api.post(`/users/admin/verify/${entity.type}/${entity.id}/`, { action });

      // Remove from list
      setReviews(reviews.filter(r => r.id !== entity.id || r.type !== entity.type));

      // Update stats locally (simple decrement)
      setStats(prev => ({
        ...prev,
        pending_reviews: prev.pending_reviews - 1
      }));

      alert(`Entity ${action.toUpperCase()}D successfully.`);

    } catch (err) {
      alert("Failed to process verdict.");
      console.error(err);
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

  if (loading) return <div className="text-white p-10">Loading System Core...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6">

      {/* 1. SYSTEM HEADER (Matrix Style) */}
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

      {/* 2. STATS ROW */}
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

      {/* 3. MAIN INTERFACE: The Judgment Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: Verification Queue */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white uppercase tracking-wider text-sm flex items-center gap-2">
              <ShieldAlert size={16} className="text-yellow-500" /> Entity Verification Queue
            </h2>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-gray-800 text-gray-400">Filter: ALL</span>
              <span className="px-2 py-1 bg-gray-800 text-gray-400">Sort: RISK</span>
            </div>
          </div>

          <div className="space-y-4">
            {reviews.map((entity) => (
              <div key={`${entity.type}-${entity.id}`} className="bg-gray-900 border border-gray-800 p-4 hover:border-gray-600 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {entity.company_name || entity.club_name}
                      <span className="bg-gray-800 text-gray-400 text-[10px] px-1 ml-2 rounded">{entity.type}</span>
                    </h3>
                    <div className="text-xs text-gray-500 font-mono mt-1">
                      EMAIL: {entity.email} | {entity.university ? `UNI: ${entity.university}` : `DETAILS: ${entity.company_details?.substring(0, 30)}...`}
                    </div>
                  </div>
                  {entity.verification_status === 'HIGH_RISK' && (
                    <div className="bg-red-900/20 text-red-500 border border-red-900 px-2 py-1 text-[10px] uppercase font-bold animate-pulse">
                      High Risk Detect
                    </div>
                  )}
                  {entity.verification_status === 'PENDING_REVIEW' || entity.verification_status === 'PENDING_VERIFICATION' && (
                    <div className="bg-yellow-900/20 text-yellow-500 border border-yellow-900 px-2 py-1 text-[10px] uppercase font-bold">
                      Pending
                    </div>
                  )}
                </div>

                {/* Verdict Actions */}
                <div className="flex gap-3 border-t border-gray-800 pt-4">
                  <button
                    onClick={() => handleVerdict(entity, 'approve')}
                    className="flex-1 bg-green-900/20 hover:bg-green-600 hover:text-black border border-green-800 text-green-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle size={14} /> Verify Entity
                  </button>
                  <button
                    onClick={() => window.open(entity.ssm_document || entity.verification_document, '_blank')}
                    disabled={!entity.ssm_document && !entity.verification_document}
                    className="flex-1 bg-blue-900/20 hover:bg-blue-600 hover:text-black border border-blue-800 text-blue-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Search size={14} /> View Docs
                  </button>
                  {/* Only for companies, maybe allow flagging as high risk */}
                  {entity.type === 'COMPANY' && (
                    <button
                      onClick={() => handleVerdict(entity, 'high_risk')}
                      className="flex-1 bg-orange-900/20 hover:bg-orange-600 hover:text-black border border-orange-800 text-orange-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <ShieldAlert size={14} /> Flag Risk
                    </button>
                  )}
                  <button
                    onClick={() => handleVerdict(entity, 'reject')}
                    className="flex-1 bg-red-900/20 hover:bg-red-600 hover:text-black border border-red-800 text-red-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all"
                  >
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

        {/* RIGHT: System Logs */}
        <div className="bg-gray-900/30 border border-gray-800 p-4 h-[600px] overflow-y-auto">
          <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-4 flex items-center gap-2 sticky top-0 bg-[#111] py-2 border-b border-gray-800">
            <Activity size={14} /> Live Feed
            {logs.length > 0 && <span className="text-[10px] bg-green-900 text-green-400 px-1 rounded animate-pulse">LIVE</span>}
          </h3>
          <div className="space-y-3 font-mono text-[10px]">
            {logs.map((log) => (
              <div key={log.id} className="text-gray-500 border-b border-gray-800/50 pb-2">
                <span className={getLogColor(log)}>[{new Date(log.created_at).toLocaleTimeString()}]</span>
                <span className="ml-2 text-gray-300">{log.message}</span>
              </div>
            ))}

            {logs.length === 0 && <div className="text-gray-600 italic">Listening for system events...</div>}

            <div className="border-t border-gray-800 pt-2 mt-2 sticky bottom-0 bg-[#111]">
              <input type="text" placeholder="> Execute Command..." className="w-full bg-black border border-gray-700 text-white px-2 py-1 outline-none focus:border-green-500" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;