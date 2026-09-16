import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, LayoutDashboard, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/routes';
import { useNavMenu, navShellClass } from '../hooks/useNavMenu';
import BrandLogo from './BrandLogo';

// Top bar for signed-out pages. Two clean states only:
//   lg and up  -> logo | centred section links | Sign in + Get started
//   below lg   -> logo | menu button (everything else lives in the dropdown)
const PublicNav = ({ links = [] }) => {
  const { user } = useAuth();
  const { open, toggle, setOpen, scrolled } = useNavMenu();
  const dashboardPath = user ? homePathForRole(user.role) : null;

  return (
    <header className={navShellClass(scrolled, open)}>
      <nav className="max-w-[1160px] mx-auto h-[76px] px-4 sm:px-8 flex lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between gap-6" aria-label="Main">
        <Link to="/" className="justify-self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]" aria-label="UniPact home">
          <BrandLogo subtitle="Talent Marketplace" />
        </Link>

        <ul className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="relative px-3.5 py-2 text-[0.9rem] font-medium text-[#5B6478] hover:text-[#0A1748] transition-colors after:absolute after:left-3.5 after:right-3.5 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#00AEEF] after:scale-x-0 hover:after:scale-x-100 after:transition-transform">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex items-center justify-self-end gap-2">
          {user ? (
            <Link to={dashboardPath} className="btn-primary h-10 px-5">
              <LayoutDashboard size={16} /> Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn h-10 px-4 text-[#0A1748] hover:bg-white hover:text-[#0090C6]">Sign in</Link>
              <Link to="/register" className="btn-primary h-10 px-5">
                Get started <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>

        <button
          className="lg:hidden -mr-2 w-11 h-11 inline-flex items-center justify-center rounded-lg text-[#0A1748] hover:bg-[#0A1748]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]"
          onClick={toggle}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="public-menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <div id="public-menu" className="lg:hidden border-t border-[rgba(10,23,72,0.08)] bg-white animate-fade-in">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-4">
            {links.length > 0 && (
              <ul className="divide-y divide-[rgba(10,23,72,0.06)] mb-4">
                {links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between py-3.5 text-base font-medium text-[#0A1748] hover:text-[#0090C6]">
                      {l.label} <ChevronRight size={18} className="text-[#5B6478]" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {user ? (
              <Link to={dashboardPath} className="btn-primary w-full h-12"><LayoutDashboard size={17} /> Go to dashboard</Link>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link to="/login" className="btn-secondary h-12">Sign in</Link>
                <Link to="/register" className="btn-primary h-12">Get started <ArrowRight size={16} /></Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNav;
