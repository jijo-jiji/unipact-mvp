// Error monitoring. Sentry is only downloaded and started when VITE_SENTRY_DSN is set,
// so local development and builds without a DSN carry no extra code or network calls.
let sentry = null;

export const initMonitoring = async () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
      // No IP addresses, cookies or user details are sent (PDPA)
      sendDefaultPii: false,
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
      // Browser extensions and flaky networks create noise that isn't actionable
      ignoreErrors: ['ResizeObserver loop limit exceeded', 'ResizeObserver loop completed with undelivered notifications', 'Network Error'],
    });
    sentry = Sentry;
  } catch (error) {
    console.warn('Error monitoring could not start', error);
  }
};

export const reportError = (error, extra) => {
  if (sentry) {
    sentry.captureException(error, extra ? { extra } : undefined);
  } else {
    console.error(error, extra);
  }
};
