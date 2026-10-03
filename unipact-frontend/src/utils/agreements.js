// The agreements users accept inside the app. The wording is in src/pages/AgreementPages.jsx.
// `version` must match CURRENT_VERSIONS in the API's users/agreements.py: change both, together with the
// wording, and everyone is asked to accept the new version before their next job or payment.
export const AGREEMENTS = {
  TALENT: {
    key: 'TALENT',
    version: '2026-09-29-draft',
    versionLabel: 'Draft of 29 September 2026',
    title: 'Talent Agreement',
    path: '/agreements/talent',
    // The points a student most needs to know before taking paid work
    summary: [
      'You are an independent contractor, choose which jobs to accept, and handle your own income tax.',
      'Each job offer states your payout before you accept. You are paid within 7 working days after the client accepts the work.',
      'You deliver on time and to the brief, including up to 2 rounds of minor revisions, and fix bugs in your own software work for 30 days.',
      'Rights in the work pass to UniPact, and on to the client, once you are paid for it. You may show the work itself only with the client’s written approval.',
      'For 12 months after your last job for a client, further work for that client goes through UniPact.',
    ],
  },
  CLIENT: {
    key: 'CLIENT',
    version: '2026-09-29-draft',
    versionLabel: 'Draft of 29 September 2026',
    title: 'Client Service Agreement',
    path: '/agreements/client',
    summary: [
      'UniPact is responsible to you for the delivery. You deal with UniPact on scope, payment and disputes.',
      'Each milestone is paid in full before work on it starts. UniPact holds the money and releases it only when you accept the milestone.',
      'Each deliverable includes 2 rounds of minor revisions. You accept or request a revision within 5 working days; after that it counts as accepted.',
      'All rights in a milestone’s deliverables pass to you once it is paid in full. Software comes with 30 days of free bug fixes.',
      'For 12 months after a student’s last job for you, further work with them goes through UniPact.',
    ],
  },
};

// The registered business, as it must appear in the agreements (from the SSM registration)
export const UNIPACT_PARTY = {
  owner: 'Azizi bin Sahari',
  name: 'UNIPACT DIGITAL SOLUTIONS',
  registrationNumber: '202603205508 (JR0194048-V)',
  address: 'Unit 21-7, 16 Jalan Raja Ali, Off Jalan Raja Abdullah, Kampung Baru, 50300 Kuala Lumpur',
};

// The API refuses a job or a payment with this error until the current agreement is on record.
// Returns which agreement is needed ('TALENT' | 'CLIENT'), or null for any other error.
export const agreementRequiredBy = (error) => (
  error?.response?.status === 403 && error.response.data?.code === 'agreement_required' ? error.response.data.agreement : null
);
