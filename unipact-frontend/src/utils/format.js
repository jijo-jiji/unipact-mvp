// Human-friendly labels and formatting shared across pages

const STATUS = {
  DRAFT: { label: 'Draft', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  OPEN: { label: 'Finding talent', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  MATCHED: { label: 'Match ready', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-[#E6F7FD] text-[#0090C6] border-[#00AEEF]/30' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ARCHIVED: { label: 'Archived', className: 'bg-slate-50 text-slate-500 border-slate-200' },
  // Applications & invitations
  PENDING: { label: 'Pending', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  AWARDED: { label: 'Awarded', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SUBMITTED: { label: 'Submitted', className: 'bg-[#E6F7FD] text-[#0090C6] border-[#00AEEF]/30' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
  NOT_SELECTED: { label: 'Not selected', className: 'bg-slate-50 text-slate-500 border-slate-200' },
  ACCEPTED: { label: 'Accepted', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', className: 'bg-slate-50 text-slate-500 border-slate-200' },
  ACTIVE: { label: 'Joined', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EXPIRED: { label: 'Link expired', className: 'bg-slate-50 text-slate-500 border-slate-200' },
  // Verification & payments
  VERIFIED: { label: 'Verified', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING_REVIEW: { label: 'Pending review', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  PENDING_VERIFICATION: { label: 'Pending verification', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  HIGH_RISK: { label: 'High risk', className: 'bg-red-50 text-red-700 border-red-200' },
  SUCCESS: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
  NOT_COMPLETED: { label: 'Not completed', className: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export const statusLabel = (status) => STATUS[status]?.label || status || '—';
export const statusClass = (status) => STATUS[status]?.className || 'bg-slate-50 text-slate-600 border-slate-200';

const CAMPAIGN_TYPES = {
  SOFTWARE_DEVELOPMENT: 'Software Development',
  DIGITAL_MARKETING: 'Digital Marketing',
  TALENT_BOUNTY: 'Talent Bounty',
  BRAND_AMBASSADOR: 'Brand Ambassador',
};
export const campaignTypeLabel = (type) => CAMPAIGN_TYPES[type] || type || 'Project';

const DOMAINS = {
  SOFTWARE_DEV: 'Software Development',
  MARKETING: 'Digital Marketing',
  BOTH: 'Software & Marketing',
};
export const domainLabel = (domain) => DOMAINS[domain] || 'Not specified';

const TRANSACTION_TYPES = {
  FINDERS_FEE: "Finder's fee",
  SUBSCRIPTION: 'Subscription',
};
export const transactionTypeLabel = (type) => TRANSACTION_TYPES[type] || type;

export const formatMoney = (amount) => {
  const value = Number(amount);
  if (Number.isNaN(value)) return 'RM —';
  return `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatDate = (value, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Turns an axios error into a sentence a person can act on
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (!err?.response) {
    return err?.message === 'Network Error'
      ? "Can't reach the UniPact server. Check that the backend is running and try again."
      : fallback;
  }
  if (err.response.status === 429) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (err.response.status === 413) {
    return 'That file is too large to upload.';
  }
  const data = err.response.data;
  if (typeof data === 'string') return fallback;
  if (data?.error) return data.error;
  if (data?.detail) return data.detail;
  if (data && typeof data === 'object') {
    const [field, messages] = Object.entries(data)[0] || [];
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (message && typeof message === 'string') {
      return field && field !== 'non_field_errors' ? `${field.replace(/_/g, ' ')}: ${message}` : message;
    }
  }
  return fallback;
};
