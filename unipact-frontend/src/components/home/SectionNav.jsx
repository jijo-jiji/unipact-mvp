import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// The page's own menu, under the opening section. From tablet width up it sticks under the top bar
// and underlines the section on screen; on phones it scrolls away with the page, and the same links
// live in the top bar's menu instead. "Clients" and "Students" both open the how-it-works tour,
// on that side's steps.
const SECTIONS = ['overview', 'how-it-works', 'workspace', 'payments', 'faq'];

const ITEMS = [
  { href: '#overview', label: 'Overview', section: 'overview' },
  { href: '#how-it-works', label: 'Clients', section: 'how-it-works', audience: 'client' },
  { href: '#how-it-works', label: 'Students', section: 'how-it-works', audience: 'student' },
  { href: '#workspace', label: 'Your workspace', section: 'workspace' },
  { href: '#payments', label: 'Payments', section: 'payments' },
  { href: '#faq', label: 'FAQ', section: 'faq' },
];

// Which section the reader is in: the last one whose top has passed the line just under both bars
const useCurrentSection = () => {
  const [current, setCurrent] = useState('overview');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 150;
      let found = SECTIONS[0];
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) found = id;
      }
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return current;
};

const SectionNav = ({ audience, onAudience, cta }) => {
  const current = useCurrentSection();

  return (
    <nav aria-label="On this page" className="md:sticky md:top-[76px] z-40 bg-white border-y border-[rgba(10,23,72,0.08)]">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-8 flex items-center gap-4">
        <ul className="flex-1 flex items-center gap-1 overflow-x-auto -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((item) => {
            const active = current === item.section && (!item.audience || item.audience === audience);
            return (
              <li key={item.label} className="shrink-0">
                <a
                  href={item.href}
                  onClick={item.audience ? () => onAudience(item.audience) : undefined}
                  aria-current={active ? 'true' : undefined}
                  className={`relative block px-3 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? 'text-[#0A1748]' : 'text-[#5B6478] hover:text-[#0A1748]'
                  }`}
                >
                  {item.label}
                  <span className={`absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-[#0A1748] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                </a>
              </li>
            );
          })}
        </ul>
        <Link to={cta.to} className="hidden md:inline-flex btn-navy h-10 px-5 shrink-0">{cta.label}</Link>
      </div>
    </nav>
  );
};

export default SectionNav;
