import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, GraduationCap, ArrowRight, Sparkles, Info } from 'lucide-react';

const RegisterSplit = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-4xl relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-xs uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Malaysia Premier University Talent Marketplace
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-wide mb-3">
            Choose Your Gateway
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
            Connecting corporate clients with individually vetted university talent in Software Development and Digital Marketing.
          </p>
        </div>

        {/* Bifurcated Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* For Companies */}
          <div 
            onClick={() => navigate('/register/company')}
            className="group cursor-pointer bg-[var(--bg-panel)] border border-[var(--border-tech)] hover:border-yellow-400 p-8 relative transition-all duration-300 hover:shadow-[0_0_25px_rgba(250,204,21,0.15)] flex flex-col justify-between"
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-yellow-400/60 group-hover:border-yellow-400"></div>
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-yellow-400/60 group-hover:border-yellow-400"></div>

            <div>
              <div className="w-14 h-14 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 mb-6 group-hover:scale-110 transition-transform">
                <Briefcase className="w-7 h-7" />
              </div>
              <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">For Enterprise & SMEs</span>
              <h2 className="text-2xl font-bold text-white mt-1 mb-3 group-hover:text-yellow-400 transition-colors">
                Company / Client
              </h2>
              <ul className="space-y-2.5 text-sm text-slate-300 mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                  Post Software Dev & Digital Marketing Projects
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                  Curated matching with verified university talent
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                  Free to join & post — pay Finder's Fee on match
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                  Secure Client Asset Repository & video uploads
                </li>
              </ul>
            </div>

            <button className="w-full py-3 px-4 rounded bg-yellow-400/10 hover:bg-yellow-400 text-yellow-400 hover:text-black font-semibold border border-yellow-400 flex items-center justify-center gap-2 transition-colors">
              Register as Company <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* For Students */}
          <div 
            onClick={() => navigate('/register/student')}
            className="group cursor-pointer bg-[var(--bg-panel)] border border-[var(--border-tech)] hover:border-cyan-400 p-8 relative transition-all duration-300 hover:shadow-[0_0_25px_rgba(56,189,248,0.15)] flex flex-col justify-between"
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400/60 group-hover:border-cyan-400"></div>
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400/60 group-hover:border-cyan-400"></div>

            <div>
              <div className="w-14 h-14 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-7 h-7" />
              </div>
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">For University Students</span>
              <h2 className="text-2xl font-bold text-white mt-1 mb-3 group-hover:text-cyan-400 transition-colors">
                Student Talent
              </h2>
              <ul className="space-y-2.5 text-sm text-slate-300 mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Work on paid real-world company contracts
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Build an immutable public verifiable portfolio
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Direct individual verification via academic ID/email
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Keep your account active post-graduation
                </li>
              </ul>
            </div>

            <button className="w-full py-3 px-4 rounded bg-cyan-400/10 hover:bg-cyan-400 text-cyan-400 hover:text-black font-semibold border border-cyan-400 flex items-center justify-center gap-2 transition-colors">
              Register as Student <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Institutional club note & Login option */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded bg-slate-900/60 border border-slate-700/60 text-xs text-slate-400 max-w-xl mx-auto text-left">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              <strong>Note on Student Clubs:</strong> Full institutional guild sponsorship is currently undergoing university administrative review. Direct individual student registration is active.
            </span>
          </div>

          <div className="text-sm text-slate-400">
            Already have an account?{' '}
            <button 
              onClick={() => navigate('/login')}
              className="text-yellow-400 hover:underline font-semibold"
            >
              Log In Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSplit;
