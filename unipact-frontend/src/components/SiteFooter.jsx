import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { LEGAL } from '../utils/legal';
import { INSTAGRAM, MARKETING_SITE, TEAM_CONTACTS } from '../utils/contacts';

// Footer for public pages (front page, legal pages), laid out like the one on www.unipact.my:
// brand and contact details, three link columns, the team's direct contacts, then the legal line.
// Section links jump back to the front page's sections.
const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { to: '/#how-it-works', label: 'How it works' },
      { to: '/#workspace', label: 'Your workspace' },
      { to: '/#payments', label: 'Payments' },
      { to: '/#faq', label: 'FAQ' },
      { href: MARKETING_SITE, label: 'About UniPact' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { to: '/register/company', label: 'Post a project' },
      { to: '/register/student', label: 'Join as a student' },
      { href: `${MARKETING_SITE}/#contact`, label: 'Talk to us' },
      { to: '/login', label: 'Sign in' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
      { to: '/agreements/client', label: 'Client Service Agreement' },
      { to: '/agreements/talent', label: 'Talent Agreement' },
    ],
  },
];

const linkClass = 'inline-block py-1.5 hover:text-[#0A1748]';

const SiteFooter = () => (
  <footer className="border-t border-[rgba(10,23,72,0.08)] bg-white text-sm text-[#5B6478]">
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
      <div className="sm:col-span-2 lg:col-span-1">
        <Link to="/" aria-label="UniPact home" className="inline-flex"><BrandLogo /></Link>
        <p className="mt-3 max-w-xs">Vetted university student teams for software and digital marketing projects in Malaysia.</p>
        <a href={`mailto:${LEGAL.contactEmail}`} className="inline-block mt-2 font-semibold text-[#0B1E63] hover:underline break-all">
          {LEGAL.contactEmail}
        </a>
        <a href={INSTAGRAM.url} target="_blank" rel="noopener noreferrer" className="block w-fit mt-1 py-0.5 hover:text-[#0A1748] hover:underline">
          Instagram {INSTAGRAM.handle}
        </a>
      </div>

      {COLUMNS.map(({ title, links }) => (
        <nav key={title} aria-label={title}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0A1748] mb-3 font-body">{title}</h2>
          <ul>
            {links.map((l) => (
              <li key={l.label}>
                {l.to ? <Link to={l.to} className={linkClass}>{l.label}</Link> : <a href={l.href} className={linkClass}>{l.label}</a>}
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>

    <div className="border-t border-[rgba(10,23,72,0.06)]">
      <ul className="max-w-[1160px] mx-auto px-4 sm:px-8 py-7 grid grid-cols-1 sm:grid-cols-3 gap-6" aria-label="Contact the UniPact team">
        {TEAM_CONTACTS.map((person) => (
          <li key={person.email}>
            <p className="font-heading font-bold text-base text-[#0A1748]">{person.name}</p>
            <p>{person.role}</p>
            <a href={`mailto:${person.email}`} className="inline-block mt-2 font-semibold text-[#0B1E63] hover:underline break-all">{person.email}</a>
            <a href={`tel:${person.phone.replace(/[^+\d]/g, '')}`} className="block w-fit mt-1 py-0.5 hover:text-[#0A1748] hover:underline">{person.phone}</a>
          </li>
        ))}
      </ul>
    </div>

    <div className="border-t border-[rgba(10,23,72,0.06)]">
      <p className="max-w-[1160px] mx-auto px-4 sm:px-8 py-5 text-xs">
        © {new Date().getFullYear()} UniPact. {LEGAL.entityName}, registered in Malaysia, Registration No. {LEGAL.registrationNumber}. All rights reserved.
      </p>
    </div>
  </footer>
);

export default SiteFooter;
