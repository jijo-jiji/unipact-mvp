// Business details shown on the Privacy Policy and Terms of Service.
// Set these in the hosting dashboard (see .env.example). Bracketed placeholders show until they're set,
// so a missing detail is obvious during review instead of silently shipping made-up information.
export const LEGAL = {
  entityName: import.meta.env.VITE_LEGAL_ENTITY_NAME || '[Registered company name]',
  registrationNumber: import.meta.env.VITE_LEGAL_REGISTRATION_NO || '[SSM registration number]',
  address: import.meta.env.VITE_LEGAL_ADDRESS || '[Registered business address]',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || '[privacy contact email]',
  lastUpdated: import.meta.env.VITE_LEGAL_LAST_UPDATED || '15 September 2026',
};
