import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

// Centered card layout shared by sign-in, forgot password and reset password
const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col justify-center py-12 px-4 sm:px-6">
    <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
      <Link to="/" className="inline-block mb-5" aria-label="UniPact home">
        <BrandLogo variant="stacked" className="h-28 mx-auto" />
      </Link>
      <h1 className="font-heading font-bold text-2xl tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-[#5B6478] mt-1">{subtitle}</p>}
    </div>
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="card py-8 px-6 sm:px-10">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-[#5B6478]">{footer}</div>}
    </div>
  </div>
);

export default AuthShell;
