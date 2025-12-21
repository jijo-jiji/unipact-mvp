import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ChevronRight,
  Coins,
  Clock,
  Shield
} from 'lucide-react';

const QuestBoard = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  /* MOCK DATA REPLACED BY API */
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuests = async () => {
      try {
        const response = await api.get('/campaigns/');
        // Filter out drafts or archived? Backend logic should handle it or filter here
        // Assuming /campaigns returns all, let's filter for OPEN ones 
        // Need to check API response structure from serializers
        // Serializer returns: status.
        const openQuests = response.data.filter(q => q.status === 'OPEN');
        setQuests(openQuests);
      } catch (error) {
        console.error("Failed to fetch quests", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuests();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 text-white flex justify-center">
      <div className="w-full max-w-5xl animate-fade-in">

        {/* 1. HEADER & SEARCH */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="text-[var(--text-blue)] text-xs uppercase tracking-widest hover:text-white mb-4"
          >
            &lt; Return to Terminal
          </button>

          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold uppercase tracking-wider text-white">
                Available Quests
              </h1>
              <p className="text-[var(--text-blue)] text-sm">
                Current Active Bounties: <span className="text-[#a020f0] font-bold">{quests.length}</span>
              </p>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2 bg-black/30 border border-[var(--border-tech)] p-2 w-full md:w-96 focus-within:border-[#a020f0] transition-colors">
              <Search className="text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search by keyword or Client ID..."
                className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-gray-600"
              />
            </div>
          </div>
        </div>

        {/* 2. FILTERS */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'S-Rank', 'A-Rank', 'B-Rank'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 border text-xs uppercase tracking-wider transition-all ${filter === f
                ? 'bg-[#a020f0]/20 border-[#a020f0] text-white'
                : 'border-[var(--border-tech)] text-gray-500 hover:text-white hover:border-white'
                }`}
            >
              {f === 'all' ? 'All Ranks' : f}
            </button>
          ))}
          <button className="px-4 py-2 border border-[var(--border-tech)] text-gray-500 text-xs uppercase tracking-wider hover:text-white hover:border-white flex items-center gap-2 ml-auto">
            <Filter size={12} /> Advanced Filter
          </button>
        </div>

        {/* 3. QUEST LIST GRID */}
        <div className="grid grid-cols-1 gap-4">
          {quests.map((quest) => (
            <div
              key={quest.id}
              onClick={() => navigate(`/quest/${quest.id}`)}
              className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 flex flex-col md:flex-row items-center justify-between hover:border-[#a020f0] hover:shadow-[0_0_15px_rgba(160,32,240,0.1)] transition-all cursor-pointer group"
            >
              {/* Left: Info */}
              <div className="flex items-center gap-6 w-full md:w-auto">
                {/* Rank Badge - Static for MVP or calculated based on Budget? */}
                <div className={`w-12 h-12 flex items-center justify-center font-display font-bold text-xl border-2 border-purple-500 text-purple-500`}>
                  A
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-[#a020f0] transition-colors">
                    {quest.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><Shield size={12} /> {quest.company_name}</span>
                    <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                    <span>{quest.type}</span>
                  </div>
                </div>
              </div>

              {/* Right: Rewards & Action */}
              <div className="flex items-center gap-8 w-full md:w-auto mt-4 md:mt-0 justify-between md:justify-end">
                <div className="text-right">
                  <div className="text-white font-bold flex items-center gap-2 justify-end">
                    <Coins size={14} className="text-[#a020f0]" /> RM {quest.budget}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 justify-end mt-1">
                    <Clock size={12} /> {quest.deadline || 'No Deadline'}
                  </div>
                </div>

                <ChevronRight className="text-gray-600 group-hover:text-[#a020f0] transition-transform group-hover:translate-x-1" />
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default QuestBoard;