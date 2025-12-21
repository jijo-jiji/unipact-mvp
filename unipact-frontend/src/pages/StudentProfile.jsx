import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Mail, Download, Star, Briefcase, Award 
} from 'lucide-react';

const StudentProfile = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 flex justify-center text-white">
      <div className="w-full max-w-4xl animate-fade-in">
        
        {/* 1. HEADER */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[var(--text-blue)] hover:text-white mb-6 transition-colors uppercase text-xs tracking-widest">
          <ArrowLeft size={14} /> Return to Guild Roster
        </button>

        {/* 2. STUDENT HERO (Personal Card) */}
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          {/* Avatar */}
          <div className="w-40 h-40 bg-gray-800 border-2 border-[var(--text-gold)] rounded-sm overflow-hidden shrink-0 shadow-[0_0_20px_rgba(222,184,116,0.2)]">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Profile" className="w-full h-full object-cover" />
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-display font-bold text-white mb-1">Sarah Lee</h1>
            <div className="text-[var(--text-gold)] uppercase tracking-widest text-sm font-bold mb-4">
              President @ UM Business Club
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 mb-6">
              <div><span className="text-[var(--text-blue)]">Course:</span> Data Science (Year 3)</div>
              <div><span className="text-[var(--text-blue)]">CGPA:</span> 3.85</div>
              <div><span className="text-[var(--text-blue)]">Status:</span> Open for Work</div>
              <div><span className="text-[var(--text-blue)]">Verified:</span> Level 5</div>
            </div>

            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-[var(--text-gold)] text-black text-xs uppercase font-bold hover:bg-white transition-all">
                <Mail size={14} /> Contact
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-300 text-xs uppercase font-bold hover:border-white hover:text-white transition-all">
                <Download size={14} /> Download Resume
              </button>
            </div>
          </div>
        </div>

        {/* 3. EXPERIENCE TIMELINE (The Track Record) */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8">
          <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-6 flex items-center gap-2">
            <Briefcase size={16} className="text-[var(--text-gold)]" /> Verified Campaign History
          </h3>

          <div className="space-y-8 border-l-2 border-gray-800 pl-8 relative">
            
            {/* Item 1 */}
            <div className="relative">
              <div className="absolute -left-[39px] top-1 w-5 h-5 bg-[var(--bg-void)] border-2 border-[var(--text-gold)] rounded-full"></div>
              <h4 className="text-lg font-bold text-white">Project Director</h4>
              <div className="text-sm text-[var(--text-gold)] mb-1">Maxis 5G Campus Hackathon</div>
              <div className="text-xs text-gray-500 mb-3">Nov 2025 • Lead Organizer</div>
              <p className="text-sm text-gray-400 leading-relaxed">
                "Led a committee of 10. Managed RM 5k budget. Achieved 120 pax attendance. Coordinated directly with Maxis HR team for mentorship slots."
              </p>
              {/* Skill Tags */}
              <div className="flex gap-2 mt-3">
                <span className="text-[10px] bg-gray-800 px-2 py-1 text-gray-300 border border-gray-700">Leadership</span>
                <span className="text-[10px] bg-gray-800 px-2 py-1 text-gray-300 border border-gray-700">Budgeting</span>
              </div>
            </div>

            {/* Item 2 */}
            <div className="relative">
              <div className="absolute -left-[39px] top-1 w-5 h-5 bg-[var(--bg-void)] border-2 border-gray-600 rounded-full"></div>
              <h4 className="text-lg font-bold text-white">Marketing Volunteer</h4>
              <div className="text-sm text-[var(--text-blue)] mb-1">Grab Sustainability Drive</div>
              <div className="text-xs text-gray-500 mb-3">Aug 2025 • Committee Member</div>
              <p className="text-sm text-gray-400 leading-relaxed">
                "Executed on-ground activation at the Student Union. Distributed 500 flyers and managed the registration booth."
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentProfile;

