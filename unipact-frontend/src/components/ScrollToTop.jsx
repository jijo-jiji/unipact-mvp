import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router keeps the previous page's scroll position; start each new page at the top
// (or at the #section in the URL, e.g. /#faq).
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
