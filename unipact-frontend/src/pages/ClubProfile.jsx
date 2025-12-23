import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import {
  ArrowLeft, MapPin, Link as LinkIcon, Mail, Shield, Users, Trophy
} from 'lucide-react';

const ClubProfile = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeYear, setActiveYear] = useState('2025/2026');

  // STATE: Club & Roster
  const [club, setClub] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Club Details
        const clubRes = await api.get(`/users/club/${id}/`);
        setClub(clubRes.data);

        // 2. Fetch Roster
        const rosterRes = await api.get(`/users/club/${id}/roster/`);
        setRoster(rosterRes.data);

      } catch (error) {
        console.error("Failed to fetch club data", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center text-[var(--text-gold)] animate-pulse">Initializing Terminal...</div>;
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] text-white p-6">
        <button onClick={() => navigate(-1)} className="mb-4 text-[var(--text-blue)]">&larr; Back</button>
        <div className="text-red-500">Error: Guild Not Found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 flex justify-center text-white">
      <div className="w-full max-w-5xl animate-fade-in">

        {/* 1. HEADER */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[var(--text-blue)] hover:text-white mb-6 transition-colors uppercase text-xs tracking-widest">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        {/* 2. CLUB HERO */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 flex flex-col md:flex-row gap-8 items-start mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#a020f0] to-transparent"></div>

          <div className="w-24 h-24 bg-black border-2 border-[#a020f0] rounded-full flex items-center justify-center font-display text-3xl text-[#a020f0] shrink-0">
            {club.club_name.charAt(0)}
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-display font-bold uppercase tracking-wide text-white">{club.club_name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                  <span className="flex items-center gap-1"><MapPin size={14} /> {club.university}</span>
                  <span className="flex items-center gap-1 text-[#a020f0]"><Shield size={14} /> {club.verification_status}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-[var(--text-blue)] uppercase tracking-widest mb-1">Rank</div>
                <div className="text-4xl font-display font-bold text-yellow-500">S</div>
              </div>
            </div>

            <p className="mt-4 text-gray-300 text-sm leading-relaxed max-w-2xl">
              Premier student entrepreneurship body. We organize the largest campus hackathons in KL. (Mock Bio)
            </p>
          </div>
        </div>

        {/* 3. HIGH COMMITTEE (Roster) */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-4 border-b border-[var(--border-tech)] pb-2">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <Users size={16} className="text-[var(--text-gold)]" /> Committee Roster
            </h3>
            <div className="text-[var(--text-blue)] text-xs">Total Members: {roster.length}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roster.length > 0 ? (
              roster.map((member, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-4 flex items-center gap-4 hover:border-[#a020f0] hover:bg-[#a020f0]/10 transition-all cursor-not-allowed group opacity-80"
                  title="Profile viewing coming soon (User is pending registration)"
                >
                  <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold border border-gray-600 group-hover:border-[#a020f0]">
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm group-hover:text-[#a020f0]">
                      {member.email}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-gold)]">{member.role}</div>
                    <div className="text-[10px] text-gray-500">Invited: {new Date(member.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-gray-500 text-xs uppercase tracking-widest border border-dashed border-gray-800">
                No active members found on roster.
              </div>
            )}
          </div>
        </div>

        {/* 4. PAST RAIDS (Static for now) */}
        <div>
          <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-[#a020f0]" /> Campaign History
          </h3>
          <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 flex justify-between items-center">
            <div>
              <div className="text-[10px] text-green-400 uppercase font-bold mb-1">Mission Accomplished</div>
              <h4 className="text-lg font-bold text-white">Maxis 5G Campus Hackathon</h4>
            </div>
            <div className="text-right text-sm text-gray-500">Nov 2025</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClubProfile;