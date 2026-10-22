import React, { useState } from 'react';
import { X } from 'lucide-react';

// One line of news above the top bar. Each announcement has its own key, so dismissing one
// doesn't hide the next. Storage can be unavailable (private windows), so the bar just shows again.
const DISMISSED_KEY = 'unipact.announcement.project-messages';

const isDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const AnnouncementBar = ({ onOpen }) => {
  const [hidden, setHidden] = useState(isDismissed);
  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // nothing to remember it in; it shows again next visit
    }
  };

  return (
    <section aria-label="Announcement" className="bg-[#0A1748] text-white text-sm">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-2.5 flex items-center gap-3">
        <p className="flex-1 text-center leading-snug">
          <span className="font-semibold">New:</span> every project now has its own conversation with your team.{' '}
          <a href="#how-it-works" onClick={onOpen} className="underline underline-offset-2 decoration-white/50 hover:decoration-white whitespace-nowrap">
            See how it works
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss this announcement"
          className="shrink-0 -mr-2 w-9 h-9 inline-flex items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]"
        >
          <X size={16} />
        </button>
      </div>
    </section>
  );
};

export default AnnouncementBar;
