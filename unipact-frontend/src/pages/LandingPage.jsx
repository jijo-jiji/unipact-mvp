import React from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, GraduationCap, ShieldCheck, CheckCircle2, Code2, Megaphone, Users, ArrowRight,
  FolderOpen, BadgeCheck, Wallet, Sparkles, Star, ChevronDown, LayoutDashboard,
} from 'lucide-react';
import PublicNav from '../components/PublicNav';
import SiteFooter from '../components/SiteFooter';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/routes';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#companies', label: 'For companies' },
  { href: '#students', label: 'For students' },
  { href: '#faq', label: 'FAQ' },
];

const STEPS = [
  { title: 'Post your project', text: 'Describe the work, budget, deadline and deliverables. Posting is free.', icon: Briefcase },
  { title: 'We match verified students', text: 'A UniPact admin reviews verified students and proposes the best-fit team.', icon: Sparkles },
  { title: 'Confirm & collaborate', text: 'Confirm the match, share briefs and files, and the team gets to work.', icon: Users },
  { title: 'Approve & rate', text: 'Review the submitted work, rate the team and download a project report.', icon: Star },
];

const FEATURES = [
  { title: 'Curated matching', text: 'No bidding wars or spam. Every team is hand-picked by an admin from verified students.', icon: ShieldCheck },
  { title: 'Student teams', text: 'Matched students can invite classmates as teammates with a clear role and payout share.', icon: Users },
  { title: 'Project files vault', text: 'Share briefs, brand assets and raw footage with your team in one place.', icon: FolderOpen },
  { title: 'Verified portfolios', text: 'Completed, client-rated projects appear automatically on each student’s public portfolio.', icon: BadgeCheck },
  { title: 'Simple pricing', text: 'Free to post. A one-time finder’s fee when you confirm a match, or go Pro to waive it.', icon: Wallet },
  { title: 'Verified accounts', text: 'Companies and students are reviewed by UniPact before they can take part.', icon: CheckCircle2 },
];

const FAQS = [
  {
    q: 'How much does it cost to post a project?',
    a: 'Posting is free. On the Free plan a one-time finder’s fee of RM 150 applies when you confirm a student match. The Pro plan (RM 499/month) waives finder’s fees on every match. The project budget you set goes to the student team.',
  },
  {
    q: 'How are students verified?',
    a: 'Students register with their university details and can upload a student ID or enrolment letter. A UniPact admin checks their status before they become eligible for matches.',
  },
  {
    q: 'Can I choose the students myself?',
    a: 'A UniPact admin picks the team based on skills and track record, and each student confirms they can take it on. You then review the team and their portfolios before confirming, so nothing starts without your approval.',
  },
  {
    q: 'Can students work in teams?',
    a: 'Yes. A matched student can invite other registered students to join the project with a defined role and payout share.',
  },
  {
    q: 'I run a student club. Can we join?',
    a: 'Club sponsorships are being rolled out gradually. For now, club members can register individually as student talent and list their club on their profile.',
  },
];

const SectionHeading = ({ eyebrow, title, text, center = true }) => (
  <div className={`${center ? 'text-center mx-auto' : ''} max-w-[700px] mb-12`}>
    <p className={`eyebrow mb-3 ${center ? 'justify-center' : ''}`}><span className="eyebrow-dot" /> {eyebrow}</p>
    <h2 className="font-heading font-bold tracking-[-0.5px] text-[clamp(2rem,3.4vw,2.75rem)]">{title}</h2>
    {text && <p className="text-[#5B6478] mt-3 text-base sm:text-lg">{text}</p>}
  </div>
);

const RuleLine = () => (
  <div className="max-w-[1160px] mx-auto px-4 sm:px-8" aria-hidden="true">
    <div className="h-px bg-gradient-to-r from-transparent via-[#00AEEF]/60 to-transparent" />
  </div>
);

// Illustrative preview of a real project card from the client workspace
const HeroPreview = () => (
  <div className="relative" aria-hidden="true">
    <div className="absolute -inset-6 bg-[#00AEEF]/10 rounded-[2rem] blur-2xl" />
    <div className="relative card p-6 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="badge bg-[#00AEEF]/10 border-transparent text-[#0090C6]">Software Development</span>
        <span className="badge bg-[#E6F7FD] text-[#0090C6] border-[#00AEEF]/30">In progress</span>
      </div>
      <h3 className="font-heading font-bold text-lg">ESG Compliance Portal MVP</h3>
      <p className="text-sm text-[#5B6478] mb-4">Budget RM 4,500 · Due 30 Oct</p>
      <ol className="flex items-center gap-2 mb-5">
        {['Posted', 'Matched', 'In progress', 'Done'].map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 2 ? 'bg-emerald-500 text-white' : i === 2 ? 'bg-[#00AEEF] text-white' : 'bg-[#F5F7FC] text-[#5B6478] border border-[rgba(10,23,72,0.15)]'}`}>
              {i < 2 ? <CheckCircle2 size={12} /> : i + 1}
            </span>
            {i < 3 && <span className="h-px flex-1 bg-[rgba(10,23,72,0.15)]" />}
          </li>
        ))}
      </ol>
      <div className="text-xs font-semibold text-[#5B6478] uppercase tracking-wider mb-2">Student team</div>
      <div className="space-y-2">
        {[['Ahmad Zaki', 'Universiti Malaya · Full-stack', '4.9'], ['Farhan Daniel', 'Sunway University · UI/UX', '5.0']].map(([name, meta, rating]) => (
          <div key={name} className="flex items-center gap-3 bg-[#F5F7FC] rounded-lg p-2.5">
            <span className="w-8 h-8 rounded-full bg-[#0B1E63] text-[#00AEEF] font-bold text-sm flex items-center justify-center">{name[0]}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold truncate">{name}</span>
              <span className="block text-xs text-[#5B6478] truncate">{meta}</span>
            </span>
            <span className="text-xs font-semibold text-amber-600 inline-flex items-center gap-0.5"><Star size={12} className="fill-amber-400 text-amber-400" /> {rating}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
        <CheckCircle2 size={16} /> New deliverable submitted: staging URL
      </div>
    </div>
  </div>
);

const LandingPage = () => {
  const { user } = useAuth();
  const dashboardPath = user ? homePathForRole(user.role) : null;

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <PublicNav links={NAV_LINKS} />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute -top-24 right-0 w-[520px] h-[520px] bg-[#00AEEF]/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8 pt-14 pb-20 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div className="text-center lg:text-left animate-fade-in">
              <p className="eyebrow mb-5 justify-center lg:justify-start"><span className="eyebrow-dot" /> Malaysia&apos;s curated university talent marketplace</p>
              <h1 className="font-heading font-extrabold tracking-tight text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.1] mb-6">
                Get real projects done by <span className="text-[#00AEEF]">verified university students</span>
              </h1>
              <p className="text-[#5B6478] text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                Post a software development or digital marketing project for free. We hand-pick a team of verified students,
                you confirm the match, and track the work from brief to approved deliverable.
              </p>

              {user ? (
                <div className="flex justify-center lg:justify-start">
                  <Link to={dashboardPath} className="btn-primary px-7 py-3.5 text-base">
                    <LayoutDashboard size={18} /> Go to your dashboard
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                  <Link to="/register/company" className="btn-navy w-full sm:w-auto px-7 py-3.5 text-base">
                    <Briefcase size={18} /> Post a project
                  </Link>
                  <Link to="/register/student" className="btn-secondary w-full sm:w-auto px-7 py-3.5 text-base">
                    <GraduationCap size={18} className="text-[#00AEEF]" /> Join as a student
                  </Link>
                </div>
              )}

              <ul className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-[#5B6478]">
                {['Free to post', 'Verified students only', 'You approve every match'].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#00AEEF]" /> {t}</li>
                ))}
              </ul>
            </div>

            <div className="max-w-md w-full mx-auto lg:max-w-none">
              <HeroPreview />
            </div>
          </div>
        </section>

        <RuleLine />

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-24">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="How it works" title="From brief to finished work in four steps" />
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {STEPS.map(({ title, text, icon }, i) => (
                <li key={title} className="card p-6 relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-11 h-11 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center">{React.createElement(icon, { size: 22 })}</span>
                    <span className="font-heading font-extrabold text-3xl text-[#0A1748]/10">0{i + 1}</span>
                  </div>
                  <h3 className="font-heading font-bold text-lg mb-1.5">{title}</h3>
                  <p className="text-[#5B6478] text-sm leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* AUDIENCES */}
        <section className="bg-white border-y border-[rgba(10,23,72,0.08)] py-20 sm:py-24">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article id="companies" className="scroll-mt-24 rounded-xl p-8 sm:p-10 bg-[#0B1E63] text-white flex flex-col">
              <p className="eyebrow mb-3"><span className="eyebrow-dot" /> For companies & SMEs</p>
              <h2 className="font-heading font-bold text-3xl text-white mb-3">Fresh talent without the hiring overhead</h2>
              <p className="text-white/75 mb-6">Get a curated student team for websites, internal systems or social campaigns, and only pay a finder&apos;s fee when you confirm the match.</p>
              <ul className="space-y-3 mb-8">
                {['Post projects for free, as many as you need', 'Review the proposed team and their portfolios', 'Share briefs and raw assets in a secure files vault', 'Approve work, rate the team and download a report'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5"><CheckCircle2 size={18} className="text-[#00AEEF] shrink-0 mt-0.5" /> <span className="text-white/90">{t}</span></li>
                ))}
              </ul>
              <Link to={user ? dashboardPath : '/register/company'} className="btn-primary self-start mt-auto px-6 py-3">
                {user ? 'Go to dashboard' : 'Create a client account'} <ArrowRight size={16} />
              </Link>
            </article>

            <article id="students" className="scroll-mt-24 rounded-xl p-8 sm:p-10 bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] flex flex-col">
              <p className="eyebrow mb-3"><span className="eyebrow-dot" /> For university students</p>
              <h2 className="font-heading font-bold text-3xl mb-3">Paid, real-world experience that counts</h2>
              <p className="text-[#5B6478] mb-6">Work on genuine client projects in your field and build a verified portfolio employers can trust.</p>
              <ul className="space-y-3 mb-8">
                {['Get matched to paid projects that fit your skills', 'Bring classmates onto your team with a fair payout share', 'Earn client ratings on every completed project', 'Share a public portfolio link on your CV or LinkedIn'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5"><CheckCircle2 size={18} className="text-[#00AEEF] shrink-0 mt-0.5" /> {t}</li>
                ))}
              </ul>
              <Link to={user ? dashboardPath : '/register/student'} className="btn-navy self-start mt-auto px-6 py-3">
                {user ? 'Go to dashboard' : 'Create a student account'} <ArrowRight size={16} />
              </Link>
            </article>
          </div>
        </section>

        {/* TRACKS */}
        <section className="py-20 sm:py-24">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="Two specialisations" title="Built for the work companies need most" text="Every project follows a structure tailored to its field, so everyone knows what will be delivered." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  icon: Code2, name: 'Software development', tone: 'bg-[#0B1E63]',
                  text: 'Websites, landing pages, CRM, ERP, HR systems and automation tools.',
                  items: ['Tech stack and required skills set per project', 'Code repository and staging URL deliverables', 'Handover documentation checklist'],
                },
                {
                  icon: Megaphone, name: 'Digital marketing', tone: 'bg-[#00AEEF]',
                  text: 'TikTok, Instagram Reels and YouTube Shorts campaigns, copywriting and content.',
                  items: ['Campaign objective and target platforms', 'Raw footage and brand assets in the files vault', 'Edited videos and performance summary deliverables'],
                },
              ].map(({ icon, name, tone, text, items }) => (
                <article key={name} className="card p-8 hover:border-[#00AEEF] transition-colors">
                  <span className={`w-12 h-12 rounded-lg ${tone} text-white flex items-center justify-center mb-5`}>{React.createElement(icon, { size: 24 })}</span>
                  <h3 className="font-heading font-bold text-2xl mb-2">{name}</h3>
                  <p className="text-[#5B6478] mb-5">{text}</p>
                  <ul className="space-y-2.5">
                    {items.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm"><CheckCircle2 size={16} className="text-[#00AEEF] shrink-0 mt-0.5" /> {t}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <RuleLine />

        {/* FEATURES */}
        <section className="py-20 sm:py-24">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="Why UniPact" title="Everything you need to run a student project" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ title, text, icon }) => (
                <div key={title} className="card p-6">
                  <span className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center mb-4">{React.createElement(icon, { size: 20 })}</span>
                  <h3 className="font-heading font-bold text-lg mb-1">{title}</h3>
                  <p className="text-[#5B6478] text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 bg-white border-y border-[rgba(10,23,72,0.08)] py-20 sm:py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="FAQ" title="Common questions" />
            <div className="space-y-3">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group card p-0 open:border-[#00AEEF]/50">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown size={18} className="text-[#5B6478] shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 -mt-1 text-[#5B6478] leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 sm:py-24">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
            <div className="rounded-2xl bg-[#0B1E63] px-6 py-14 sm:px-12 text-center relative overflow-hidden">
              <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-[#00AEEF]/20 rounded-full blur-3xl" aria-hidden="true" />
              <h2 className="relative font-heading font-extrabold text-3xl sm:text-4xl text-white mb-3">Ready to get started?</h2>
              <p className="relative text-white/75 max-w-xl mx-auto mb-8">Create a free account in a couple of minutes. No card needed to post your first project.</p>
              <div className="relative flex flex-col sm:flex-row justify-center gap-3">
                {user ? (
                  <Link to={dashboardPath} className="btn-primary px-7 py-3.5"><LayoutDashboard size={17} /> Go to dashboard</Link>
                ) : (
                  <>
                    <Link to="/register/company" className="btn-primary px-7 py-3.5"><Briefcase size={17} /> Post a project</Link>
                    <Link to="/register/student" className="btn px-7 py-3.5 border border-white/25 text-white hover:bg-white/10"><GraduationCap size={17} /> Join as a student</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default LandingPage;
