import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, Clock, Building2, Compass, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import { campaignTypeLabel, formatDate, formatMoney, getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const BUDGET_FILTERS = [
  { key: 'all', label: 'Any budget', test: () => true },
  { key: 'large', label: 'RM 5,000+', test: (b) => b >= 5000 },
  { key: 'medium', label: 'RM 1,000 – 4,999', test: (b) => b >= 1000 && b < 5000 },
  { key: 'small', label: 'Under RM 1,000', test: (b) => b < 1000 },
];

const QuestBoard = () => {
  usePageTitle('Quest board');
  const { showToast } = useToast();
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [budgetFilter, setBudgetFilter] = useState('all');

  useEffect(() => {
    const fetchQuests = async () => {
      try {
        const response = await api.get('/campaigns/');
        const data = Array.isArray(response.data) ? response.data : response.data.results || [];
        setQuests(data.filter((q) => q.status === 'OPEN'));
      } catch (error) {
        showToast(getErrorMessage(error, 'Could not load quests.'), 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchQuests();
  }, [showToast]);

  const visibleQuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const budgetTest = BUDGET_FILTERS.find((f) => f.key === budgetFilter).test;
    return quests.filter((quest) =>
      budgetTest(Number(quest.budget)) &&
      (!q || [quest.title, quest.company_name, quest.description].join(' ').toLowerCase().includes(q))
    );
  }, [quests, search, budgetFilter]);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow mb-1"><span className="eyebrow-dot" /> Quest board</p>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold">Open company quests</h1>
            <p className="text-sm text-[#5B6478] mt-1">{loading ? 'Loading…' : `${visibleQuests.length} of ${quests.length} quests shown`}</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478]" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or company" className="input pl-9 bg-white" aria-label="Search quests" />
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto overflow-y-hidden pb-1" role="group" aria-label="Filter by budget">
          {BUDGET_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setBudgetFilter(f.key)} aria-pressed={budgetFilter === f.key}
              className={`px-3.5 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors ${budgetFilter === f.key ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.15)] hover:text-[#0A1748]'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card p-12 text-center text-sm text-[#5B6478]"><Loader2 size={18} className="animate-spin inline mr-2 text-[#00AEEF]" /> Loading quests…</div>
        ) : visibleQuests.length === 0 ? (
          <div className="card p-12 text-center">
            <Compass className="w-11 h-11 text-[#5B6478]/40 mx-auto mb-3" />
            <p className="text-sm text-[#5B6478]">{quests.length === 0 ? 'There are no open quests right now. Check back soon.' : 'No quests match your search.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleQuests.map((quest) => (
              <Link key={quest.id} to={`/quest/${quest.id}`} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#00AEEF] transition-colors group">
                <div className="min-w-0">
                  <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6] mb-1.5">{campaignTypeLabel(quest.type)}</span>
                  <h2 className="font-heading font-bold text-lg group-hover:text-[#0090C6] transition-colors">{quest.title}</h2>
                  <p className="text-sm text-[#5B6478] flex items-center gap-1.5 mt-0.5"><Building2 size={14} /> {quest.company_name}</p>
                </div>
                <div className="flex items-center gap-6 justify-between md:justify-end shrink-0">
                  <div className="md:text-right">
                    <div className="font-heading font-bold text-[#0B1E63]">{formatMoney(quest.budget)}</div>
                    <div className="text-xs text-[#5B6478] flex items-center gap-1 md:justify-end mt-0.5"><Clock size={12} /> {formatDate(quest.deadline, 'No deadline')}</div>
                  </div>
                  <ChevronRight className="text-[#5B6478] group-hover:text-[#00AEEF] group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default QuestBoard;
