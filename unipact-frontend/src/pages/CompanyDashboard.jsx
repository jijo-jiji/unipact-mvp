import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Users, Briefcase, Activity, Trophy, Clock, Search, Eye, Filter, ArrowUpRight, CheckCircle2, ShieldCheck, LogOut, CreditCard } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [activeTab, setActiveTab] = useState('recruiting'); // recruiting, active, completed
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [campaignsRes, treasuryRes] = await Promise.all([
          api.get('/campaigns/'),
          api.get('/payments/treasury/')
        ]);
        setCampaigns(campaignsRes.data);
        setTreasury(treasuryRes.data);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center text-[#5B6478] text-sm">
        Loading Client Workspace...
      </div>
    );
  }

  const statusMapping = {
    'recruiting': 'OPEN',
    'active': 'IN_PROGRESS',
    'completed': 'COMPLETED'
  };

  const filteredCampaigns = campaigns.filter(c => c.status === statusMapping[activeTab]);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col selection:bg-[#00AEEF] selection:text-white">

      {/* 1. TOP NAVBAR (76px per STYLE_GUIDE.md) */}
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
                Client Workspace
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-[rgba(10,23,72,0.12)]">
              <span className="font-heading font-bold text-sm text-[#0A1748]">
                {user?.company_profile?.company_name || user?.name || 'Enterprise Client'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00AEEF]/10 text-[#0090C6]">
                {treasury?.tier || 'PRO'} TIER
              </span>
            </div>

            <button
              onClick={() => navigate('/company/treasury')}
              className="px-3.5 py-2 rounded-md bg-white border border-[rgba(10,23,72,0.15)] hover:border-[#00AEEF] text-[#0A1748] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <CreditCard size={14} className="text-[#00AEEF]" /> Treasury
            </button>
            <button
              onClick={logout}
              className="px-3.5 py-2 rounded-md border border-[rgba(10,23,72,0.15)] hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-[#5B6478] text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-[1160px] w-full mx-auto px-6 py-8 space-y-8 flex-1">

        {/* Welcome & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0A1748] tracking-tight">
              Enterprise Project Management
            </h1>
            <p className="text-[#5B6478] text-xs sm:text-sm mt-1">
              Review incoming student matches, track squad milestones, and evaluate deliverable handoffs.
            </p>
          </div>

          <button
            onClick={() => navigate('/campaign/new')}
            className="px-6 py-3 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <Plus size={16} /> Post Project Order
          </button>
        </div>

        {/* 3. METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Recruiting Orders</span>
            <div className="font-heading text-3xl font-extrabold text-[#0B1E63]">
              {campaigns.filter(c => c.status === 'OPEN').length}
            </div>
          </div>
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Active Projects</span>
            <div className="font-heading text-3xl font-extrabold text-[#00AEEF]">
              {campaigns.filter(c => c.status === 'IN_PROGRESS').length}
            </div>
          </div>
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Completed Work</span>
            <div className="font-heading text-3xl font-extrabold text-emerald-600">
              {campaigns.filter(c => c.status === 'COMPLETED').length}
            </div>
          </div>
          <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-xl shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">Account Tier</span>
            <div className="font-heading text-xl font-extrabold text-[#0A1748] mt-1 flex items-center gap-2">
              <ShieldCheck size={20} className="text-[#00AEEF]" />
              {treasury?.tier === 'PRO' ? 'Pro Enterprise' : 'Free Tier'}
            </div>
          </div>
        </div>

        {/* 4. MAIN CONTENT SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT 2 COLS: CAMPAIGN MANAGER */}
          <div className="lg:col-span-2 bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-8 shadow-sm min-h-[500px]">

            {/* Tabs Header */}
            <div className="flex items-center justify-between border-b border-[rgba(10,23,72,0.08)] pb-4 mb-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('recruiting')}
                  className={`text-xs uppercase tracking-wider font-bold pb-4 -mb-4 transition-colors ${
                    activeTab === 'recruiting'
                      ? 'text-[#00AEEF] border-b-2 border-[#00AEEF]'
                      : 'text-[#5B6478] hover:text-[#0A1748]'
                  }`}
                >
                  Finding Talent ({campaigns.filter(c => c.status === 'OPEN').length})
                </button>
                <button
                  onClick={() => setActiveTab('active')}
                  className={`text-xs uppercase tracking-wider font-bold pb-4 -mb-4 transition-colors ${
                    activeTab === 'active'
                      ? 'text-[#00AEEF] border-b-2 border-[#00AEEF]'
                      : 'text-[#5B6478] hover:text-[#0A1748]'
                  }`}
                >
                  Active Projects ({campaigns.filter(c => c.status === 'IN_PROGRESS').length})
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`text-xs uppercase tracking-wider font-bold pb-4 -mb-4 transition-colors ${
                    activeTab === 'completed'
                      ? 'text-[#00AEEF] border-b-2 border-[#00AEEF]'
                      : 'text-[#5B6478] hover:text-[#0A1748]'
                  }`}
                >
                  Completed ({campaigns.filter(c => c.status === 'COMPLETED').length})
                </button>
              </div>
            </div>

            {/* Project Cards List */}
            <div className="space-y-4">
              {filteredCampaigns.length > 0 ? (
                filteredCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    onClick={() => navigate(`/manage-campaign/${camp.id}`)}
                    className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] hover:border-[#00AEEF] p-6 rounded-xl transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00AEEF]/10 text-[#0090C6]">
                            {camp.type === 'SOFTWARE_DEVELOPMENT' ? 'Software Development' : 'Digital Marketing'}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#5B6478] border border-[rgba(10,23,72,0.08)]">
                            {camp.status}
                          </span>
                        </div>
                        <h3 className="font-heading font-bold text-lg text-[#0A1748] group-hover:text-[#00AEEF] transition-colors">
                          {camp.title}
                        </h3>
                        <p className="text-[#5B6478] text-xs mt-1 line-clamp-2">{camp.description}</p>
                      </div>

                      <div className="sm:text-right shrink-0">
                        <div className="font-heading font-bold text-base text-[#0B1E63]">RM {camp.budget}</div>
                        <div className="text-[#5B6478] text-xs mt-0.5">Deadline: {camp.deadline || 'Ongoing'}</div>
                      </div>
                    </div>

                    {/* Assigned Squad Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[rgba(10,23,72,0.08)] text-xs">
                      {camp.assigned_students_details && camp.assigned_students_details.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-[#5B6478]">
                          <Users size={14} className="text-[#00AEEF]" />
                          Assigned Squad: <strong className="text-[#0A1748]">{camp.assigned_students_details.map(s => s.full_name).join(', ')}</strong>
                        </div>
                      ) : (
                        <div className="text-[#5B6478] text-xs italic">
                          Awaiting Admin talent matching curation.
                        </div>
                      )}

                      <span className="inline-flex items-center gap-1 font-semibold text-[#00AEEF] group-hover:underline">
                        Track Progress <ArrowUpRight size={13} />
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-[#5B6478] text-xs">
                  No campaigns currently in this view.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COL: TREASURY & SUBSCRIPTION WIDGET */}
          <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-8 shadow-sm h-fit space-y-6">
            <div>
              <h2 className="font-heading font-bold text-lg text-[#0A1748] mb-1">
                Enterprise Treasury
              </h2>
              <p className="text-xs text-[#5B6478]">
                Subscription tier and fee waiver summary
              </p>
            </div>

            <div className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] p-6 rounded-xl text-center">
              <span className="text-xs uppercase font-bold tracking-wider text-[#5B6478] block mb-1">
                Current Plan
              </span>
              <h3 className="font-heading font-extrabold text-2xl text-[#0B1E63] mb-2">
                {treasury?.subscription?.plan_name || 'Pro Enterprise Tier'}
              </h3>
              <p className="text-xs text-[#5B6478] mb-4">
                All talent matching and finder fees are 100% waived.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active Subscription
              </div>
            </div>

            <button
              onClick={() => navigate('/company/treasury')}
              className="w-full py-2.5 rounded-md border border-[rgba(10,23,72,0.15)] hover:border-[#00AEEF] hover:text-[#00AEEF] text-[#0A1748] text-xs font-bold uppercase tracking-wider transition-all"
            >
              Manage Billing & Invoices
            </button>
          </div>

        </div>

      </main>

      {/* 5. FOOTER */}
      <footer className="mt-auto border-t border-[rgba(10,23,72,0.08)] bg-white py-8 px-6 text-center text-xs text-[#5B6478]">
        UniPact Enterprise Talent Platform • Built to STYLE_GUIDE.md
      </footer>

    </div>
  );
};

export default CompanyDashboard;
