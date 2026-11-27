// Installable app (PWA) helpers: register the service worker, and keep Chrome's install prompt so a button can
// offer it later. iPhones have no prompt: people add the site from Safari's Share menu instead.

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works the same without it */ });
  });
};

export const captureInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; notify(); });
};

export const canPromptInstall = () => Boolean(deferredPrompt);

export const promptInstall = async () => {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === 'accepted';
};

export const onInstallChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)
  || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
