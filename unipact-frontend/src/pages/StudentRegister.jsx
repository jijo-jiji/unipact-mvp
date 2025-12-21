import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Shield } from 'lucide-react';

const StudentRegister = () => {
  const navigate = useNavigate();

  const { registerClub } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    club_name: '',
    university: 'Universiti Malaya (UM)' // Default
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting Hunter License");
    try {
      await registerClub(formData);
      navigate('/student/dashboard'); // Or logic for pending verification?
    } catch (error) {
      console.error(error);
      alert("Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 relative animate-fade-in">

        {/* Decorative Corners (Purple) */}
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#a020f0]"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#a020f0]"></div>

        {/* HEADER */}
        <div className="mb-8">
          <Link to="/" className="text-[var(--text-blue)] text-xs uppercase flex items-center gap-2 hover:text-white mb-4">
            <ArrowLeft size={14} /> Cancel Protocol
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#a020f0]/10 border border-[#a020f0] rounded-sm">
              <GraduationCap className="text-[#a020f0]" size={24} />
            </div>
            <h1 className="text-2xl text-white font-display uppercase tracking-widest">
              Hunter License Application
            </h1>
          </div>
          <p className="text-[var(--text-blue)] text-sm">Register your club to accept Bounties.</p>
        </div>

        {/* WARNING (Page 3 Requirement) */}
        <div className="mb-8 bg-blue-900/20 border-l-4 border-blue-500 p-4 text-xs text-blue-300">
          <strong className="block text-white uppercase mb-1">Verification Required</strong>
          Your club must be verified by the System Admin before you can actively bid on Quests.
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Email */}
            <div>
              <label className="text-[#a020f0] text-xs uppercase tracking-wider block mb-2">Official Club Email</label>
              <input
                type="email"
                name="email"
                required
                onChange={handleChange}
                placeholder="president@um-business.edu.my"
                className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[#a020f0] focus:outline-none transition-colors"
              />
            </div>

            {/* 2. University (Dropdown) */}
            <div>
              <label className="text-[#a020f0] text-xs uppercase tracking-wider block mb-2">Affiliation (University)</label>
              <select name="university" onChange={handleChange} className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[#a020f0] focus:outline-none transition-colors">
                <option>Universiti Malaya (UM)</option>
                <option>Universiti Sains Malaysia (USM)</option>
                <option>Universiti Kebangsaan Malaysia (UKM)</option>
                <option>Sunway University</option>
                <option>Taylor's University</option>
              </select>
            </div>
          </div>

          {/* 3. Club Name */}
          <div>
            <label className="text-[#a020f0] text-xs uppercase tracking-wider block mb-2">Club / Society Name</label>
            <input
              type="text"
              name="club_name"
              required
              onChange={handleChange}
              placeholder="e.g. UM Business Club"
              className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[#a020f0] focus:outline-none transition-colors"
            />
          </div>

          {/* 4. Password */}
          <div>
            <label className="text-[#a020f0] text-xs uppercase tracking-wider block mb-2">Set Security Key</label>
            <input
              type="password"
              name="password"
              required
              onChange={handleChange}
              className="w-full bg-black/30 border border-gray-700 text-white p-3 text-sm focus:border-[#a020f0] focus:outline-none transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[var(--border-tech)]">
            <button className="w-full bg-[#a020f0] text-white font-bold py-4 uppercase tracking-widest hover:bg-[#8a1ccf] hover:shadow-[0_0_20px_#a020f0] transition-all flex items-center justify-center gap-2">
              <Shield size={18} /> Submit for Verification
            </button>
            <div className="text-center mt-4 text-xs text-[var(--text-blue)]">
              Already verified? <Link to="/login" className="text-[#a020f0] hover:underline">Access Terminal</Link>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

export default StudentRegister;