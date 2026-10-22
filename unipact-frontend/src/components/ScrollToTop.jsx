import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router keeps the previous page's scroll position; start each new page at the top
// (or at the #section in the URL, e.g. /#faq).
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return undefined;
    }
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView();
      return undefined;
    }
    // Opened straight from a link, the page is still behind the sign-in check's loading screen,
    // so wait (briefly) for the section to appear.
    const observer = new MutationObserver(() => {
      const el = document.getElementById(id);
      if (el) {
        observer.disconnect();
        el.scrollIntoView();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const giveUp = window.setTimeout(() => observer.disconnect(), 5000);
    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
    };
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
