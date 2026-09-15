import { useEffect } from 'react';

const SITE_NAME = 'UniPact';

// Sets the browser tab title, e.g. "Sign in | UniPact". Pass nothing for the default home title.
export const usePageTitle = (title) => {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Curated University Talent Marketplace`;
    return () => {
      document.title = previous;
    };
  }, [title]);
};
