import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, ExternalLink, FileText, Loader2, PenLine } from 'lucide-react';
import api from '../api/client';
import WorkspaceNav from '../components/WorkspaceNav';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const ALL = 'ALL';

const ItemRow = ({ item }) => {
  const exercise = item.item_type === 'EXERCISE';
  const Icon = exercise ? PenLine : FileText;
  return (
    <li className="py-4 flex gap-3">
      <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${exercise ? 'bg-[#00AEEF]/10 text-[#00729F]' : 'bg-[#0B1E63]/5 text-[#0B1E63]'}`} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {item.title}
          {exercise && <span className="ml-2 text-xs font-bold uppercase tracking-wider text-[#00729F]">Exercise</span>}
        </p>
        {item.description && <p className="text-sm text-[#5B6478] mt-1 whitespace-pre-line">{item.description}</p>}
        <div className="flex flex-wrap gap-3 mt-2">
          {item.file_url && (
            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00729F] hover:underline">
              <Download size={14} /> {item.file_name || 'Download'}
            </a>
          )}
          {item.link_url && (
            <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00729F] hover:underline">
              <ExternalLink size={14} /> Open link
            </a>
          )}
        </div>
      </div>
    </li>
  );
};

const LearningLibrary = () => {
  usePageTitle('Learning');
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topic, setTopic] = useState(ALL);

  useEffect(() => {
    api.get('/impact/learning/')
      .then((res) => setModules(res.data))
      .catch((err) => setError(getErrorMessage(err, 'Could not load the learning library.')))
      .finally(() => setLoading(false));
  }, []);

  const topics = useMemo(() => {
    const seen = new Map();
    modules.forEach((m) => seen.set(m.topic, m.topic_label));
    return [...seen.entries()];
  }, [modules]);
  const shown = topic === ALL ? modules : modules.filter((m) => m.topic === topic);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />
      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">Learning</h1>
            <p className="text-sm text-[#5B6478] mt-1 max-w-[640px]">
              Slides, notes and exercises from UniPact workshops. Come back to them any time, and use them to prepare for client projects.
            </p>
          </div>
          {topics.length > 1 && (
            <div className="flex flex-wrap gap-1 shrink-0" role="group" aria-label="Filter by topic">
              {[[ALL, 'All'], ...topics].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={topic === key}
                  onClick={() => setTopic(key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${topic === key ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.12)] hover:text-[#0A1748]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00AEEF]" /></div>}
        {!loading && error && <p className="alert-error">{error}</p>}
        {!loading && !error && modules.length === 0 && (
          <div className="card p-10 bg-white border border-[rgba(10,23,72,0.1)] text-center">
            <BookOpen className="mx-auto text-[#00AEEF]" size={28} aria-hidden="true" />
            <p className="font-semibold mt-3">No modules yet</p>
            <p className="text-sm text-[#5B6478] mt-1">Workshop materials will appear here after each session.</p>
          </div>
        )}

        <div className="space-y-5">
          {shown.map((m) => {
            const exercises = m.items.filter((i) => i.item_type === 'EXERCISE').length;
            return (
              <section key={m.id} className="card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)]">
                <p className="eyebrow mb-2"><span className="eyebrow-dot" /> {m.topic_label}</p>
                <h2 className="font-heading font-bold text-xl">{m.title}</h2>
                {m.summary && <p className="text-[#5B6478] mt-1 whitespace-pre-line">{m.summary}</p>}
                <p className="text-xs text-[#5B6478] mt-2">
                  {m.items.length - exercises} material{m.items.length - exercises === 1 ? '' : 's'} · {exercises} exercise{exercises === 1 ? '' : 's'}
                </p>
                {m.items.length > 0 && (
                  <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-3 border-t border-[rgba(10,23,72,0.08)]">
                    {m.items.map((item) => <ItemRow key={item.id} item={item} />)}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default LearningLibrary;
