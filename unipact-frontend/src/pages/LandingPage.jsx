import React from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  GraduationCap,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Share2,
  Users,
  Layers,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Shield,
  FileCheck
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col selection:bg-[#00AEEF] selection:text-white">

      {/* 1. STICKY BLUR NAVBAR (76px per STYLE_GUIDE.md) */}
      <nav className="sticky top-0 z-50 h-[76px] bg-[#F5F7FC]/90 backdrop-blur-md border-b border-[rgba(10,23,72,0.08)] flex items-center px-6 lg:px-12 transition-all">
        <div className="max-w-[1160px] w-full mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-lg bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center font-heading font-extrabold text-xl shadow-sm group-hover:scale-105 transition-transform">
              UP
            </div>
            <div>
              <span className="font-heading font-extrabold text-xl text-[#0A1748] tracking-tight block leading-none">
                Uni<span className="text-[#00AEEF]">Pact</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-[#5B6478] uppercase">
                Talent Marketplace
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#5B6478]">
            <a href="#specializations" className="hover:text-[#0B1E63] transition-colors">Specializations</a>
            <a href="#how-it-works" className="hover:text-[#0B1E63] transition-colors">How It Works</a>
            <a href="#collaboration" className="hover:text-[#0B1E63] transition-colors">Squad Collaboration</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-md text-xs font-semibold text-[#0A1748] hover:text-[#00AEEF] transition-colors flex items-center gap-1.5"
            >
              <LogIn size={15} /> Sign In
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white text-xs font-bold uppercase tracking-wider shadow-sm hover:shadow transition-all flex items-center gap-1.5"
            >
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative pt-16 pb-20 px-6 overflow-hidden">
        {/* Subtle background graphic */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-100/40 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        <div className="absolute top-20 left-1/3 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="max-w-[1160px] mx-auto text-center">
          {/* Eyebrow Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00AEEF]/10 border border-[#00AEEF]/30 text-[#0090C6] text-xs font-bold uppercase tracking-widest mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-[#00AEEF] animate-pulse"></span>
            UniPact v3.0 • Curated Higher-Ed Marketplace
          </div>

          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl md:text-6xl text-[#0A1748] tracking-tight leading-[1.15] max-w-4xl mx-auto mb-6">
            Curated University Talent for <span className="text-[#00AEEF]">High-Impact</span> Enterprise Projects.
          </h1>

          <p className="text-[#5B6478] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
            Connect corporate job orders directly with verified university students in <strong>Software Development</strong> & <strong>Digital Marketing</strong>. Featuring admin-curated matching, peer squad collaboration, and milestone-protected escrow.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/register/company"
              className="w-full sm:w-auto px-7 py-3.5 rounded-md bg-[#0B1E63] hover:bg-[#0A1748] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Briefcase size={17} /> Post a Project Order
            </Link>
            <Link
              to="/register/student"
              className="w-full sm:w-auto px-7 py-3.5 rounded-md bg-white hover:bg-slate-50 border border-[rgba(10,23,72,0.15)] text-[#0A1748] font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <GraduationCap size={18} className="text-[#00AEEF]" /> Join as Student Talent
            </Link>
          </div>

          {/* 3. VALUE PILLARS STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-5 rounded-lg shadow-sm hover:border-[#00AEEF] transition-all">
              <div className="w-10 h-10 rounded-md bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center mb-3">
                <ShieldCheck size={22} />
              </div>
              <h3 className="font-heading font-bold text-[#0A1748] text-base mb-1">100% Curated Matching</h3>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                Zero spam and bidding wars. UniPact Admin matches verified students based on verified academic credentials.
              </p>
            </div>

            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-5 rounded-lg shadow-sm hover:border-[#00AEEF] transition-all">
              <div className="w-10 h-10 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center mb-3">
                <Code2 size={22} />
              </div>
              <h3 className="font-heading font-bold text-[#0A1748] text-base mb-1">Dual Specializations</h3>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                Tailored workflows for Full-Stack / Mobile software projects and multi-channel Digital Marketing campaigns.
              </p>
            </div>

            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-5 rounded-lg shadow-sm hover:border-[#00AEEF] transition-all">
              <div className="w-10 h-10 rounded-md bg-cyan-500/10 text-[#0090C6] flex items-center justify-center mb-3">
                <Users size={22} />
              </div>
              <h3 className="font-heading font-bold text-[#0A1748] text-base mb-1">Peer Squad Collaboration</h3>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                Assigned students can invite verified peers to form multi-disciplinary squads with transparent payout cuts.
              </p>
            </div>

            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-5 rounded-lg shadow-sm hover:border-[#00AEEF] transition-all">
              <div className="w-10 h-10 rounded-md bg-green-500/10 text-green-600 flex items-center justify-center mb-3">
                <FileCheck size={22} />
              </div>
              <h3 className="font-heading font-bold text-[#0A1748] text-base mb-1">Verifiable Portfolio</h3>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                Completed client work automatically generates permanent, verified showcase items on each student\'s portfolio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TRACK FOCUS SECTION */}
      <section id="specializations" className="py-16 px-6 bg-white border-y border-[rgba(10,23,72,0.08)]">
        <div className="max-w-[1160px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#00AEEF] block mb-2">
              Domain Tracks
            </span>
            <h2 className="font-heading font-bold text-3xl text-[#0A1748] tracking-tight">
              Purpose-Built for Two High-Demand Fields
            </h2>
            <p className="text-[#5B6478] text-sm mt-2">
              UniPact streamlines project scoping, milestones, and deliverables tailored specifically to your project requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Track 1: Software Development */}
            <div className="border border-[rgba(10,23,72,0.12)] rounded-xl p-8 bg-[#F5F7FC]/50 hover:bg-[#F5F7FC] transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-[#0B1E63] text-white flex items-center justify-center">
                  <Code2 size={24} />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#00AEEF]/10 text-[#0090C6]">
                  Engineering Track
                </span>
              </div>
              <h3 className="font-heading font-bold text-xl text-[#0A1748] mb-2">
                Software Development Projects
              </h3>
              <p className="text-[#5B6478] text-xs leading-relaxed mb-6">
                Web applications, mobile apps, API integrations, and MVPs. Scaffolded with staging URLs, GitHub repository handoffs, and unit test requirements.
              </p>
              <ul className="space-y-2 text-xs text-[#0A1748] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00AEEF] shrink-0" /> Full-Stack (React, Django, Node.js, FastAPI)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00AEEF] shrink-0" /> Mobile Development (Flutter, React Native)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00AEEF] shrink-0" /> Verified Git Code Repository Deliverables
                </li>
              </ul>
            </div>

            {/* Track 2: Digital Marketing */}
            <div className="border border-[rgba(10,23,72,0.12)] rounded-xl p-8 bg-[#F5F7FC]/50 hover:bg-[#F5F7FC] transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-[#00AEEF] text-white flex items-center justify-center">
                  <Share2 size={24} />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-700">
                  Growth Track
                </span>
              </div>
              <h3 className="font-heading font-bold text-xl text-[#0A1748] mb-2">
                Digital Marketing & Content
              </h3>
              <p className="text-[#5B6478] text-xs leading-relaxed mb-6">
                TikTok campaigns, Instagram Reels, performance copywriting, and SEO. Includes central raw asset storage and up to 2 structured revision cycles.
              </p>
              <ul className="space-y-2 text-xs text-[#0A1748] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00AEEF] shrink-0" /> Social Media Creative & Short-Form Video
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00AEEF] shrink-0" /> Centralized Raw Material Asset Bank
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00AEEF] shrink-0" /> Structured 2-Round Revision Governance
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. WORKFLOW SECTION */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-[1160px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#00AEEF] block mb-2">
              Structured Process
            </span>
            <h2 className="font-heading font-bold text-3xl text-[#0A1748] tracking-tight">
              How Projects Move from Order to Completion
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-lg relative shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#0B1E63] text-white text-sm font-bold flex items-center justify-center mb-4">
                1
              </div>
              <h4 className="font-heading font-bold text-[#0A1748] text-base mb-1">Submit Job Order</h4>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                Clients post project details, milestone deadlines, budgets, and required skills or brand guidelines.
              </p>
            </div>

            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-lg relative shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#00AEEF] text-white text-sm font-bold flex items-center justify-center mb-4">
                2
              </div>
              <h4 className="font-heading font-bold text-[#0A1748] text-base mb-1">Admin Curation</h4>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                UniPact Admin matches verified student talent based on skill fit and past verified ratings.
              </p>
            </div>

            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-lg relative shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#0A1748] text-white text-sm font-bold flex items-center justify-center mb-4">
                3
              </div>
              <h4 className="font-heading font-bold text-[#0A1748] text-base mb-1">Squad Execution</h4>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                Assigned students collaborate in real-time, invite peers if needed, and submit milestone deliverables.
              </p>
            </div>

            <div className="bg-white border border-[rgba(10,23,72,0.12)] p-6 rounded-lg relative shadow-sm">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center mb-4">
                4
              </div>
              <h4 className="font-heading font-bold text-[#0A1748] text-base mb-1">Review & Portfolio</h4>
              <p className="text-[#5B6478] text-xs leading-relaxed">
                Clients approve final assets and rate performance. Students earn verified portfolio entries and payouts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION SECTION */}
      <section className="py-16 px-6 bg-[#0B1E63] text-white relative overflow-hidden">
        <div className="max-w-[1160px] mx-auto text-center relative z-10">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-4">
            Ready to Accelerate Your Project with Verified University Talent?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Create an enterprise client account today or register as student talent to start matching on live campaigns.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/register/company"
              className="px-8 py-3.5 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md"
            >
              Post Project Now
            </Link>
            <Link
              to="/register/student"
              className="px-8 py-3.5 rounded-md border border-white/20 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Apply as Student Talent
            </Link>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="mt-auto border-t border-[rgba(10,23,72,0.08)] bg-white py-10 px-6">
        <div className="max-w-[1160px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5B6478]">
          <div className="flex items-center gap-2 font-heading font-bold text-[#0A1748]">
            <span className="text-[#00AEEF]">UniPact</span> Enterprise Talent Marketplace
          </div>
          <div>
            Built with strict adherence to <Link to="/login" className="text-[#00AEEF] hover:underline">UniPact Style Guide</Link> • SRS v3.0 Active
          </div>
          <div className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} UniPact. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
