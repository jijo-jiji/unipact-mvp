export const MALAYSIAN_UNIVERSITIES = [
  "Universiti Malaya (UM)",
  "Universiti Sains Malaysia (USM)",
  "Universiti Kebangsaan Malaysia (UKM)",
  "Universiti Putra Malaysia (UPM)",
  "Universiti Teknologi Malaysia (UTM)",
  "Taylor's University",
  "Sunway University",
  "Monash University Malaysia",
  "Asia Pacific University (APU)",
  "Multimedia University (MMU)",
  "Universiti Teknologi MARA (UiTM)",
  "UCSI University",
  "Other Institution"
];

export const DOMAIN_OPTIONS = [
  { value: 'SOFTWARE_DEV', label: 'Software development' },
  { value: 'MARKETING', label: 'Digital marketing' },
  { value: 'BOTH', label: 'Both' },
];

export const MALAYSIAN_BANKS = [
  "Maybank (Malayan Banking Berhad)",
  "CIMB Bank",
  "Public Bank",
  "RHB Bank",
  "Hong Leong Bank",
  "AmBank",
  "Bank Islam Malaysia",
  "Alliance Bank",
  "Affin Bank",
  "Bank Muamalat",
  "Standard Chartered Bank",
  "HSBC Bank Malaysia",
  "OCBC Bank Malaysia",
  "UOB Malaysia (United Overseas Bank)",
  "Other Bank"
];


// UniPact's default cut of each project fee, shown in pricing copy. Keep in step with the backend's
// DEFAULT_PLATFORM_FEE_PERCENT (admins can still set a different fee on individual projects).
export const SERVICE_FEE_PERCENT = import.meta.env.VITE_SERVICE_FEE_PERCENT || '10';

// The card checkout is a local demo only: production builds bill by invoice and bank transfer,
// and the API refuses the demo checkout there (MOCK_PAYMENTS_ENABLED).
export const CARD_CHECKOUT_ENABLED = !import.meta.env.PROD;
