import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Shared behaviour for the top bars: mobile menu state plus a "scrolled" flag for the shadow.
// The menu closes on navigation, on Escape, and when the screen grows past the lg breakpoint.
export const useNavMenu = () => {
  const { pathname, hash } = useLocation();
  const locationKey = `${pathname}${hash}`;
  // The menu remembers the page it was opened on, so navigating anywhere closes it automatically
  const [openAt, setOpenAt] = useState(null);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);

  const open = openAt === locationKey;
  const setOpen = (value) => setOpenAt(value ? locationKey : null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onKey = (e) => e.key === 'Escape' && setOpenAt(null);
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = (e) => e.matches && setOpenAt(null);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
    };
  }, []);

  return { open, setOpen, toggle: () => setOpen(!open), scrolled };
};

export const navShellClass = (scrolled, open) =>
  `sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-200 border-b ${
    scrolled || open
      ? 'bg-white/95 backdrop-blur-[12px] border-[rgba(10,23,72,0.08)] shadow-[0_4px_20px_rgba(10,23,72,0.06)]'
      : 'bg-[rgba(245,247,252,0.94)] backdrop-blur-[12px] border-transparent'
  }`;
