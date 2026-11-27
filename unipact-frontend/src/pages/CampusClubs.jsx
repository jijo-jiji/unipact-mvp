import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Card, CampusPage, Empty, ErrorNote, Loading, SECTOR_LABEL, useLoad } from '../components/campus/CampusUI';

const FILTERS = [['', 'All clubs'], ['SD', 'Student Development'], ['CL', 'Campus Lifestyle'], ['mine', 'My clubs']];

// Club directory (UniKLSKILL F019): every club, filterable by sector, with "My clubs".
const CampusClubs = () => {
  usePageTitle('Clubs');
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const params = filter === 'mine' ? { mine: 1 } : filter ? { sector: filter } : {};
  const { data, error, loading } = useLoad('/campus/clubs/', params);
  const q = query.trim().toLowerCase();
  const clubs = (data || []).filter((c) => !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));

  return (
    <CampusPage
      title="Clubs"
      intro="Find a club, read what it does, and ask to join. The committee or advisor approves your request."
      back={{ to: '/campus', label: 'Campus' }}
      actions={user?.role === 'STUDENT' && (
        <Link to="/campus/clubs/propose" className="btn-secondary btn-sm"><PlusCircle size={16} aria-hidden="true" /> Start a club</Link>
      )}
    >
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter clubs">
          {FILTERS.map(([key, label]) => (
            <button
              key={key || 'all'}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${filter === key ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.12)] hover:text-[#0A1748]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative md:w-72">
          <span className="sr-only">Search clubs</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478]" aria-hidden="true" />
          <input className="input pl-9" placeholder="Search clubs" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {!loading && !error && clubs.length === 0 && (
        <Card>
          <Empty icon={Users} title={filter === 'mine' ? "You haven't joined a club yet" : 'No clubs found'}>
            {filter === 'mine' ? 'Browse all clubs and ask to join one.' : 'Try another filter or search.'}
          </Empty>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clubs.map((club) => (
          <Link
            key={club.id}
            to={`/campus/clubs/${club.id}`}
            className="card p-5 bg-white border border-[rgba(10,23,72,0.1)] hover:border-[#00AEEF] transition-colors flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              {club.logo
                ? <img src={club.logo} alt="" className="w-12 h-12 rounded-lg object-cover border border-[rgba(10,23,72,0.12)]" />
                : (
                  <span className="w-12 h-12 rounded-lg bg-[#0B1E63] text-white font-heading font-bold flex items-center justify-center" aria-hidden="true">
                    {club.name.charAt(0)}
                  </span>
                )}
              <div className="min-w-0">
                <p className="font-heading font-bold text-lg leading-tight truncate">{club.name}</p>
                <p className="text-xs text-[#5B6478]">{SECTOR_LABEL[club.sector] || club.section}{club.campus ? ` · ${club.campus.short_name || club.campus.name}` : ''}</p>
              </div>
            </div>
            {club.description && <p className="text-sm text-[#5B6478] line-clamp-3">{club.description}</p>}
            <div className="mt-auto flex flex-wrap gap-1.5 text-xs">
              {club.club_type_label && <span className="badge bg-[#F5F7FC] text-[#0A1748] border-[rgba(10,23,72,0.12)]">{club.club_type_label}</span>}
              {club.dna_category_label && <span className="badge bg-[#00AEEF]/10 text-[#00729F] border-[#00AEEF]/30">{club.dna_category_label}</span>}
              <span className="badge bg-white text-[#5B6478] border-[rgba(10,23,72,0.12)]">{club.member_count} member{club.member_count === 1 ? '' : 's'}</span>
              {!club.joining_open && <span className="badge bg-slate-50 text-slate-600 border-slate-200">Not taking members</span>}
            </div>
          </Link>
        ))}
      </div>
    </CampusPage>
  );
};

export default CampusClubs;
