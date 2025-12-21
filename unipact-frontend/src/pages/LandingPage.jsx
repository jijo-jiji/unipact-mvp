import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  GraduationCap,
  LogIn,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';

const LandingPage = () => {
  const [activeTab, setActiveTab] = useState('student');

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-white overflow-x-hidden relative">

      {/* 0. BACKGROUND GRID ANIMATION (Simulated) */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#a020f0]/10 to-transparent pointer-events-none"></div>

      {/* 1. HERO SECTION */}
      <header className="relative pt-32 pb-20 px-6 text-center z-10">
        <div className="inline-block px-4 py-1 mb-6 border border-[#a020f0]/50 rounded-full bg-[#a020f0]/10 text-[#a020f0] text-xs font-bold uppercase tracking-[0.2em] animate-fade-in">
          System Online • v1.0.0
        </div>

        <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight drop-shadow-[0_0_25px_rgba(160,32,240,0.5)]">
          WHERE AMBITION <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a020f0] to-white bg-300% animate-gradient">
            MEETS OPPORTUNITY
          </span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          The ultimate quest board for ambitious students and visionary companies.
          Complete missions, earn rewards, and verify your legacy.
        </p>

        <div className="flex flex-col md:flex-row justify-center gap-4 mb-20">
          <Link to="/register/company" className="group relative px-8 py-4 bg-white text-black font-bold uppercase tracking-wider overflow-hidden">
            <div className="absolute inset-0 w-full h-full bg-[#a020f0] translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative z-10 group-hover:text-white transition-colors flex items-center gap-2">
              <Briefcase size={18} /> Recruit Hunters
            </span>
          </Link>

          <Link to="/register/club" className="group px-8 py-4 border border-white/20 hover:border-[#a020f0] hover:bg-[#a020f0]/10 text-white font-bold uppercase tracking-wider transition-all flex items-center gap-2">
            <GraduationCap size={18} /> Join The Guild
          </Link>
        </div>

        {/* 2. STATS BAR (Floating) */}
        <div className="max-w-4xl mx-auto bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 grid grid-cols-2 md:grid-cols-4 gap-8 rounded-sm shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transform -rotate-1 hover:rotate-0 transition-transform duration-500">
          {[
            { label: 'Active Quests', value: '128', icon: Globe, color: 'text-blue-400' },
            { label: 'Total Loot', value: 'RM 50k+', icon: Zap, color: 'text-yellow-400' },
            { label: 'Hunters Online', value: '2,400', icon: Shield, color: 'text-green-400' },
            { label: 'Success Rate', value: '94%', icon: TrendingUp, color: 'text-[#a020f0]' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <stat.icon className={`mx-auto mb-2 ${stat.color}`} size={20} />
              <div className="text-2xl font-bold font-display">{stat.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* 3. FEATURES SPLIT */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* TEXT */}
          <div>
            <h2 className="text-3xl font-display font-bold mb-6 text-white">
              THE SYSTEM <span className="text-[#a020f0]">REWARDS MERIT</span>
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4 group cursor-pointer p-4 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-[#a020f0]">
                <div className="mt-1"><Shield className="text-[#a020f0]" /></div>
                <div>
                  <h3 className="font-bold text-lg text-white mb-1 group-hover:text-[#a020f0] transition-colors">Verified Reputation</h3>
                  <p className="text-sm text-gray-400">No more empty resumes. Your completed quests become immutable proof of your skills.</p>
                </div>
              </div>

              <div className="flex gap-4 group cursor-pointer p-4 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-[#a020f0]">
                <div className="mt-1"><Zap className="text-yellow-400" /></div>
                <div>
                  <h3 className="font-bold text-lg text-white mb-1 group-hover:text-yellow-400 transition-colors">Instant Rewards</h3>
                  <p className="text-sm text-gray-400">Secure automated payouts upon mission completion. Guaranteed by the System.</p>
                </div>
              </div>

              <div className="flex gap-4 group cursor-pointer p-4 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-[#a020f0]">
                <div className="mt-1"><Briefcase className="text-blue-400" /></div>
                <div>
                  <h3 className="font-bold text-lg text-white mb-1 group-hover:text-blue-400 transition-colors">Elastic Workforce</h3>
                  <p className="text-sm text-gray-400">Companies access Malaysia's top student talent on demand for hackathons, marketing, and dev ops.</p>
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE PREVIEW */}
          <div className="relative">
            <div className="absolute inset-0 bg-[#a020f0] blur-[100px] opacity-20"></div>
            <div className="relative bg-[var(--bg-panel)] border border-[var(--border-tech)] p-1 rounded-lg shadow-2xl skew-y-3 hover:skew-y-0 transition-transform duration-500">
              <div className="bg-black/50 p-6 rounded-lg backdrop-blur-sm">

                {/* MOCK QUEST CARD */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-black border-2 border-[#a020f0]">M</div>
                    <div>
                      <div className="font-bold text-white">Maxis Hackathon 2025</div>
                      <div className="text-xs text-gray-400">Maxis Berhad • Kuala Lumpur</div>
                    </div>
                  </div>
                  <div className="bg-[#a020f0]/20 text-[#a020f0] px-2 py-1 text-[10px] font-bold uppercase rounded-sm border border-[#a020f0]/50">
                    RM 5,000
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="h-2 bg-gray-800 rounded-full w-full"></div>
                  <div className="h-2 bg-gray-800 rounded-full w-3/4"></div>
                </div>

                <div className="flex justify-between items-center text-xs text-gray-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-green-400"><div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div> Live Now</span>
                  <span>24 Applicants</span>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. FOOTER / LOGIN CTA */}
      <footer className="border-t border-[var(--border-tech)] bg-black/50 py-12 text-center">
        <p className="text-gray-500 text-sm mb-4">Already an operative?</p>
        <Link to="/login" className="inline-flex items-center gap-2 text-white hover:text-[#a020f0] font-bold uppercase tracking-widest transition-colors">
          <LogIn size={16} /> Access Terminal
        </Link>

        <div className="mt-12 text-[10px] text-gray-700 uppercase tracking-[0.2em]">
          UniPact Systems © 2025 • Secured by High Council
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;