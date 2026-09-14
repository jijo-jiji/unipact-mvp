import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Upload, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';

const StudentRegister = () => {
  const navigate = useNavigate();
  const { registerStudent } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    secondary_email: '',
    password: '',
    confirm_password: '',
    university: 'Universiti Malaya (UM)',
    major: '',
    domain_focus: 'SOFTWARE_DEV',
    club_affiliation_name: '',
    club_affiliation_role: ''
  });

  const [verificationDoc, setVerificationDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const universities = [
    'Universiti Malaya (UM)',
    'Universiti Sains Malaysia (USM)',
    'Universiti Kebangsaan Malaysia (UKM)',
    'Universiti Putra Malaysia (UPM)',
    'Universiti Teknologi Malaysia (UTM)',
    'Sunway University',
    'Taylor\'s University',
    'Monash University Malaysia',
    'Asia Pacific University (APU)',
    'Multimedia University (MMU)',
    'Other Malaysian University'
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setVerificationDoc(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('full_name', formData.full_name);
      data.append('email', formData.email);
      if (formData.secondary_email) data.append('secondary_email', formData.secondary_email);
      data.append('password', formData.password);
      data.append('university', formData.university);
      data.append('major', formData.major);
      data.append('domain_focus', formData.domain_focus);
      if (formData.club_affiliation_name) data.append('club_affiliation_name', formData.club_affiliation_name);
      if (formData.club_affiliation_role) data.append('club_affiliation_role', formData.club_affiliation_role);
      if (verificationDoc) data.append('verification_doc', verificationDoc);

      await registerStudent(data);
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
    <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 relative animate-fade-in shadow-2xl">
        {/* Decorative Corners */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>

        {/* HEADER */}
        <div className="mb-6">
          <Link to="/register" className="text-cyan-400 text-xs uppercase flex items-center gap-2 hover:text-white mb-4">
            <ArrowLeft size={14} /> Back to Selection
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-cyan-400/10 border border-cyan-400/40 rounded">
              <GraduationCap className="text-cyan-400" size={24} />
            </div>
            <div>
              <h1 className="text-2xl text-white font-bold tracking-wide">
                Join as Verified Student Talent
              </h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Get matched to real-world paid projects in Software Development & Digital Marketing.
              </p>
            </div>
          </div>
        </div>

        {/* Status notice */}
        <div className="mb-6 bg-cyan-950/40 border-l-4 border-cyan-400 p-3.5 text-xs text-cyan-200">
          <strong className="block text-white uppercase mb-0.5">Verification Notice</strong>
          Your account will default to <strong>Pending Verification</strong> until UniPact Admin validates your student status.
        </div>

        {error && (
          <div className="mb-6 bg-red-950/40 border-l-4 border-red-500 p-3 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name & Domain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Full Legal Name (*)</label>
              <input
                type="text"
                name="full_name"
                required
                value={formData.full_name}
                onChange={handleChange}
                placeholder="e.g. Sarah Tan Shu Min"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Primary Domain Track (*)</label>
              <select
                name="domain_focus"
                value={formData.domain_focus}
                onChange={handleChange}
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              >
                <option value="SOFTWARE_DEV">Software Development & Automation</option>
                <option value="MARKETING">Digital Marketing & Content</option>
                <option value="BOTH">Both Specialized Tracks</option>
              </select>
            </div>
          </div>

          {/* Academic Email & Secondary Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Academic Email (*) <span className="text-cyan-400 text-[10px]">(Preferred)</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. sarah@siswa.um.edu.my"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Personal Secondary Email <span className="text-slate-400 text-[10px]">(Post-Graduation Access)</span>
              </label>
              <input
                type="email"
                name="secondary_email"
                value={formData.secondary_email}
                onChange={handleChange}
                placeholder="e.g. sarahtan.dev@gmail.com"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* University & Major */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">University / Institution (*)</label>
              <select
                name="university"
                value={formData.university}
                onChange={handleChange}
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              >
                {universities.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Degree / Major (*)</label>
              <input
                type="text"
                name="major"
                required
                value={formData.major}
                onChange={handleChange}
                placeholder="e.g. B.Sc. Computer Science"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Verification Document */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Student ID Card / Proof of Enrolment (*)
            </label>
            <div className="border-2 border-dashed border-[var(--border-tech)] hover:border-cyan-400 rounded p-4 text-center cursor-pointer relative bg-black/20 transition-colors">
              <input
                type="file"
                required
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="mx-auto text-cyan-400 mb-1.5 w-6 h-6" />
              {verificationDoc ? (
                <div className="text-xs text-green-400 font-medium flex items-center justify-center gap-1">
                  <CheckCircle size={14} /> {verificationDoc.name}
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  <span className="text-cyan-400 font-semibold">Click to upload</span> student matric card or confirmation letter (PDF, JPG, PNG)
                </div>
              )}
            </div>
          </div>

          {/* Club Affiliation (Lightweight per REQ-3.6.2) */}
          <div className="p-3.5 bg-slate-900/50 border border-slate-700/60 rounded space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">
              Club / Society Affiliation <span className="text-slate-400 text-[10px] font-normal">(Optional Profile Field)</span>
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                name="club_affiliation_name"
                value={formData.club_affiliation_name}
                onChange={handleChange}
                placeholder="Club Name (e.g. UM Coding Club)"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2 text-xs rounded focus:border-cyan-400 focus:outline-none"
              />
              <input
                type="text"
                name="club_affiliation_role"
                value={formData.club_affiliation_role}
                onChange={handleChange}
                placeholder="Your Role (e.g. President / Member)"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2 text-xs rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Password & Confirm */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Password (*)</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Min 8 characters"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Confirm Password (*)</label>
              <input
                type="password"
                name="confirm_password"
                required
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="Repeat password"
                className="w-full bg-black/40 border border-[var(--border-tech)] text-white p-2.5 text-sm rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider text-sm transition-colors shadow-lg disabled:opacity-50"
          >
            {loading ? 'Submitting Application...' : 'Register as Verified Talent'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentRegister;
