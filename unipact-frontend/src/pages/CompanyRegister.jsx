import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Upload, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import api from '../api/client';

const CompanyRegister = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    ssmNumber: '',
  });

  const [isPublicDomain, setIsPublicDomain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];

  const handleEmailChange = (e) => {
    const email = e.target.value;
    setFormData({ ...formData, email });

    const domain = email.split('@')[1]?.toLowerCase();
    if (publicDomains.includes(domain)) {
      setIsPublicDomain(true);
    } else {
      setIsPublicDomain(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/users/register/company/', {
        email: formData.email,
        password: formData.password,
        company_name: formData.companyName,
        company_details: formData.ssmNumber,
      });
      navigate('/company/dashboard');
    } catch (err) {
      console.error("Registration failed", err);
      setError(err.response?.data?.email?.[0] || err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex items-center justify-center p-6 selection:bg-[#00AEEF] selection:text-white">
      <div className="w-full max-w-2xl bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-8 sm:p-10 shadow-sm relative animate-fade-in">

        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-xs font-semibold text-[#5B6478] hover:text-[#0A1748] flex items-center gap-1.5 mb-6 transition-colors">
            <ArrowLeft size={14} /> Back to Home
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center shadow-sm">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl text-[#0A1748] tracking-tight">
                Register Enterprise Client Account
              </h1>
              <p className="text-xs text-[#5B6478] mt-0.5">
                Connect your organization directly with verified university student talent.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#0A1748] mb-1">Business Email (*)</label>
            <input
              type="email"
              required
              placeholder="e.g. corporate@company.com"
              value={formData.email}
              onChange={handleEmailChange}
              className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-3 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none transition-colors"
            />
            {isPublicDomain && (
              <div className="mt-2 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong className="block font-bold mb-0.5">Verification Notice: Public Email Domain</strong>
                  To protect student talent, accounts using public email providers require manual SSM validation before project order finalization.
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0A1748] mb-1">Company / Entity Name (*)</label>
              <input
                type="text"
                required
                placeholder="TechCorp Sdn Bhd"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-3 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0A1748] mb-1">SSM Registration Number (*)</label>
              <input
                type="text"
                required
                placeholder="202501001234"
                value={formData.ssmNumber}
                onChange={(e) => setFormData({ ...formData, ssmNumber: e.target.value })}
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-3 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0A1748] mb-1">Account Password (*)</label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-3 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 px-4 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Creating Client Account...' : (
              <>Register Enterprise Account <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[rgba(10,23,72,0.08)] text-center text-xs text-[#5B6478]">
          Already have an enterprise account?{' '}
          <Link to="/login" className="font-bold text-[#00AEEF] hover:underline">
            Sign In Here
          </Link>
        </div>

      </div>
    </div>
  );
};

export default CompanyRegister;
