import React from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, Flag, Info, Paperclip, Send } from 'lucide-react';
import mark from '../../assets/unipact-mark.png';

// What's on the screens and cards in the front page's hero picture. The picture itself is rendered in
// Blender (see hero-render/README.md); these are its textures, laid out flat on /dev/hero-textures (in
// development only) and captured at high resolution, so the render's text comes out crisp. They copy
// the real pages' styles (colours, badges, progress steps, stat cards) with the same demo project as the
// tour's screenshots, at a size that reads in the hero. If the client's project page
// (pages/ManageCampaign.jsx) or the student's (pages/StudentProject.jsx) changes, update these and
// re-render.

const STEPS = [
  { label: 'Posted', done: true },
  { label: 'Matched', done: true },
  { label: 'In progress', active: true },
  { label: 'Completed' },
];

const Steps = ({ compact = false }) => (
  <ol className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
    {STEPS.map((step, i) => (
      <li key={step.label} className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
        <span
          className={`rounded-full flex items-center justify-center font-bold border ${compact ? 'w-3.5 h-3.5 text-[7px]' : 'w-[18px] h-[18px] text-[9px]'} ${
            step.done ? 'bg-emerald-500 border-emerald-500 text-white' : step.active ? 'bg-[#00AEEF] border-[#00AEEF] text-[#0A1748]' : 'bg-white border-[rgba(10,23,72,0.2)] text-[#5B6478]'
          }`}
        >
          {step.done ? <CheckCircle2 size={compact ? 8 : 11} /> : i + 1}
        </span>
        {!compact && (
          <span className={`text-[10px] ${step.active ? 'font-semibold text-[#0A1748]' : 'text-[#5B6478]'}`}>
            {step.label}
            {(step.done || step.active) && <ChevronDown size={9} className="inline ml-0.5 -mt-px text-[#5B6478]" />}
          </span>
        )}
        {i < STEPS.length - 1 && <span className={`h-px bg-[rgba(10,23,72,0.2)] ${compact ? 'w-2.5' : 'w-6'}`} />}
      </li>
    ))}
  </ol>
);

const Badge = ({ children, tone = 'type' }) => (
  <span
    className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${
      tone === 'type' ? 'bg-[#00AEEF]/10 border-transparent text-[#00729F]' : 'bg-[#E6F7FD] border-[#00AEEF]/30 text-[#00729F]'
    }`}
  >
    {children}
  </span>
);

// The browser's own bar above the client's page
export const BrowserBar = () => (
  <div className="h-8 flex items-center gap-1.5 px-3 border-b border-[rgba(10,23,72,0.08)] bg-[#FBFCFE]">
    <span className="w-2 h-2 rounded-full bg-[rgba(10,23,72,0.15)]" />
    <span className="w-2 h-2 rounded-full bg-[rgba(10,23,72,0.15)]" />
    <span className="w-2 h-2 rounded-full bg-[rgba(10,23,72,0.15)]" />
    <span className="ml-3 h-5 px-3 rounded bg-[#F0F3F9] text-[10px] leading-5 text-[#5B6478]">app.unipact.my</span>
  </div>
);

// The two moments floating in front of the screens
export const ApprovedCard = () => (
  <>
    <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 size={18} /></span>
    <span className="text-left">
      <span className="block text-sm font-semibold text-[#0A1748]">Milestone 2 approved</span>
      <span className="block text-xs text-[#5B6478]">RM 1,890 released to your team</span>
    </span>
  </>
);

export const MessageCard = () => (
  <>
    <span className="w-7 h-7 rounded-full bg-[#0B1E63] text-[#00AEEF] text-xs font-bold flex items-center justify-center shrink-0">A</span>
    <span className="text-left">
      <span className="block text-xs font-semibold text-[#0A1748]">Adam Haikal <span className="font-normal text-[#5B6478]">· Student</span></span>
      <span className="block text-xs text-[#0A1748] mt-0.5 leading-snug">Will do, it’ll be full width on phones.</span>
    </span>
  </>
);

// The client's project page: top bar, project header with its progress, the review banner and the totals
export const DesktopScreen = () => (
  <div className="bg-[#F5F7FC] text-[#0A1748] font-body">
    <div className="h-11 px-4 flex items-center gap-3 border-b border-[rgba(10,23,72,0.06)]">
      <img src={mark} alt="" className="h-6 w-auto" />
      <span className="leading-none">
        <span className="block font-heading font-extrabold text-[11px] tracking-[0.08em]">UNIPACT</span>
        <span className="block mt-0.5 text-[6.5px] font-semibold tracking-[0.12em] text-[#00729F]">CLIENT WORKSPACE</span>
      </span>
      <span className="ml-auto flex items-center gap-0.5 rounded-full bg-[rgba(10,23,72,0.05)] p-0.5 text-[9.5px] text-[#5B6478]">
        <span className="px-2.5 py-1 rounded-full bg-white text-[#0A1748] font-medium shadow-sm">Projects</span>
        <span className="px-2.5 py-1">Post a project</span>
        <span className="px-2.5 py-1">Billing</span>
      </span>
      <span className="ml-3 w-6 h-6 rounded-full bg-[#0B1E63] text-white text-[10px] font-bold flex items-center justify-center">A</span>
    </div>

    <div className="p-4 space-y-2.5">
      <div className="rounded-xl bg-white border border-[rgba(10,23,72,0.1)] px-4 py-3.5">
        <div className="flex gap-1.5 text-[8.5px] [&>span]:px-2 [&>span]:py-0.5">
          <Badge>Software Development</Badge>
          <Badge tone="status">In progress</Badge>
        </div>
        <p className="font-heading font-bold text-[21px] leading-tight mt-1.5">Patient booking portal</p>
        <p className="text-[10px] text-[#5B6478] mt-0.5">
          Budget <strong className="text-[#0A1748]">RM 6,000</strong> · Due 28 Nov 2026 · Posted 24 Sept 2026
        </p>
        <div className="h-px bg-[rgba(10,23,72,0.08)] my-3" />
        <Steps />
      </div>

      <div className="rounded-xl bg-white border border-[rgba(10,23,72,0.1)] px-3.5 py-2.5 flex items-center gap-2.5">
        <Info size={13} className="text-[#00AEEF] shrink-0" />
        <span className="text-[10.5px] flex-1">A milestone is waiting for your approval.</span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#00AEEF] text-[#0A1748] font-semibold text-[10px] px-3 py-1.5">
          <Flag size={11} /> Review milestone
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          ['Project fee', 'RM 6,000', 'Paid in full', 'text-[#0A1748]'],
          ['Paid to your team', 'RM 2,160', 'of their RM 5,400 share', 'text-emerald-600'],
          ['Milestones approved', '1 of 3', '1 waiting for review', 'text-[#00729F]'],
        ].map(([label, value, note, tone]) => (
          <div key={label} className="rounded-xl bg-white border border-[rgba(10,23,72,0.1)] px-3 py-2.5">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#5B6478]">{label}</p>
            <p className={`font-heading font-bold text-[18px] leading-tight mt-0.5 ${tone}`}>{value}</p>
            <p className="text-[8px] text-[#5B6478] mt-0.5">{note}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// The student's phone shows something the window doesn't, the way Microsoft's phone shows the inbox:
// the project's conversation. The client has just asked a question; the floating card beside it is
// the student's reply arriving. Styles follow components/ProjectMessages.jsx.
const Bubble = ({ mine = false, name, role, children, time }) => (
  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
    <div className="max-w-[86%]">
      {!mine && (
        <div className="flex items-center gap-1 mb-0.5 text-[7px]">
          <span className="font-semibold">{name}</span>
          <span className="px-1 rounded-full text-[6px] font-semibold bg-[#00AEEF]/10 text-[#00729F]">{role}</span>
        </div>
      )}
      <div
        className={`rounded-xl px-2 py-1.5 text-[8px] leading-snug ${
          mine ? 'bg-[#0B1E63] text-white rounded-br-sm' : 'bg-white text-[#0A1748] border border-[rgba(10,23,72,0.08)] rounded-bl-sm'
        }`}
      >
        {children}
      </div>
      <div className={`text-[6.5px] text-[#5B6478] mt-0.5 ${mine ? 'text-right' : ''}`}>{time}</div>
    </div>
  </div>
);

export const PhoneScreen = () => (
  <div className="h-full flex flex-col bg-[#F5F7FC] text-[#0A1748] font-body">
    <div className="h-5 shrink-0 px-4 flex items-center justify-between text-[8px] font-semibold">
      <span>9:41</span>
      <span className="w-3.5 h-1.5 rounded-sm border border-[#0A1748]/60" />
    </div>

    <div className="shrink-0 px-2.5 pb-1.5 bg-white border-b border-[rgba(10,23,72,0.08)]">
      <div className="flex items-center gap-1.5 pt-1">
        <ChevronLeft size={12} className="-ml-0.5 text-[#5B6478]" />
        <div className="min-w-0">
          <p className="font-heading font-bold text-[10.5px] leading-tight truncate">Patient booking portal</p>
          <p className="text-[6.5px] text-[#5B6478]">Arunika Dental · your team · UniPact</p>
        </div>
      </div>
      <div className="flex gap-3 mt-1.5 text-[7px] text-[#5B6478]">
        <span>Overview</span>
        <span>Work</span>
        <span className="font-semibold text-[#0A1748] border-b-[1.5px] border-[#00AEEF] pb-0.5">Messages</span>
        <span>Team</span>
      </div>
    </div>

    <div className="flex-1 px-2.5 pt-2 space-y-2 overflow-hidden">
      <div className="flex items-center gap-1.5 text-[6.5px] text-[#5B6478]">
        <span className="flex-1 h-px bg-[rgba(10,23,72,0.1)]" /> Today <span className="flex-1 h-px bg-[rgba(10,23,72,0.1)]" />
      </div>
      <Bubble name="Farah" role="Client" time="10:02 am">
        Can patients pick their branch first? We have three.
      </Bubble>
      <Bubble mine time="You · 10:31 am">
        Yes, here&apos;s the new flow:
        <span className="mt-1 flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-1">
          <Paperclip size={8} className="shrink-0" />
          <span className="font-semibold">booking-flow-v2.png</span>
        </span>
      </Bubble>
      <Bubble name="Farah" role="Client" time="5:12 pm">
        Looks good! Could the confirm button be bigger on phones?
      </Bubble>
    </div>

    <div className="shrink-0 m-2 flex items-center gap-1.5 rounded-lg bg-white border border-[rgba(10,23,72,0.12)] pl-2 pr-1 py-1">
      <Paperclip size={9} className="text-[#5B6478] shrink-0" />
      <span className="flex-1 text-[7.5px] text-[#5B6478]">Write a message…</span>
      <span className="flex items-center gap-1 rounded-md bg-[#00AEEF] px-1.5 py-1 text-[7px] font-semibold text-[#0A1748]">
        <Send size={8} /> Send
      </span>
    </div>
  </div>
);
