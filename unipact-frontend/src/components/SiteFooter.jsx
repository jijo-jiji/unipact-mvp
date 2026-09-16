import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { LEGAL } from '../utils/legal';

// Footer for public pages (landing, legal). Section links jump back to the landing page sections.
const SiteFooter = () => (
  <footer className="border-t border-[rgba(10,23,72,0.08)] bg-white">
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 text-sm text-[#5B6478]">
      <div className="text-center md:text-left">
        <Link to="/" aria-label="UniPact home"><BrandLogo subtitle="Talent Marketplace" /></Link>
        <p className="mt-3 max-w-xs mx-auto md:mx-0">Connecting companies with verified university talent in Malaysia.</p>
      </div>
      <nav aria-label="Product" className="text-center md:text-left">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#0A1748] mb-3 font-body">Product</h2>
        <ul className="space-y-1">
          <li><Link to="/#how-it-works" className="inline-block py-1.5 hover:text-[#0A1748]">How it works</Link></li>
          <li><Link to="/#faq" className="inline-block py-1.5 hover:text-[#0A1748]">FAQ</Link></li>
        </ul>
      </nav>
      <nav aria-label="Get started" className="text-center md:text-left">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#0A1748] mb-3 font-body">Get started</h2>
        <ul className="space-y-1">
          <li><Link to="/register/company" className="inline-block py-1.5 hover:text-[#0A1748]">For companies</Link></li>
          <li><Link to="/register/student" className="inline-block py-1.5 hover:text-[#0A1748]">For students</Link></li>
          <li><Link to="/login" className="inline-block py-1.5 hover:text-[#0A1748]">Sign in</Link></li>
        </ul>
      </nav>
      <nav aria-label="Legal" className="text-center md:text-left">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#0A1748] mb-3 font-body">Legal</h2>
        <ul className="space-y-1">
          <li><Link to="/privacy" className="inline-block py-1.5 hover:text-[#0A1748]">Privacy Policy</Link></li>
          <li><Link to="/terms" className="inline-block py-1.5 hover:text-[#0A1748]">Terms of Service</Link></li>
          <li><a href={`mailto:${LEGAL.contactEmail}`} className="inline-block py-1.5 hover:text-[#0A1748] break-all">Contact us</a></li>
        </ul>
      </nav>
    </div>
    <div className="border-t border-[rgba(10,23,72,0.06)]">
      <p className="max-w-[1160px] mx-auto px-4 sm:px-8 py-5 text-xs text-[#5B6478] text-center md:text-left">
        © {new Date().getFullYear()} {LEGAL.entityName} ({LEGAL.registrationNumber}). All rights reserved.
      </p>
    </div>
  </footer>
);

export default SiteFooter;
