import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Link as LinkIcon, Mail, Shield, Users, Trophy
} from 'lucide-react';

const ClubProfile = () => {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState('2025/2026');

  // MOCK DATA: High Committee
  const committeeHistory = {
    '2025/2026': [
      { id: '1', name: 'Sarah Lee', role: 'President', course: 'Data Science Y3' },
      { id: 'ahmad', name: 'Ahmad Razak', role: 'VP Marketing', course: 'Business Admin Y2' },
      { id: 'mei', name: 'Mei Ling', role: 'Secretary', course: 'Law Y2' },
    ]
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 flex justify-center text-white">
      <div className="w-full max-w-5xl animate-fade-in">
        
        {/* 1. HEADER */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[var(--text-blue)] hover:text-white mb-6 transition-colors uppercase text-xs tracking-widest">
          <ArrowLeft size={14} /> Back to Applicant List
        </button>

        {/* 2. CLUB HERO */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 flex flex-col md:flex-row gap-8 items-start mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#a020f0] to-transparent"></div>
          
          <div className="w-24 h-24 bg-black border-2 border-[#a020f0] rounded-full flex items-center justify-center font-display text-3xl text-[#a020f0] shrink-0">
            UM
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-display font-bold uppercase tracking-wide text-white">UM Business Club</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                  <span className="flex items-center gap-1"><MapPin size={14} /> Universiti Malaya</span>
                  <span className="flex items-center gap-1 text-[#a020f0]"><Shield size={14} /> Verified Guild</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-[var(--text-blue)] uppercase tracking-widest mb-1">Rank</div>
                <div className="text-4xl font-display font-bold text-yellow-500">S</div>
              </div>
            </div>
            
            <p className="mt-4 text-gray-300 text-sm leading-relaxed max-w-2xl">
              Premier student entrepreneurship body. We organize the largest campus hackathons in KL.
            </p>
          </div>
        </div>

        {/* 3. HIGH COMMITTEE (The Drill-Down) */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-4 border-b border-[var(--border-tech)] pb-2">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <Users size={16} className="text-[var(--text-gold)]" /> High Committee
            </h3>
            <select 
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="bg-black border border-[var(--border-tech)] text-[var(--text-blue)] text-xs px-3 py-1 outline-none cursor-pointer"
            >
              <option value="2025/2026">Session 2025/2026</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {committeeHistory[activeYear].map((member) => (
              <div 
                key={member.id}
                onClick={() => navigate(`/student/profile/${member.id}`)} // THE DRILL DOWN LINK
                className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-4 flex items-center gap-4 hover:border-[#a020f0] hover:bg-[#a020f0]/10 transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold border border-gray-600 group-hover:border-[#a020f0]">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <div className="text-white font-bold text-sm group-hover:text-[#a020f0] underline-offset-4 group-hover:underline">
                    {member.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-gold)]">{member.role}</div>
                  <div className="text-[10px] text-gray-500">{member.course}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. PAST RAIDS */}
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