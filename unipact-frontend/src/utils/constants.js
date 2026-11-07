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
  "Universiti Kuala Lumpur (UniKL)",
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

// Student sign-up: year and semester of study, and how many hours a week they can give
export const YEAR_OF_STUDY_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `Year ${n}` }));
export const SEMESTER_OPTIONS = [
  { value: 1, label: 'Semester 1' },
  { value: 2, label: 'Semester 2' },
  { value: 3, label: 'Short semester' },
];
export const WEEKLY_AVAILABILITY_OPTIONS = [
  { value: '1-5', label: '1-5 hours a week' },
  { value: '6-10', label: '6-10 hours a week' },
  { value: '11-15', label: '11-15 hours a week' },
  { value: '16+', label: '16+ hours a week' },
];

// Client sign-up: a company registered with SSM, or an NGO registered with ROS (KDN)
export const ORG_TYPES = {
  COMPANY: {
    label: 'Company', nameLabel: 'Company name', namePlaceholder: 'TechCorp Sdn Bhd',
    numberLabel: 'SSM registration number', numberPlaceholder: '202603205508',
    numberHint: 'The 12-digit number on your SSM certificate.', documentLabel: 'SSM registration certificate',
  },
  NGO: {
    label: 'NGO', nameLabel: 'Organisation name', namePlaceholder: 'Pertubuhan Kebajikan Kasih',
    numberLabel: 'ROS (KDN) registration number', numberPlaceholder: 'PPM-011-10-25022025',
    numberHint: 'As on your ROS certificate, e.g. PPM-011-10-25022025.', documentLabel: 'ROS registration certificate',
  },
};

export const EMPTY_STUDENT_CONTACT = {
  whatsapp_number: '', university_email: '', year_of_study: '', current_semester: '',
  weekly_availability: '', linkedin_url: '', portfolio_url: '',
};
export const STUDENT_CONTACT_FIELDS = Object.keys(EMPTY_STUDENT_CONTACT);
