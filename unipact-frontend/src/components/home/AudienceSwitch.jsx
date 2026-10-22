import React from 'react';

const SIDES = [
  { key: 'client', label: 'For clients' },
  { key: 'student', label: 'For students' },
];

// "For clients / For students", used by the tour and the FAQ. Both read the same choice, so a reader
// who picks their side once sees it throughout the page. Full width on phones for an easy tap.
const AudienceSwitch = ({ audience, onAudience, label }) => (
  <div role="group" aria-label={label} className="grid grid-cols-2 w-full sm:inline-flex sm:w-auto self-start md:self-auto p-1 rounded-lg bg-white border border-[rgba(10,23,72,0.12)]">
    {SIDES.map(({ key, label: text }) => (
      <button
        key={key}
        type="button"
        onClick={() => onAudience(key)}
        aria-pressed={audience === key}
        className={`px-4 sm:px-5 py-2.5 sm:py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] ${
          audience === key ? 'bg-[#0A1748] text-white' : 'text-[#5B6478] hover:text-[#0A1748]'
        }`}
      >
        {text}
      </button>
    ))}
  </div>
);

export default AudienceSwitch;
