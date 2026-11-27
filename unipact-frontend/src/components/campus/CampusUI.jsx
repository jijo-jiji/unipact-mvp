import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../api/client';
import WorkspaceNav from '../WorkspaceNav';
import { getErrorMessage } from '../../utils/format';

// Shared pieces for the UniPact Campus pages (STYLE_GUIDE.md: navy/cyan on #F5F7FC, Outfit headings).

/* eslint-disable react-refresh/only-export-components */
export const DNA_CATEGORIES = [
  ['ACTIVE_PROGRAMME', 'Active Programme'], ['SPORTS_RECREATION', 'Sports & Recreation'],
  ['ENTREPRENEUR', 'Entrepreneur'], ['GLOBAL', 'Global'], ['GRADUATE', 'Graduate'], ['LEADERSHIP', 'Leadership'],
];
export const MERIT_ELEMENTS = [
  ['SPIRITUAL', 'Spiritual'], ['PHYSICAL', 'Physical'], ['INTELLECTUAL', 'Intellectual'],
  ['CAREER', 'Career'], ['EMOTIONAL', 'Emotional'], ['SOCIAL', 'Social'],
];
export const CLUB_TYPES = [
  ['ACADEMIC', 'Academic'], ['SPORTS', 'Sports'], ['CULTURAL', 'Cultural'], ['VOLUNTEER', 'Volunteer'], ['OTHER', 'Other'],
];
export const ACTIVITY_LEVELS = [
  ['CAMPUS', 'Campus'], ['UNIVERSITY', 'University'], ['STATE', 'State'], ['NATIONAL', 'National'],
  ['INTERNATIONAL', 'International'],
];
export const POSITIONS = ['President', 'Program Director', 'Vice President', 'Secretary', 'Treasurer', 'Exco / AJK'];
export const SECTOR_LABEL = { SD: 'Student Development', CL: 'Campus Lifestyle' };
export const labelOf = (pairs, value) => (pairs.find(([v]) => v === value) || [null, value || ''])[1];

// GET a URL and keep it fresh with reload(); `null` url skips loading.
export const useLoad = (url, params) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(url));
  const key = url ? `${url}?${JSON.stringify(params || {})}` : null;

  const reload = useCallback(() => {
    if (!url) return Promise.resolve();
    setLoading(true);
    return api.get(url, { params })
      .then((res) => { setData(res.data); setError(''); })
      .catch((err) => setError(err?.response?.status === 404
        ? 'Not found, or UniPact Campus is not switched on.'
        : getErrorMessage(err, "We couldn't load this.")))
      .finally(() => setLoading(false));
    // key captures url + params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { reload(); }, [reload]);
  return { data, setData, error, loading, reload };
};
/* eslint-enable react-refresh/only-export-components */

export const CampusPage = ({ eyebrow = 'UniPact Campus', title, intro, actions, back, children }) => (
  <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
    <WorkspaceNav />
    <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6 flex-1">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5B6478] hover:text-[#0A1748]">
          <ArrowLeft size={16} aria-hidden="true" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2"><span className="eyebrow-dot" /> {eyebrow}</p>}
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl break-words">{title}</h1>
          {intro && <p className="text-sm text-[#5B6478] mt-1 max-w-[680px]">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </main>
  </div>
);

export const Card = ({ children, className = '' }) => (
  <section className={`card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)] ${className}`}>{children}</section>
);

export const Loading = () => (
  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00AEEF]" aria-label="Loading" /></div>
);

export const ErrorNote = ({ children }) => (children ? <p className="alert-error">{children}</p> : null);

export const Empty = ({ icon: Icon, title, children }) => (
  <div className="text-center py-10">
    {Icon && <Icon className="mx-auto text-[#00AEEF]" size={28} aria-hidden="true" />}
    <p className="font-semibold mt-3">{title}</p>
    {children && <p className="text-sm text-[#5B6478] mt-1 max-w-[480px] mx-auto">{children}</p>}
  </div>
);

const PILL = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  COMPLETED: 'bg-[#0B1E63]/5 text-[#0B1E63] border-[#0B1E63]/20',
  WITHDRAWN: 'bg-slate-50 text-slate-600 border-slate-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
  SKIPPED: 'bg-slate-50 text-slate-500 border-slate-200',
};
export const StatusPill = ({ status, label }) => (
  <span className={`badge ${PILL[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{label || status}</span>
);

export const Tabs = ({ tabs, value, onChange, label = 'Sections' }) => (
  <div className="flex flex-wrap gap-1 border-b border-[rgba(10,23,72,0.12)]" role="tablist" aria-label={label}>
    {tabs.map(([key, text, count]) => (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={value === key}
        onClick={() => onChange(key)}
        className={`px-3 py-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${value === key
          ? 'border-[#00AEEF] text-[#0A1748]' : 'border-transparent text-[#5B6478] hover:text-[#0A1748]'}`}
      >
        {text}{count ? <span className="ml-1.5 badge bg-[#00AEEF]/10 text-[#00729F] border-[#00AEEF]/30">{count}</span> : null}
      </button>
    ))}
  </div>
);

export const Field = ({ label, hint, children, htmlFor }) => (
  <div>
    <label className="field-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <p className="field-hint">{hint}</p>}
  </div>
);

export const ChoiceChips = ({ options, value = [], onChange, label }) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
    {options.map(([code, text]) => {
      const on = value.includes(code);
      return (
        <button
          key={code}
          type="button"
          aria-pressed={on}
          onClick={() => onChange(on ? value.filter((v) => v !== code) : [...value, code])}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${on
            ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.15)] hover:text-[#0A1748]'}`}
        >
          {text}
        </button>
      );
    })}
  </div>
);

// eslint-disable-next-line react-refresh/only-export-components
export const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
