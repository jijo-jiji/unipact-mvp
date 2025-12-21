import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, AlertTriangle, Upload, FileText, ArrowLeft } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const CompanyRegister = () => {
  const navigate = useNavigate();

  // STATE
  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    ssmNumber: '',
    password: '',
    confirmPassword: ''
  });

  const [isPublicDomain, setIsPublicDomain] = useState(false);

  // LOGIC: Check for Gmail/Yahoo/Hotmail (PDF Page 2 Requirement)
  const handleEmailChange = (e) => {
    const email = e.target.value;
    setFormData({ ...formData, email });

    const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const domain = email.split('@')[1];
    if (domain && publicDomains.includes(domain)) {
      setIsPublicDomain(true);
    } else {
      setIsPublicDomain(false);
    }
  };

  const { registerCompany } = useAuth(); // Import from context

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      await registerCompany({
        email: formData.email,
        password: formData.password,
        company_name: formData.companyName,
        company_details: formData.ssmNumber, // Mapping SSM to details for now, or need schema update? Schema has ssm_document.
        // Wait, serializer fields: company_name, company_details, email, password, verification_status, tier, ssm_document.
        // The form has "SSM Registration ID" -> I'll put that in company_details or just company_details.
        // Let's assume company_details for SSM Number for now.
      });
      navigate('/company/dashboard');
    } catch (error) {
      console.error("Registration failed", error);
      alert("Registration Failed: " + (error.response?.data?.email || "Unknown Error"));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 relative animate-fade-in">

        {/* Decorative Corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[var(--text-gold)]"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[var(--text-gold)]"></div>

        {/* HEADER */}
        <div className="mb-8">
          <Link to="/" className="text-[var(--text-blue)] text-xs uppercase flex items-center gap-2 hover:text-white mb-4">
            <ArrowLeft size={14} /> Cancel Protocol
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[var(--text-gold)]/10 border border-[var(--text-gold)] rounded-sm">
              <Building2 className="text-[var(--text-gold)]" size={24} />
            </div>
            <h1 className="text-2xl text-white font-display uppercase tracking-widest">
              Establish Guild Charter
            </h1>
          </div>
          <p className="text-[var(--text-blue)] text-sm">Register your organization to recruit S-Rank talent.</p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. Business Email */}
          <div>
            <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">Business Email</label>
            <input
              type="email"
              required
              placeholder="marketing@company.com"
              value={formData.email}
              onChange={handleEmailChange}
              className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[var(--text-gold)] focus:outline-none transition-colors"
            />
            {/* PUBLIC DOMAIN WARNING (PDF Requirement) */}
            {isPublicDomain && (
              <div className="mt-2 bg-yellow-900/20 border border-yellow-600/50 p-3 flex items-start gap-3 text-yellow-500 text-xs">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="block uppercase mb-1">Security Alert: Public Domain Detected</strong>
                  To protect our Hunters, using a public email requires uploading your SSM Certificate for verification.
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 2. Company Name */}
            <div>
              <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">Guild / Company Name</label>
              <input
                type="text"
                required
                placeholder="TechCorp PLT"
                className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[var(--text-gold)] focus:outline-none transition-colors"
              />
            </div>

            {/* 3. SSM Number */}
            <div>
              <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">SSM Registration ID</label>
              <input
                type="text"
                required
                placeholder="202501001234"
                className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[var(--text-gold)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* 4. Verification Doc (Only if Public Domain) */}
          {isPublicDomain && (
            <div className="border border-dashed border-[var(--text-gold)] bg-[var(--text-gold)]/5 p-6 text-center cursor-pointer hover:bg-[var(--text-gold)]/10 transition-colors">
              <Upload className="mx-auto text-[var(--text-gold)] mb-2" size={20} />
              <div className="text-[var(--text-gold)] font-bold text-sm">Upload SSM Certificate</div>
              <div className="text-[var(--text-blue)] text-xs mt-1">PDF Format Only (Max 5MB)</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 5. Password */}
            <div>
              <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">Set Security Key</label>
              <input
                type="password"
                required
                className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[var(--text-gold)] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">Confirm Key</label>
              <input
                type="password"
                required
                className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[var(--text-gold)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[var(--border-tech)]">
            <button className="w-full bg-[var(--text-gold)] text-black font-bold py-4 uppercase tracking-widest hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2">
              <FileText size={18} /> Sign Charter
            </button>
            <div className="text-center mt-4 text-xs text-[var(--text-blue)]">
              Already hold a charter? <Link to="/login" className="text-[var(--text-gold)] hover:underline">Log In Sequence</Link>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

export default CompanyRegister;