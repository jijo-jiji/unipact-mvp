import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Flag,
  Trophy,
  Star,
  ArrowRight,
  Plus,
  CreditCard,
  Search,
  Filter,
  Eye,
  FileText,
  Activity
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // STATE: Active Tab for Campaign Management
  // Default to 'recruiting' to focus on finding talent immediately
  const [activeTab, setActiveTab] = useState('recruiting'); // 'recruiting' | 'active' | 'completed'

  // STATE: Campaigns
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // FETCH CAMPAIGNS
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await api.get('/campaigns/?mode=my_campaigns');
        setCampaigns(response.data);
      } catch (error) {
        console.error("Failed to fetch campaigns", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  // Filter the list based on the selected tab
  // Backend returns status: DRAFT, OPEN, IN_PROGRESS, COMPLETED, ARCHIVED
  // Our tabs: recruiting (OPEN), active (IN_PROGRESS), completed (COMPLETED)
  const statusMapping = {
    'recruiting': 'OPEN',
    'active': 'IN_PROGRESS',
    'completed': 'COMPLETED'
  }

  const filteredCampaigns = campaigns.filter(c => c.status === statusMapping[activeTab]);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6">

      {/* 1. TOP NAVIGATION */}
      <nav className="flex justify-between items-center mb-8 bg-[var(--bg-panel)] p-4 border border-[var(--border-tech)] shadow-lg">
        <div className="flex items-center gap-2">
          <div className="text-[var(--text-gold)] font-display text-xl tracking-widest uppercase">
            {useAuth().user?.name || 'Loading Corporation...'}
          </div>
          <span className="text-[var(--text-blue)] text-xs border border-[var(--text-blue)] px-2 py-0.5 rounded-sm">
            LVL 5
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--text-blue)]">
          <span className="hover:text-[var(--text-gold)] cursor-pointer" onClick={() => navigate('/company/treasury')}>Treasury</span>
          <span className="hover:text-[var(--text-gold)] cursor-pointer" onClick={logout}>Logout</span>
          <div className="w-8 h-8 bg-[var(--text-gold)] rounded-full flex items-center justify-center text-black font-bold">
            {useAuth().user?.name?.[0] || 'C'}
          </div>
        </div>
      </nav>

      {/* 2. WELCOME & ACTIONS */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl text-white font-display uppercase tracking-wider mb-1">
            Command Center
          </h1>
          <p className="text-[var(--text-blue)] text-sm">
            System Online. Overview of all Guild Operations.
          </p>
        </div>

        <button
          onClick={() => navigate('/campaign/new')}
          className="flex items-center gap-2 bg-[var(--text-gold)] text-black px-6 py-3 font-bold uppercase tracking-widest hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all"
        >
          <Plus size={18} />
          Issue New Quest
        </button>
      </div>

      {/* 3. STATS GRID */}
      {/* 3. STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Recruiting', value: campaigns.filter(c => c.status === 'OPEN').length.toString().padStart(2, '0'), icon: Users },
          { label: 'Active Raids', value: campaigns.filter(c => c.status === 'IN_PROGRESS').length.toString().padStart(2, '0'), icon: Activity },
          { label: 'Completed', value: campaigns.filter(c => c.status === 'COMPLETED').length.toString().padStart(2, '0'), icon: Trophy },
          { label: 'Guild Rank', value: 'S', icon: Star, color: 'text-[var(--text-gold)]' }, // Still static for now
        ].map((stat, index) => (
          <div key={index} className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 relative group hover:border-[var(--text-gold)] transition-all">
            <div className="flex justify-between items-start mb-2">
              <h3 className={`text-4xl font-display font-bold ${stat.color || 'text-white'}`}>
                {stat.value}
              </h3>
              <stat.icon className="text-[var(--text-blue)] opacity-20 group-hover:opacity-100 group-hover:text-[var(--text-gold)] transition-all" size={24} />
            </div>
            <p className="text-[var(--text-blue)] text-xs uppercase tracking-widest">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* 4. MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: CAMPAIGN MANAGER (Tabbed View) */}
        <div className="lg:col-span-2 bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 min-h-[500px]">

          {/* TABS HEADER */}
          <div className="flex items-center justify-between border-b border-[var(--border-tech)] pb-4 mb-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('recruiting')}
                className={`text-sm uppercase tracking-wider font-bold pb-4 -mb-4 transition-colors ${activeTab === 'recruiting' ? 'text-[var(--text-gold)] border-b-2 border-[var(--text-gold)]' : 'text-gray-500 hover:text-white'}`}
              >
                Finding Talent
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`text-sm uppercase tracking-wider font-bold pb-4 -mb-4 transition-colors ${activeTab === 'active' ? 'text-[var(--text-gold)] border-b-2 border-[var(--text-gold)]' : 'text-gray-500 hover:text-white'}`}
              >
                On Going
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`text-sm uppercase tracking-wider font-bold pb-4 -mb-4 transition-colors ${activeTab === 'completed' ? 'text-[var(--text-gold)] border-b-2 border-[var(--text-gold)]' : 'text-gray-500 hover:text-white'}`}
              >
                Completed
              </button>
            </div>
            <div className="text-[var(--text-blue)] text-xs flex items-center gap-2 cursor-pointer hover:text-white">
              <Filter size={12} /> Filter
            </div>
          </div>

          {/* CAMPAIGN LIST */}
          <div className="space-y-4">
            {filteredCampaigns.length > 0 ? (
              filteredCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  onClick={() => navigate(`/manage-campaign/${camp.id}`)}
                  className="bg-black/30 border border-[var(--border-tech)] p-6 hover:border-[var(--text-gold)] transition-all group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-bold text-lg group-hover:text-[var(--text-gold)] transition-colors">
                        {camp.title}
                      </h3>
                      <p className="text-gray-400 text-xs mt-1">{camp.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[var(--text-gold)] font-display font-bold">{camp.budget}</div>
                      <div className="text-[var(--text-blue)] text-xs mt-1">{camp.deadline || 'Ended'}</div>
                    </div>
                  </div>

                  {/* DYNAMIC FOOTER BASED ON STATUS */}
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">

                    {/* Status Info */}
                    {activeTab === 'recruiting' && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-blue)]">
                        <Users size={14} />
                        <span className="text-white font-bold">{camp.applicants}</span> Candidates Applied
                      </div>
                    )}
                    {activeTab === 'active' && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-blue)]">
                        <Activity size={14} />
                        Assigned to: <span className="text-white font-bold">{camp.guild}</span>
                      </div>
                    )}
                    {activeTab === 'completed' && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-blue)]">
                        <Trophy size={14} />
                        Performed by: <span className="text-white font-bold">{camp.guild}</span>
                      </div>
                    )}

                    {/* ACTION BUTTON - The crucial link to the next step */}
                    <button
                      onClick={() => navigate(`/company/campaign/${camp.id}/manage`)}
                      className="flex items-center gap-2 text-xs uppercase font-bold text-[var(--text-gold)] border border-[var(--text-gold)] px-4 py-2 hover:bg-[var(--text-gold)] hover:text-black transition-colors"
                    >
                      {activeTab === 'recruiting' && <><Search size={14} /> Inspect Candidates</>}
                      {activeTab === 'active' && <><Eye size={14} /> Track Progress</>}
                      {activeTab === 'completed' && <><FileText size={14} /> View Report</>}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 text-sm">
                No campaigns found in this sector.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: TREASURY WIDGET */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 h-fit">
          <h2 className="text-lg text-[var(--text-gold)] uppercase tracking-wider mb-6 pb-2 border-b border-[var(--border-tech)]">
            Guild Patronage
          </h2>

          <div className="bg-gradient-to-b from-[var(--text-gold)]/10 to-transparent p-6 text-center border border-[var(--text-gold)]/30 mb-4">
            <h3 className="text-xl text-white font-bold mb-1">Diamond Tier</h3>
            <p className="text-[var(--text-blue)] text-xs mb-4">Active until Dec 20, 2025</p>
            <div className="text-green-400 text-xs flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              System Optimal
            </div>
          </div>

          <button
            onClick={() => navigate('/company/treasury')}
            className="w-full py-3 border border-[var(--text-blue)] text-[var(--text-blue)] text-xs uppercase flex items-center justify-center gap-2 hover:bg-[var(--text-blue)] hover:text-black transition-colors"
          >
            <CreditCard size={14} /> Manage Treasury
          </button>
        </div>

      </div>
    </div>
  );
};

export default CompanyDashboard;