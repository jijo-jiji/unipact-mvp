import React, { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../utils/installApp';

const DISMISS_KEY = 'unipact.installCard.dismissed';

const readDismissed = () => {
  try { return window.localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

// "Install the UniPact app": a one-tap install where the browser offers it (Android, desktop Chrome and Edge),
// and Safari's two steps on iPhone. Hidden once installed or dismissed.
const InstallAppCard = () => {
  const [, refresh] = useState(0);
  const [dismissed, setDismissed] = useState(readDismissed);
  useEffect(() => onInstallChange(() => refresh((n) => n + 1)), []);

  const ios = isIos();
  if (dismissed || isInstalled() || (!canPromptInstall() && !ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private browsing: hide for this visit only */ }
  };

  return (
    <section className="card p-5 bg-white border border-[#00AEEF]/40 flex gap-4 items-start" aria-label="Install the UniPact app">
      <span className="w-10 h-10 rounded-lg bg-[#0B1E63] text-white flex items-center justify-center shrink-0">
        <Smartphone size={20} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-lg">Put UniPact on your home screen</p>
        {ios ? (
          <p className="text-sm text-[#5B6478] mt-0.5">
            In Safari, tap <Share size={14} className="inline -mt-0.5" aria-label="Share" /> Share, then
            <span className="font-semibold text-[#0A1748]"> Add to Home Screen</span>. It opens like an app, full screen.
          </p>
        ) : (
          <>
            <p className="text-sm text-[#5B6478] mt-0.5">Open your clubs and approvals in one tap, full screen, like an app.</p>
            <button type="button" className="btn-primary btn-sm mt-3" onClick={() => promptInstall()}>Install the app</button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} className="text-[#5B6478] hover:text-[#0A1748]" aria-label="Not now">
        <X size={18} />
      </button>
    </section>
  );
};

export default InstallAppCard;
