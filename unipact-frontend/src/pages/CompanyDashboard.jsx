import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Users, ArrowUpRight, ShieldCheck, CreditCard, Sparkles, Briefcase, CalendarDays, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import WorkspaceNav from '../components/WorkspaceNav';
import StatusBadge from '../components/StatusBadge';
import { campaignTypeLabel, formatDate, formatMoney } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const TABS = [
  { key: 'recruiting', label: 'Finding talent', statuses: ['OPEN', 'MATCHED'] },
  { key: 'active', label: 'In progress', statuses: ['IN_PROGRESS'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
];

const CompanyDashboard = () => {
  usePageTitle('Projects');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [activeTab, setActiveTab] = useState('recruiting');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Load independently so a billing hiccup doesn't hide the project list
      const [campaignsRes, treasuryRes] = await Promise.allSettled([
        api.get('/campaigns/', { params: { mode: 'my_campaigns' } }),
        api.get('/payments/treasury/'),
      ]);
      if (campaignsRes.status === 'fulfilled') {
        setCampaigns(campaignsRes.value.data);
      } else {
        setLoadError('We could not load your projects. Please refresh the page.');
      }
      if (treasuryRes.status === 'fulfilled') setTreasury(treasuryRes.value.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const countFor = (statuses) => campaigns.filter((c) => statuses.includes(c.status)).length;
  const currentTab = TABS.find((t) => t.key === activeTab);
  const filteredCampaigns = campaigns.filter((c) => currentTab.statuses.includes(c.status));
  const matchReady = campaigns.filter((c) => c.status === 'MATCHED');
  const tier = treasury?.tier || user?.company_profile?.tier;
  const isPro = tier === 'PRO';
  const verification = user?.company_profile?.verification_status || user?.verification_status;

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />

      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-8 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="eyebrow mb-1"><span className="eyebrow-dot" /> {user?.company_profile?.company_name || user?.name || 'Client workspace'}</p>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight">Your projects</h1>
            <p className="text-[#5B6478] text-sm mt-1">Post projects, confirm student matches and review deliverables in one place.</p>
          </div>
          <button onClick={() => navigate('/campaign/new')} className="btn-primary self-start sm:self-auto px-5 py-3">
            <Plus size={16} /> Post a project
          </button>
        </div>

        {verification === 'HIGH_RISK' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <span>Your account is under manual review because it uses a public email domain. You can post projects once an admin verifies your company.</span>
          </div>
        )}

        {matchReady.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white border-2 border-[#00AEEF] shadow-sm">
            <div className="flex items-start gap-3">
              <Sparkles size={20} className="text-[#00AEEF] shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong className="block text-[#0A1748]">
                  {matchReady.length === 1 ? 'A student match is ready for review' : `${matchReady.length} student matches are ready for review`}
                </strong>
                <span className="text-[#5B6478]">Confirm the match so your team can start work.</span>
              </div>
            </div>
            <button onClick={() => navigate(`/manage-campaign/${matchReady[0].id}`)} className="btn-primary btn-sm self-start sm:self-auto">
              Review match <ArrowUpRight size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Finding talent', value: countFor(['OPEN', 'MATCHED']), className: 'text-[#0B1E63]' },
            { label: 'In progress', value: countFor(['IN_PROGRESS']), className: 'text-[#00AEEF]' },
            { label: 'Completed', value: countFor(['COMPLETED']), className: 'text-emerald-600' },
          ].map((m) => (
            <div key={m.label} className="card p-5">
              <span className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] block mb-1">{m.label}</span>
              <div className={`font-heading text-3xl font-extrabold ${m.className}`}>{loading ? '–' : m.value}</div>
            </div>
          ))}
          <div className="card p-5">
            <span className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] block mb-1">Plan</span>
            <div className="font-heading text-xl font-extrabold mt-1.5 flex items-center gap-2">
              <ShieldCheck size={20} className="text-[#00AEEF]" /> {tier ? (isPro ? 'Pro' : 'Free') : '–'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 card p-5 sm:p-8 min-h-[420px]">
            <div role="tablist" className="flex gap-1 sm:gap-6 border-b border-[rgba(10,23,72,0.08)] mb-6 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`text-sm font-semibold pb-3 px-2 -mb-px border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.key ? 'text-[#0090C6] border-[#00AEEF]' : 'text-[#5B6478] border-transparent hover:text-[#0A1748]'
                  }`}
                >
                  {tab.label} <span className="ml-1 text-xs text-[#5B6478]">({countFor(tab.statuses)})</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex items-center justify-center gap-3 text-sm text-[#5B6478]">
                <Loader2 size={18} className="animate-spin text-[#00AEEF]" /> Loading your projects…
              </div>
            ) : loadError ? (
              <div className="alert-error"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {loadError}</div>
            ) : filteredCampaigns.length > 0 ? (
              <div className="space-y-4">
                {filteredCampaigns.map((camp) => (
                  <Link
                    key={camp.id}
                    to={`/manage-campaign/${camp.id}`}
                    className="block bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] hover:border-[#00AEEF] hover:bg-white p-5 rounded-xl transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6]">{campaignTypeLabel(camp.type)}</span>
                          <StatusBadge status={camp.status} />
                        </div>
                        <h3 className="font-heading font-bold text-lg group-hover:text-[#0090C6] transition-colors">{camp.title}</h3>
                        <p className="text-[#5B6478] text-sm mt-1 line-clamp-2">{camp.description}</p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <div className="font-heading font-bold text-base text-[#0B1E63]">{formatMoney(camp.budget)}</div>
                        <div className="text-[#5B6478] text-xs mt-0.5 inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDate(camp.deadline, 'No deadline')}</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[rgba(10,23,72,0.08)] text-sm">
                      {camp.assigned_students_details?.length > 0 ? (
                        <span className="flex items-center gap-1.5 text-[#5B6478] min-w-0">
                          <Users size={14} className="text-[#00AEEF] shrink-0" />
                          <span className="truncate">Team: <strong className="text-[#0A1748]">{camp.assigned_students_details.map((s) => s.full_name).join(', ')}</strong></span>
                        </span>
                      ) : camp.applicants > 0 ? (
                        <span className="text-[#5B6478]">{camp.applicants} club application{camp.applicants === 1 ? '' : 's'}</span>
                      ) : (
                        <span className="text-[#5B6478] italic">A UniPact admin is finding the right students for you.</span>
                      )}
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0090C6] shrink-0">
                        {camp.status === 'MATCHED' ? 'Review match' : 'Open project'} <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-14">
                <Briefcase className="w-11 h-11 text-[#5B6478]/40 mx-auto mb-3" />
                <p className="text-sm text-[#5B6478] mb-4">
                  {activeTab === 'recruiting' ? "You don't have any projects looking for talent." : `No ${currentTab.label.toLowerCase()} projects yet.`}
                </p>
                {activeTab === 'recruiting' && (
                  <button onClick={() => navigate('/campaign/new')} className="btn-primary btn-sm"><Plus size={14} /> Post your first project</button>
                )}
              </div>
            )}
          </section>

          <aside className="card p-6 sm:p-8 h-fit space-y-5">
            <div>
              <h2 className="font-heading font-bold text-lg">Billing</h2>
              <p className="text-sm text-[#5B6478]">Your plan and matching fees</p>
            </div>
            <div className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] p-5 rounded-xl text-center">
              <span className="text-xs uppercase font-semibold tracking-wider text-[#5B6478] block mb-1">Current plan</span>
              <h3 className="font-heading font-extrabold text-2xl text-[#0B1E63] mb-2">{isPro ? 'Pro' : 'Free'}</h3>
              <p className="text-sm text-[#5B6478]">
                {isPro ? "Finder's fees are waived on every match." : "Posting is free. A finder's fee applies when you confirm a student match."}
              </p>
            </div>
            <button onClick={() => navigate('/company/treasury')} className="btn-secondary w-full">
              <CreditCard size={15} /> {isPro ? 'Manage billing' : 'Upgrade or view invoices'}
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default CompanyDashboard;
