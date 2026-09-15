import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Building2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import TermsConsent from '../components/TermsConsent';
import { usePageTitle } from '../hooks/usePageTitle';

const PUBLIC_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];

const CompanyRegister = () => {
  const navigate = useNavigate();
  const { registerCompany } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '', companyName: '', ssmNumber: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  usePageTitle('Create a client account');

  const domain = formData.email.split('@')[1]?.toLowerCase();
  const isPublicDomain = PUBLIC_DOMAINS.includes(domain);

  const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password.length < 8) {
      setError('Please choose a password with at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      // Registration signs the company in and updates auth state, so the dashboard route lets them through
      await registerCompany({
        email: formData.email.trim(),
        password: formData.password,
        company_name: formData.companyName.trim(),
        company_details: formData.ssmNumber.trim(),
        accept_terms: acceptTerms,
      });
      navigate('/company/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl card p-6 sm:p-10 animate-fade-in">
        <Link to="/register" className="back-link mb-6">
          <ArrowLeft size={15} /> Back
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center shadow-sm shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="font-heading font-bold text-2xl tracking-tight">Create a client account</h1>
            <p className="text-sm text-[#5B6478] mt-0.5">Post projects for free and work with verified university students.</p>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-6" role="alert">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="field-label" htmlFor="company-email">Work email</label>
            <input id="company-email" type="email" required autoComplete="email" placeholder="you@company.com" value={formData.email} onChange={update('email')} className="input" />
            {isPublicDomain && (
              <div className="mt-2 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2.5 text-amber-900 text-sm">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <span>Personal email addresses need manual review before you can post projects. Use your company email to get started faster.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="company-name">Company name</label>
              <input id="company-name" required autoComplete="organization" placeholder="TechCorp Sdn Bhd" value={formData.companyName} onChange={update('companyName')} className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="company-ssm">SSM registration number</label>
              <input id="company-ssm" required placeholder="202501001234" value={formData.ssmNumber} onChange={update('ssmNumber')} className="input" />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="company-password">Password</label>
            <input id="company-password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={formData.password} onChange={update('password')} className="input" />
          </div>

          <TermsConsent checked={acceptTerms} onChange={setAcceptTerms} />

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : <>Create client account <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[rgba(10,23,72,0.08)] text-center text-sm text-[#5B6478]">
          Already have an account?{' '}
          <Link to="/login" className="inline-block py-2 font-semibold text-[#0090C6] hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default CompanyRegister;
