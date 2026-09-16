import React from 'react';
import { Link } from 'react-router-dom';

// Required sign-up consent (PDPA). Links open in a new tab so a half-filled form isn't lost.
const TermsConsent = ({ checked, onChange }) => (
  <label className="flex items-start gap-3 p-3 rounded-lg border border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] cursor-pointer text-sm">
    <input
      type="checkbox"
      required
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 w-5 h-5 shrink-0 accent-[#00AEEF]"
    />
    <span>
      I agree to the{' '}
      <Link to="/terms" target="_blank" rel="noopener" className="font-semibold text-[#0090C6] underline">Terms of Service</Link>{' '}
      and{' '}
      <Link to="/privacy" target="_blank" rel="noopener" className="font-semibold text-[#0090C6] underline">Privacy Policy</Link>,
      including how UniPact uses my personal data to verify my account and match me to projects.
    </span>
  </label>
);

export default TermsConsent;
