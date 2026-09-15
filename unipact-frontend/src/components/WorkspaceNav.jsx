import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Menu, Settings, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavMenu, navShellClass } from '../hooks/useNavMenu';
import BrandLogo from './BrandLogo';

const LINKS = {
  COMPANY: [
    { to: '/company/dashboard', label: 'Projects' },
    { to: '/campaign/new', label: 'Post a project' },
    { to: '/company/treasury', label: 'Billing' },
  ],
  STUDENT: [
    { to: '/student/dashboard', label: 'My workspace' },
    { to: '/student/profile/:me', label: 'My portfolio' },
  ],
  CLUB: [
    { to: '/student/dashboard', label: 'Dashboard' },
    { to: '/quests', label: 'Quest board' },
  ],
  ADMIN: [{ to: '/admin', label: 'Admin hub' }],
};

const ROLE_LABEL = {
  COMPANY: 'Client',
  STUDENT: 'Student',
  CLUB: 'Club',
  ADMIN: 'Admin',
};

// Top bar for signed-in pages (76px, sticky, blurred per STYLE_GUIDE.md). Two clean states:
//   lg and up  -> logo | centred page links | account + sign out
//   below lg   -> logo | menu button (account, links and sign out live in the dropdown)
const WorkspaceNav = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open, toggle, scrolled } = useNavMenu();

  const links = (LINKS[user?.role] || []).map((l) => ({ ...l, to: l.to.replace(':me', user?.id) }));
  const displayName = user?.company_profile?.company_name || user?.student_profile?.full_name || user?.club_profile?.club_name || user?.name || user?.email || '';
  const roleLabel = ROLE_LABEL[user?.role] || 'Account';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderAvatar = (size = 'w-9 h-9 text-sm') => (
    <span className={`${size} rounded-full bg-[#0B1E63] text-white font-semibold flex items-center justify-center shrink-0`} aria-hidden="true">
      {initial}
    </span>
  );

  return (
    <header className={navShellClass(scrolled, open)}>
      <nav className="max-w-[1160px] mx-auto h-[76px] px-4 sm:px-8 flex lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between gap-6" aria-label="Main">
        <Link to={links[0]?.to || '/'} className="justify-self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]" aria-label="UniPact home">
          <BrandLogo subtitle={`${roleLabel} workspace`} />
        </Link>

        <ul className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-[#0A1748]/[0.04]">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end
                className={({ isActive }) =>
                  `block px-4 py-1.5 rounded-full text-[0.9rem] font-medium transition-colors ${
                    isActive ? 'bg-white text-[#0A1748] shadow-sm' : 'text-[#5B6478] hover:text-[#0A1748]'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex items-center justify-self-end gap-3">
          <NavLink
            to="/settings"
            title="Account settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 min-w-0 pl-1 pr-3 py-1 rounded-full transition-colors ${isActive ? 'bg-white shadow-sm' : 'hover:bg-white'}`
            }
          >
            {renderAvatar()}
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold text-[#0A1748] truncate max-w-[160px]">{displayName}</div>
              <div className="text-xs text-[#5B6478] inline-flex items-center gap-1"><Settings size={11} /> {roleLabel} · Settings</div>
            </div>
          </NavLink>
          <span className="w-px h-8 bg-[rgba(10,23,72,0.12)]" aria-hidden="true" />
          <button onClick={handleLogout} className="btn h-10 px-3 text-[#5B6478] hover:text-red-700 hover:bg-red-50" title="Sign out">
            <LogOut size={16} /> Sign out
          </button>
        </div>

        <button
          className="lg:hidden -mr-2 w-11 h-11 inline-flex items-center justify-center rounded-lg text-[#0A1748] hover:bg-[#0A1748]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]"
          onClick={toggle}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="workspace-menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <div id="workspace-menu" className="lg:hidden border-t border-[rgba(10,23,72,0.08)] bg-white animate-fade-in">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FC] mb-2">
              {renderAvatar('w-10 h-10 text-base')}
              <div className="min-w-0">
                <div className="font-semibold text-[#0A1748] truncate">{displayName}</div>
                <div className="text-sm text-[#5B6478]">{roleLabel} account</div>
              </div>
            </div>
            <ul className="divide-y divide-[rgba(10,23,72,0.06)] mb-4">
              {[...links, { to: '/settings', label: 'Account settings' }].map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end
                    className={({ isActive }) =>
                      `flex items-center justify-between py-3.5 px-1 text-base font-medium ${isActive ? 'text-[#0090C6]' : 'text-[#0A1748] hover:text-[#0090C6]'}`
                    }
                  >
                    {l.label} <ChevronRight size={18} className="text-[#5B6478]" />
                  </NavLink>
                </li>
              ))}
            </ul>
            <button onClick={handleLogout} className="btn-danger w-full h-12">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default WorkspaceNav;
