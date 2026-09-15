import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Trophy, AlertCircle } from 'lucide-react';
import api from '../api/client';
import WorkspaceNav from '../components/WorkspaceNav';
import PageLoader from '../components/PageLoader';
import StatusBadge from '../components/StatusBadge';
import { formatDate } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const ClubProfile = () => {
  usePageTitle('Club profile');
  const navigate = useNavigate();
  const { id } = useParams();
  const [club, setClub] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [clubRes, rosterRes] = await Promise.all([
          api.get(`/users/club/${id}/profile/`),
          api.get(`/users/club/${id}/roster/`),
        ]);
        setClub(clubRes.data);
        setRoster(rosterRes.data);
      } catch {
        setClub(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <PageLoader message="Loading club…" />;

  if (!club) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] font-body">
        <WorkspaceNav />
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <AlertCircle size={40} className="mx-auto text-[#5B6478]/50 mb-3" />
          <h1 className="font-heading font-bold text-xl mb-2">Club not found</h1>
          <button onClick={() => navigate(-1)} className="btn-primary mt-4">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6 animate-fade-in">
        <button onClick={() => navigate(-1)} className="back-link">
          <ArrowLeft size={15} /> Back
        </button>

        <section className="card p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-20 h-20 bg-[#0B1E63] rounded-2xl flex items-center justify-center font-heading font-extrabold text-3xl text-[#00AEEF] shrink-0">
            {club.club_name.charAt(0)}
          </div>
          <div className="flex-1 flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold">{club.club_name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#5B6478] mt-2">
                <span className="inline-flex items-center gap-1"><MapPin size={14} /> {club.university}</span>
                <StatusBadge status={club.verification_status} />
              </div>
            </div>
            <div className="text-center bg-[#F5F7FC] rounded-lg px-5 py-3 self-start">
              <div className="text-xs uppercase font-semibold tracking-wider text-[#5B6478]">Rank</div>
              <div className="font-heading text-3xl font-extrabold text-amber-500">{club.rank || 'C'}</div>
            </div>
          </div>
        </section>

        <section className="card p-6 sm:p-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-heading font-bold text-lg flex items-center gap-2"><Users size={18} className="text-[#00AEEF]" /> Committee</h2>
            <span className="text-sm text-[#5B6478]">{(() => { const n = roster.filter((m) => m.status !== 'Pending').length; return `${n} member${n === 1 ? '' : 's'}`; })()}</span>
          </div>
          {roster.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {roster.map((member, idx) => {
                const pending = member.status === 'Pending';
                // Emails (and pending invites) are only included for the club president and admins
                const label = pending ? member.email : member.name?.trim() || member.email || 'Member';
                return (
                  <div key={member.id || member.email || idx} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-[rgba(10,23,72,0.12)] rounded-full flex items-center justify-center text-sm font-bold text-[#0B1E63] shrink-0">
                      {label.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{label}</div>
                      <div className="text-xs text-[#0090C6]">{member.role}</div>
                      {pending && <div className="text-xs text-[#5B6478]">Invitation pending · sent {formatDate(member.created_at)} · only you can see this</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#5B6478] text-center py-6">No members listed yet.</p>
          )}
        </section>

        <section className="card p-6 sm:p-8">
          <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2"><Trophy size={18} className="text-[#00AEEF]" /> Campaign history</h2>
          {club.campaign_history?.length > 0 ? (
            <div className="space-y-3">
              {club.campaign_history.map((campaign, idx) => (
                <div key={idx} className="bg-[#F5F7FC] rounded-lg p-4 flex justify-between items-center gap-4">
                  <div>
                    <div className="font-semibold">{campaign.title}</div>
                    <div className="text-xs text-emerald-700">{campaign.status}</div>
                  </div>
                  <div className="text-sm text-[#5B6478] whitespace-nowrap">{campaign.date}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#5B6478] text-center py-6">No campaigns completed yet.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default ClubProfile;
