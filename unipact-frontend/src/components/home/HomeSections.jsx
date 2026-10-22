import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Check, GraduationCap, LayoutDashboard, Plus, ShieldCheck, Wallet } from 'lucide-react';
import ScreenFrame from './ScreenFrame';
import AudienceSwitch from './AudienceSwitch';
import { CLIENT_PROTECTIONS, ESCROW_STEPS, FAQ, STUDENT_PAY, WORKSPACE } from './content';
import { SERVICE_FEE_PERCENT } from '../../utils/constants';
import { MARKETING_SITE } from '../../utils/contacts';

const SectionHead = ({ title, children }) => (
  <div className="max-w-[700px] mb-10 sm:mb-12">
    <h2 className="font-heading font-bold tracking-[-0.5px] text-[clamp(2rem,3.4vw,2.75rem)] text-balance">{title}</h2>
    {children && <p className="text-[#5B6478] text-base sm:text-lg mt-3">{children}</p>}
  </div>
);

export const WorkspaceSection = () => (
  <section id="workspace" className="scroll-mt-[128px] py-16 sm:py-24 bg-white border-y border-[rgba(10,23,72,0.08)]">
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
      <SectionHead title="Everything about a project, on one page">
        The client and the student team work from the same project page, so everyone sees the same milestones, files and
        payments.
      </SectionHead>
      <div className="grid md:grid-cols-3 gap-10 md:gap-8">
        {WORKSPACE.map(({ title, text, image, alt }) => (
          <article key={title}>
            <ScreenFrame src={image} alt={alt} className="shadow-none" />
            <h3 className="font-heading font-bold text-xl mt-6 mb-2">{title}</h3>
            <p className="text-[#5B6478] leading-relaxed">{text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export const PaymentsSection = () => (
  <section id="payments" className="scroll-mt-[128px] py-16 sm:py-24">
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
      <SectionHead title="Money waits until the work is approved">
        Every project is priced up front. Posting is free, and UniPact&apos;s {SERVICE_FEE_PERCENT}% fee comes out of
        the price, never on top.
      </SectionHead>

      {/* A timeline on phones (numbers joined by a line), three panels side by side from tablet width */}
      <ol className="grid md:grid-cols-3 rounded-2xl border border-[rgba(10,23,72,0.12)] bg-white px-5 py-2 md:p-0 md:divide-x divide-[rgba(10,23,72,0.1)]">
        {ESCROW_STEPS.map(({ title, text }, i) => (
          <li key={title} className="relative flex gap-4 py-4 md:p-7">
            {i < ESCROW_STEPS.length - 1 && (
              <span className="md:hidden absolute left-[17px] top-[3.25rem] -bottom-4 w-0.5 bg-[#00AEEF]/40" aria-hidden="true" />
            )}
            <span className="relative w-9 h-9 shrink-0 rounded-full md:rounded-md bg-[#0A1748] text-white font-bold flex items-center justify-center" aria-hidden="true">{i + 1}</span>
            <p className="leading-relaxed pt-1 md:pt-0">
              <span className="block md:inline font-semibold text-[#0A1748]">{title}</span> <span className="text-[#5B6478]">{text}</span>
            </p>
          </li>
        ))}
      </ol>

      <div className="grid md:grid-cols-2 gap-5 md:gap-6 mt-8 sm:mt-10">
        <PointsCard
          icon={ShieldCheck}
          audience="For clients"
          title="What protects you"
          points={CLIENT_PROTECTIONS}
          link={{ to: '/agreements/client', label: 'Read the Client Service Agreement' }}
          dark
        />
        <PointsCard
          icon={Wallet}
          audience="For students"
          title="How you're paid"
          points={STUDENT_PAY}
          link={{ to: '/agreements/talent', label: 'Read the Talent Agreement' }}
        />
      </div>
    </div>
  </section>
);

// One side's promises: a coloured header, four scannable points, and the agreement they come from
const PointsCard = ({ icon, audience, title, points, link, dark = false }) => (
  <article className="flex flex-col rounded-2xl overflow-hidden border border-[rgba(10,23,72,0.12)] bg-white">
    <header className={`flex items-center gap-4 px-5 py-5 sm:px-7 ${dark ? 'bg-[#0B1E63]' : 'bg-[#E4F1F9]'}`}>
      <span className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${dark ? 'bg-white/10 text-[#00AEEF]' : 'bg-[#0B1E63] text-white'}`} aria-hidden="true">
        {React.createElement(icon, { size: 24 })}
      </span>
      <div>
        <p className={`text-xs font-semibold uppercase tracking-[0.1em] ${dark ? 'text-white/70' : 'text-[#00729F]'}`}>{audience}</p>
        <h3 className={`font-heading font-bold text-xl sm:text-2xl ${dark ? 'text-white' : 'text-[#0A1748]'}`}>{title}</h3>
      </div>
    </header>
    <ul className="flex-1 px-5 sm:px-7 divide-y divide-[rgba(10,23,72,0.08)]">
      {points.map((p) => (
        <li key={p.title} className="flex gap-3.5 py-4">
          <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-[#00AEEF]/15 text-[#00729F] flex items-center justify-center" aria-hidden="true">
            <Check size={14} strokeWidth={3} />
          </span>
          <span>
            <span className="block font-semibold text-[#0A1748]">{p.title}</span>
            <span className="block text-sm text-[#5B6478] leading-relaxed mt-0.5">{p.text}</span>
          </span>
        </li>
      ))}
    </ul>
    <Link
      to={link.to}
      className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-[rgba(10,23,72,0.08)] bg-[#F9FAFD] text-sm font-semibold text-[#0B1E63] hover:bg-[#E4F1F9] transition-colors"
    >
      {link.label} <ArrowRight size={16} className="shrink-0 text-[#00729F]" aria-hidden="true" />
    </Link>
  </article>
);

// First half and second half, so the questions read in order down each column (and in one list on phones)
const halves = (items) => {
  const middle = Math.ceil(items.length / 2);
  return [items.slice(0, middle), items.slice(middle)].filter((half) => half.length > 0);
};

// The questions for one side at a time, with the same switch as the tour (and sharing its choice),
// as cards that open in place.
export const HomeFaq = ({ audience, onAudience }) => (
  <section id="faq" className="scroll-mt-[128px] py-16 sm:py-24 bg-white border-y border-[rgba(10,23,72,0.08)]">
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-10">
        <div className="max-w-[640px]">
          <h2 className="font-heading font-bold tracking-[-0.5px] text-[clamp(2rem,3.4vw,2.75rem)] text-balance">Common questions</h2>
          <p className="text-[#5B6478] text-base sm:text-lg mt-3">Straight answers about matching, payments and working together.</p>
        </div>
        <AudienceSwitch audience={audience} onAudience={onAudience} label="Show the questions from" />
      </div>

      {/* Two columns that stack on their own, so an open answer only pushes down the questions under it */}
      <div className="grid md:grid-cols-2 gap-3 items-start">
        {halves(FAQ[audience]).map((column) => (
          <div key={column[0].q} className="flex flex-col gap-3">
            {column.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-[rgba(10,23,72,0.1)] bg-[#F5F7FC] open:bg-white open:border-[#00AEEF]/60 open:shadow-[0_12px_30px_-18px_rgba(10,23,72,0.35)] transition-colors"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 font-semibold text-[#0A1748] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="w-8 h-8 shrink-0 rounded-full bg-white border border-[rgba(10,23,72,0.12)] text-[#0A1748] flex items-center justify-center transition-[transform,background-color] group-open:rotate-45 group-open:bg-[#0A1748] group-open:text-white group-open:border-transparent motion-reduce:transition-none" aria-hidden="true">
                    <Plus size={16} />
                  </span>
                </summary>
                <p className="px-5 pb-5 -mt-1 text-[#5B6478] leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// One way in for each kind of reader: what they get, and the account that gets it
const PathCard = ({ icon, audience, title, text, cta, aside, light = false }) => (
  <article className={`flex flex-col rounded-2xl p-6 sm:p-8 ${light ? 'bg-white text-[#0A1748]' : 'bg-white/[0.06] border border-white/15 text-white'}`}>
    <span className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${light ? 'bg-[#0B1E63] text-[#00AEEF]' : 'bg-[#00AEEF] text-[#0A1748]'}`} aria-hidden="true">
      {React.createElement(icon, { size: 24 })}
    </span>
    <p className={`text-xs font-semibold uppercase tracking-[0.1em] ${light ? 'text-[#00729F]' : 'text-white/70'}`}>{audience}</p>
    <h3 className={`font-heading font-bold text-2xl mt-1 mb-2 ${light ? 'text-[#0A1748]' : 'text-white'}`}>{title}</h3>
    <p className={`leading-relaxed mb-7 ${light ? 'text-[#5B6478]' : 'text-white/75'}`}>{text}</p>
    <Link
      to={cta.to}
      className={`btn w-full mt-auto py-3 text-base ${light ? 'bg-[#0B1E63] text-white hover:bg-[#0A1748]' : 'bg-white text-[#0A1748] hover:bg-[#E4F1F9]'}`}
    >
      {cta.label} <ArrowRight size={17} />
    </Link>
    <p className="text-sm text-center mt-4">{aside}</p>
  </article>
);

export const ClosingCta = ({ dashboardPath }) => {
  if (dashboardPath) {
    return (
      <section className="py-16 sm:py-20 bg-[#0A1748] text-white">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="font-heading font-bold text-white tracking-[-0.02em] text-[clamp(2rem,3.4vw,2.75rem)] mb-2">Pick up where you left off</h2>
            <p className="text-white/80 text-lg">Your projects, messages and payments are on your dashboard.</p>
          </div>
          <Link to={dashboardPath} className="btn shrink-0 px-6 py-3 text-base bg-white text-[#0A1748] hover:bg-[#E4F1F9]">
            <LayoutDashboard size={18} /> Go to your dashboard
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 sm:py-24 bg-[#0A1748] text-white">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
        <div className="max-w-[640px] mb-8 sm:mb-10">
          <h2 className="font-heading font-bold text-white tracking-[-0.02em] text-[clamp(2rem,3.4vw,2.75rem)] mb-3">Start your first project</h2>
          <p className="text-white/80 text-lg">Both accounts are free. Pick the one that fits you.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
          <PathCard
            light
            icon={Briefcase}
            audience="For clients"
            title="Have a project in mind?"
            text="Post it for free. A verified student team is proposed within 48 hours, and you pay only as you approve the work."
            cta={{ to: '/register/company', label: 'Post a project' }}
            aside={(
              <a href={`${MARKETING_SITE}/#contact`} className="font-semibold text-[#0B1E63] underline decoration-[#00AEEF] underline-offset-4 hover:text-[#00729F]">
                Not ready yet? Talk to us first
              </a>
            )}
          />
          <PathCard
            icon={GraduationCap}
            audience="For students"
            title="Are you a university student?"
            text="Join for free, get matched to paid client projects in your field, and build a verified portfolio as you go."
            cta={{ to: '/register/student', label: 'Create a student account' }}
            aside={(
              <Link to="/login" className="font-semibold text-white underline decoration-white/50 underline-offset-4 hover:decoration-white">
                Already have an account? Sign in
              </Link>
            )}
          />
        </div>
      </div>
    </section>
  );
};
