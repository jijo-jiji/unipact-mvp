import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Zap,
  Target,
  Clock,
  AlertTriangle,
  Search,
  ChevronRight,
  Shield,
  Plus,
  X
} from 'lucide-react';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  /* API INTEGRATION */
  const [applications, setApplications] = useState([]);
  const [bounties, setBounties] = useState([]); // [NEW] State for Bounties
  const [loading, setLoading] = useState(true);

  // INVITE MODAL STATE
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Committee Member');
  const [inviteStatus, setInviteStatus] = useState(null); // 'success', 'error', 'loading'

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch My Applications
        const appsRes = await api.get('/campaigns/applications/me/');
        setApplications(appsRes.data);

        // 2. Fetch Open Bounties (Campaigns)
        const campaignsRes = await api.get('/campaigns/');
        // Filter for OPEN campaigns that I haven't applied to yet
        const myAppIds = new Set(appsRes.data.map(app => app.campaign));
        const openBounties = campaignsRes.data.filter(
          c => c.status === 'OPEN' && !myAppIds.has(c.id)
        );
        setBounties(openBounties.slice(0, 3)); // Top 3

      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteStatus('loading');
    try {
      await api.post('/users/invite/', { email: inviteEmail, role: inviteRole });
      setInviteStatus('success');
      setInviteEmail('');
      setTimeout(() => {
        setShowInvite(false);
        setInviteStatus(null);
      }, 2000);
    } catch (error) {
      console.error("Invite failed", error);
      setInviteStatus('error');
    }
  }

  // Filter Applications
  const activeMissions = applications.filter(app => app.status === 'AWARDED');
  const otherBids = applications.filter(app => app.status !== 'AWARDED');

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 text-white relative">

      {/* INVITE MODAL */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 w-full max-w-md relative shadow-[0_0_50px_rgba(160,32,240,0.3)]">
            <button
              onClick={() => setShowInvite(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-display font-bold text-white mb-2 uppercase tracking-wider">Recruit Crew</h2>
            <p className="text-xs text-gray-400 mb-6">Send an encrypted invite token to a new member.</p>

            {inviteStatus === 'success' ? (
              <div className="bg-green-500/20 text-green-400 p-4 border border-green-500/50 text-center uppercase tracking-wider text-sm font-bold animate-pulse">
                Invitation Sent Successfully
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Member Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-black border border-[var(--border-tech)] text-white p-3 focus:border-[#a020f0] outline-none transition-colors"
                    placeholder="hunter@university.edu.my"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Role Assignment</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-black border border-[var(--border-tech)] text-white p-3 focus:border-[#a020f0] outline-none transition-colors"
                  >
                    <option>Committee Member</option>
                    <option>Treasurer</option>
                    <option>Secretary</option>
                    <option>Vice President</option>
                  </select>
                </div>

                {inviteStatus === 'error' && (
                  <div className="text-red-500 text-xs text-center">Failed to send invite. User may already exist.</div>
                )}

                <button
                  type="submit"
                  disabled={inviteStatus === 'loading'}
                  className="w-full bg-[#a020f0] text-white font-bold uppercase tracking-widest py-3 hover:bg-[#8010c0] transition-colors border border-white/20"
                >
                  {inviteStatus === 'loading' ? 'Encrypting...' : 'Send Invite'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 1. HUNTER NAV (Purple Accent) */}
      <nav className="flex justify-between items-center mb-8 bg-[var(--bg-panel)] p-4 border border-[var(--border-tech)] shadow-lg relative overflow-hidden">
        {/* Decorative Purple Line */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-[#a020f0] shadow-[0_0_10px_#a020f0]"></div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#a020f0]/20 border border-[#a020f0] rounded-full flex items-center justify-center">
            <Zap className="text-[#a020f0]" size={20} />
          </div>
          <div>
            <div className="font-display tracking-widest uppercase text-sm">
              {user?.name || 'Loading Guild...'}
            </div>
            <div className="text-[10px] text-[#a020f0] tracking-[0.2em]">HUNTER RANK: B</div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-[var(--text-blue)] uppercase tracking-wider">
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1 text-[#a020f0] border border-[#a020f0]/30 px-3 py-1 hover:bg-[#a020f0] hover:text-white transition-all"
          >
            <Plus size={14} /> Invite Crew
          </button>

          <span
            onClick={() => navigate(`/club/profile/${user?.id}`)}
            className="cursor-pointer hover:text-white transition-colors"
          >
            View Roster
          </span>
          <span onClick={logout} className="cursor-pointer hover:text-white transition-colors">Logout</span>
        </div>
      </nav>

      {/* 2. SYSTEM ALERT (Verification Status) */}
      {user?.verification_status !== 'VERIFIED' && (
        <div className="mb-8 bg-red-500/10 border border-red-500/50 p-4 flex items-start gap-4 rounded-sm animate-pulse">
          <AlertTriangle className="text-red-500 shrink-0" />
          <div>
            <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm">System Restriction: License Pending</h3>
            <p className="text-gray-400 text-xs mt-1">
              Your verification documents are under review by the High Council. You cannot accept High-Rank Quests yet.
            </p>
          </div>
        </div>
      )}

      {/* 3. STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Raids', value: activeMissions.length, icon: Target, color: 'text-[#a020f0]' },
          { label: 'Pending Bids', value: otherBids.filter(a => a.status === 'PENDING').length, icon: Clock, color: 'text-blue-400' },
          { label: 'Quest Wins', value: applications.filter(a => a.status === 'AWARDED').length, icon: Shield, color: 'text-green-400' },
          { label: 'Total Loot', value: 'RM ' + activeMissions.reduce((acc, curr) => acc + (curr.budget || 0), 0), icon: Zap, color: 'text-yellow-400' },
        ].map((stat, index) => (
          <div key={index} className="bg-[var(--bg-panel)] p-4 border border-[var(--border-tech)] relative group">
            <div className="flex justify-between items-start mb-2">
              <span className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</span>
              <stat.icon size={18} className="text-gray-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* 4. LEFT: YOUR QUESTS (Active & Applications) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section Header */}
          <div className="flex justify-between items-end border-b border-[var(--border-tech)] pb-2">
            <h2 className="text-lg font-display uppercase tracking-wider text-white">Mission Log</h2>
          </div>

          {/* Active Mission Log */}
          {activeMissions.length === 0 ? (
            <div className="p-6 border border-dashed border-gray-700 text-center text-gray-500 uppercase tracking-widest text-xs">
              No Active Missions. Go find a bounty!
            </div>
          ) : (
            activeMissions.map(app => (
              <div key={app.id} className="bg-[var(--bg-panel)] border-l-4 border-[#a020f0] p-6 relative overflow-hidden mb-4">
                <div className="absolute top-0 right-0 bg-[#a020f0] text-black text-[10px] font-bold px-2 py-1 uppercase">
                  In Progress
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{app.campaign_title}</h3>
                <p className="text-sm text-gray-400 mb-4">Status: {app.status}</p>

                <div className="w-full bg-black/50 h-1.5 mb-4">
                  <div className="bg-[#a020f0] h-1.5 w-[50%] shadow-[0_0_10px_#a020f0]"></div>
                </div>

                <button
                  onClick={() => navigate(`/quest/deliver/${app.id}`)}
                  className="text-xs bg-[#a020f0]/20 text-[#a020f0] border border-[#a020f0] px-4 py-2 hover:bg-[#a020f0] hover:text-white transition-all uppercase tracking-wider font-bold"
                >
                  Submit Deliverables
                </button>
              </div>
            ))
          )}

          {/* Application History List */}
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-4">
            <div className="text-xs text-gray-500 uppercase mb-4 tracking-wider">Recent Bids</div>
            <div className="space-y-3">
              {otherBids.length > 0 ? otherBids.map(app => (
                <div key={app.id} className="flex justify-between items-center text-sm border-b border-gray-800 pb-2">
                  <div>
                    <div className="text-white font-bold">{app.campaign_title}</div>
                    <div className="text-gray-500 text-xs">Application #{app.id}</div>
                  </div>
                  <span className={`text-xs uppercase tracking-wider ${app.status === 'REJECTED' || app.status === 'NOT_SELECTED' ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                    {app.status.replace('_', ' ')}
                  </span>
                </div>
              )) : <div className="text-xs text-gray-600 italic">No recent activity.</div>}
            </div>
          </div>
        </div>

        {/* 5. RIGHT: RECOMMENDED BOUNTIES */}
        <div className="space-y-4">
          <div className="flex justify-between items-end border-b border-[var(--border-tech)] pb-2">
            <h2 className="text-lg font-display uppercase tracking-wider text-white">Bounty Board</h2>
          </div>

          {loading ? (
            <div className="text-xs text-center text-gray-500 animate-pulse py-8">Scanning Network...</div>
          ) : bounties.length > 0 ? (
            bounties.map(campaign => (
              <div
                key={campaign.id}
                onClick={() => navigate(`/quest/${campaign.id}`)}
                className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-4 hover:border-[#a020f0] transition-colors cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 border border-green-500/30 uppercase">
                    RM {campaign.budget}
                  </div>
                  <ChevronRight className="text-gray-600 group-hover:text-[#a020f0] transition-colors" size={16} />
                </div>
                <h4 className="font-bold text-white mb-1 group-hover:text-[#a020f0] transition-colors">{campaign.title}</h4>
                <p className="text-xs text-gray-400">{campaign.company_name || 'Anonymous Client'}</p>
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500 text-center py-8 border border-dashed border-gray-800">
              No open bounties available in sector.
            </div>
          )}

          <button onClick={() => navigate('/quests')}
            className="w-full py-3 border border-dashed border-gray-600 text-gray-400 text-xs uppercase tracking-widest hover:border-[#a020f0] hover:text-[#a020f0] transition-all flex items-center justify-center gap-2">
            <Search size={14} /> Browse All Quests
          </button>
        </div>

      </div>
    </div>
  );
};

export default StudentDashboard;