import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Loader2, Sparkles } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import StudentProjectCard from '../components/StudentProjectCard';
import { getErrorMessage } from '../utils/format';
import { studentNextStep } from '../utils/projectSummary';
import { usePageTitle } from '../hooks/usePageTitle';

const isActive = (job) => ['IN_PROGRESS', 'MATCHED'].includes(job.status);
const FILTERS = [
  { key: 'ALL', label: 'All', match: () => true },
  { key: 'ACTIVE', label: 'Active', match: isActive },
  { key: 'COMPLETED', label: 'Completed', match: (job) => job.status === 'COMPLETED' },
];

// Projects that need the student first, then the other active ones, then the finished ones
const priority = (job) => (studentNextStep(job).action ? 0 : isActive(job) ? 1 : 2);

// Every project a student is on. Each one opens its own page.
const StudentProjects = () => {
  usePageTitle('Projects');
  const { showToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchProjects = useCallback(async () => {
    try {
      setJobs((await api.get('/campaigns/student/assigned/')).data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load your projects.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // An offer the student hasn't answered isn't their project yet: it is answered from the workspace
  const offers = jobs.filter((j) => j.status === 'MATCHED' && j.my_offer?.status === 'PENDING');
  const projects = jobs.filter((j) => !offers.includes(j)).sort((a, b) => priority(a) - priority(b));
  const shown = projects.filter(FILTERS.find((f) => f.key === filter).match);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />

      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">Projects</h1>
            <p className="text-sm text-[#5B6478] mt-1">Every project you have been matched to or joined as a teammate. Open one to submit work, see your team and track your payouts.</p>
          </div>
          {projects.length > 0 && (
            <div className="flex gap-1 shrink-0" role="group" aria-label="Filter projects">
              {FILTERS.map(({ key, label, match }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    filter === key ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.15)] hover:text-[#0A1748]'
                  }`}
                >
                  {label} ({projects.filter(match).length})
                </button>
              ))}
            </div>
          )}
        </div>

        {offers.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border-2 border-[#00AEEF] shadow-sm">
            <div className="flex items-start gap-3 text-sm">
              <Sparkles size={20} className="text-[#00AEEF] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-base">{offers.length === 1 ? 'You have a project offer waiting' : `You have ${offers.length} project offers waiting`}</strong>
                <span className="text-[#5B6478]">Accept or decline from your workspace. An offer becomes one of your projects once you accept it.</span>
              </div>
            </div>
            <Link to="/student/dashboard" className="btn-primary self-start sm:self-auto shrink-0 whitespace-nowrap">Go to my offers</Link>
          </div>
        )}

        {loading ? (
          <div className="card p-12 flex items-center justify-center gap-3 text-[#5B6478] text-sm">
            <Loader2 size={18} className="animate-spin text-[#00AEEF]" /> Loading your projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="card p-12 text-center">
            <Briefcase className="w-12 h-12 text-[#5B6478]/40 mx-auto mb-3" />
            <h2 className="font-heading font-bold text-lg mb-1">No projects yet</h2>
            <p className="text-[#5B6478] text-sm max-w-md mx-auto">
              When a UniPact admin matches you to a client project, or a classmate invites you to their team, it will show up here.
            </p>
          </div>
        ) : shown.length === 0 ? (
          <div className="card p-10 text-center text-sm text-[#5B6478]">
            {filter === 'ACTIVE' ? 'No active projects right now.' : 'No completed projects yet.'}
          </div>
        ) : (
          <div className="space-y-4">
            {shown.map((job) => <StudentProjectCard key={job.id} job={job} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentProjects;
