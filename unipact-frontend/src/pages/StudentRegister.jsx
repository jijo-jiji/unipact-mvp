import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Upload, ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const MALAYSIAN_UNIVERSITIES = [
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

const StudentRegister = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    university: MALAYSIAN_UNIVERSITIES[0],
    major: '',
    domain_focus: 'SOFTWARE_DEV',
    skills: '',
    bio: '',
    club_affiliation_name: '',
    club_affiliation_role: ''
  });

  const [docFile, setDocFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('email', formData.email);
      payload.append('password', formData.password);
      payload.append('full_name', formData.full_name);
      payload.append('university', formData.university);
      payload.append('major', formData.major);
      payload.append('domain_focus', formData.domain_focus);

      const skillsArray = formData.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      payload.append('skills', JSON.stringify(skillsArray));

      if (formData.bio) payload.append('bio', formData.bio);
      if (formData.club_affiliation_name) payload.append('club_affiliation_name', formData.club_affiliation_name);
      if (formData.club_affiliation_role) payload.append('club_affiliation_role', formData.club_affiliation_role);
      if (docFile) payload.append('verification_document', docFile);

      await api.post('/users/register/student/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Auto-login
      await login(formData.email, formData.password);
      navigate('/student/dashboard');
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data) {
        const d = err.response.data;
        setError(d.error || Object.values(d)[0] || 'Registration failed.');
      } else {
        setError('Registration failed. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex items-center justify-center p-6 selection:bg-[#00AEEF] selection:text-white">
      <div className="w-full max-w-2xl bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-8 sm:p-10 shadow-sm relative animate-fade-in">

        {/* Header */}
        <div className="mb-6">
          <Link to="/register" className="text-xs font-semibold text-[#5B6478] hover:text-[#0A1748] flex items-center gap-1.5 mb-6 transition-colors">
            <ArrowLeft size={14} /> Back to Selection
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center shadow-sm">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl text-[#0A1748] tracking-tight">
                Join as Verified Student Talent
              </h1>
              <p className="text-xs text-[#5B6478] mt-0.5">
                Get matched to real-world paid projects in Software Development & Digital Marketing.
              </p>
            </div>
          </div>
        </div>

        {/* Status notice */}
        <div className="mb-6 bg-amber-50 border border-amber-200 p-3.5 rounded-lg text-xs text-amber-900">
          <strong className="block font-bold mb-0.5">Verification Notice</strong>
          Your account will default to <strong>Pending Verification</strong> until UniPact Admin validates your student status.
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name & Domain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#0A1748] block mb-1">Full Legal Name (*)</label>
              <input
                type="text"
                name="full_name"
                required
                value={formData.full_name}
                onChange={handleChange}
                placeholder="e.g. Sarah Tan Shu Min"
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#0A1748] block mb-1">Primary Domain Track (*)</label>
              <select
                name="domain_focus"
                value={formData.domain_focus}
                onChange={handleChange}
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
              >
                <option value="SOFTWARE_DEV">Software Development (Full-Stack, Mobile, DevOps)</option>
                <option value="MARKETING">Digital Marketing (Social Media, Content, SEO)</option>
                <option value="BOTH">Dual Specialist (Dev & Marketing)</option>
              </select>
            </div>
          </div>

          {/* Email & Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#0A1748] block mb-1">University / Personal Email (*)</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="student@university.edu.my"
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#0A1748] block mb-1">Password (*)</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
          </div>

          {/* University & Major */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#0A1748] block mb-1">Institution (*)</label>
              <select
                name="university"
                value={formData.university}
                onChange={handleChange}
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
              >
                {MALAYSIAN_UNIVERSITIES.map((u, i) => (
                  <option key={i} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#0A1748] block mb-1">Degree Major (*)</label>
              <input
                type="text"
                name="major"
                required
                value={formData.major}
                onChange={handleChange}
                placeholder="e.g. B.Sc. Computer Science"
                className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
          </div>

          {/* Club / Guild Affiliation (SRS v2.2.1 Coexistence) */}
          <div className="p-3.5 bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg">
            <span className="text-[11px] font-bold text-[#0B1E63] uppercase tracking-wider block mb-2">
              Club / Guild Affiliation (Optional)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#5B6478] block mb-1">Club / Society Name</label>
                <input
                  type="text"
                  name="club_affiliation_name"
                  value={formData.club_affiliation_name}
                  onChange={handleChange}
                  placeholder="e.g. UM Coding Society"
                  className="w-full bg-white border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2 text-xs rounded focus:border-[#00AEEF] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#5B6478] block mb-1">Your Role in Club</label>
                <input
                  type="text"
                  name="club_affiliation_role"
                  value={formData.club_affiliation_role}
                  onChange={handleChange}
                  placeholder="e.g. Tech Lead / Vice President"
                  className="w-full bg-white border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2 text-xs rounded focus:border-[#00AEEF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="text-xs font-semibold text-[#0A1748] block mb-1">Key Technical / Marketing Skills (*)</label>
            <input
              type="text"
              name="skills"
              required
              value={formData.skills}
              onChange={handleChange}
              placeholder="e.g. React, Django, Tailwind CSS, PostgreSQL, Figma"
              className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-semibold text-[#0A1748] block mb-1">Brief Bio & Strengths</label>
            <textarea
              name="bio"
              rows={2}
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell clients what projects you excel at..."
              className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none"
            />
          </div>

          {/* Student ID Proof Upload */}
          <div>
            <label className="text-xs font-semibold text-[#0A1748] block mb-1">
              Student ID or Enrollment Confirmation Proof (PDF, PNG, JPG)
            </label>
            <input
              type="file"
              onChange={(e) => e.target.files && setDocFile(e.target.files[0])}
              className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#5B6478] p-2 text-xs rounded-md focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 px-4 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Submitting Application...' : (
              <>Register as Student Talent <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[rgba(10,23,72,0.08)] text-center text-xs text-[#5B6478]">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-[#00AEEF] hover:underline">
            Sign In to Workspace
          </Link>
        </div>

      </div>
    </div>
  );
};

export default StudentRegister;
