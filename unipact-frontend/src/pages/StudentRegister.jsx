import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, AlertCircle, ArrowRight, Loader2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import { MALAYSIAN_UNIVERSITIES } from '../utils/constants';
import TermsConsent from '../components/TermsConsent';
import { usePageTitle } from '../hooks/usePageTitle';

const StudentRegister = () => {
  usePageTitle('Join as a student');
  const navigate = useNavigate();
  const { registerStudent } = useAuth();

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
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Please choose a password with at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      ['email', 'password', 'full_name', 'university', 'major', 'domain_focus', 'bio', 'club_affiliation_name', 'club_affiliation_role']
        .forEach((key) => {
          const value = formData[key].trim ? formData[key].trim() : formData[key];
          if (value || key === 'major') payload.append(key, value);
        });

      const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(Boolean);
      payload.append('skills', JSON.stringify(skillsArray));
      if (docFile) payload.append('verification_doc', docFile);
      payload.append('accept_terms', acceptTerms ? 'true' : 'false');

      // Registration signs the user in (HttpOnly cookies) and updates auth state
      await registerStudent(payload);
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center shadow-sm shrink-0">
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 className="font-heading font-bold text-2xl tracking-tight">Join as student talent</h1>
            <p className="text-sm text-[#5B6478] mt-0.5">Get matched to paid, real-world projects in software development and digital marketing.</p>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-2.5 bg-[#00AEEF]/5 border border-[#00AEEF]/20 p-3.5 rounded-lg text-sm">
          <Info size={16} className="text-[#00AEEF] shrink-0 mt-0.5" />
          <span>After you sign up, a UniPact admin verifies your student status. Uploading your student ID below speeds this up.</span>
        </div>

        {error && (
          <div className="alert-error mb-6" role="alert">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" required autoComplete="name" value={formData.full_name} onChange={handleChange} placeholder="e.g. Sarah Tan Shu Min" className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="domain_focus">Main track</label>
              <select id="domain_focus" name="domain_focus" value={formData.domain_focus} onChange={handleChange} className="input">
                <option value="SOFTWARE_DEV">Software development</option>
                <option value="MARKETING">Digital marketing</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input id="email" type="email" name="email" required autoComplete="email" value={formData.email} onChange={handleChange} placeholder="you@siswa.um.edu.my" className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input id="password" type="password" name="password" required minLength={8} autoComplete="new-password" value={formData.password} onChange={handleChange} placeholder="At least 8 characters" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="university">University</label>
              <select id="university" name="university" value={formData.university} onChange={handleChange} className="input">
                {MALAYSIAN_UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="major">Course / major</label>
              <input id="major" name="major" required value={formData.major} onChange={handleChange} placeholder="e.g. BSc Computer Science" className="input" />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="skills">Skills</label>
            <input id="skills" name="skills" required value={formData.skills} onChange={handleChange} placeholder="React, Django, Figma, TikTok editing" className="input" />
            <p className="field-hint">Separate skills with commas. These help admins match you to the right projects.</p>
          </div>

          <div>
            <label className="field-label" htmlFor="bio">Short bio (optional)</label>
            <textarea id="bio" name="bio" rows={3} value={formData.bio} onChange={handleChange} placeholder="What kind of projects are you great at?" className="input" />
          </div>

          <fieldset className="p-4 bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg">
            <legend className="text-sm font-semibold px-1">Club or society (optional)</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              <div>
                <label className="text-xs text-[#5B6478] block mb-1" htmlFor="club_affiliation_name">Club name</label>
                <input id="club_affiliation_name" name="club_affiliation_name" value={formData.club_affiliation_name} onChange={handleChange} placeholder="e.g. UM Coding Society" className="input bg-white" />
              </div>
              <div>
                <label className="text-xs text-[#5B6478] block mb-1" htmlFor="club_affiliation_role">Your role</label>
                <input id="club_affiliation_role" name="club_affiliation_role" value={formData.club_affiliation_role} onChange={handleChange} placeholder="e.g. Tech lead" className="input bg-white" />
              </div>
            </div>
          </fieldset>

          <div>
            <label className="field-label" htmlFor="verification_doc">Student ID or enrolment letter (optional)</label>
            <input id="verification_doc" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="input file:mr-3 file:rounded file:border-0 file:bg-[#0B1E63] file:text-white file:px-3 file:py-1 file:text-xs" />
            <p className="field-hint">PDF, PNG or JPG.</p>
          </div>

          <TermsConsent checked={acceptTerms} onChange={setAcceptTerms} />

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating your account…</> : <>Create student account <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[rgba(10,23,72,0.08)] text-center text-sm text-[#5B6478]">
          Already registered?{' '}
          <Link to="/login" className="inline-block py-2 font-semibold text-[#0090C6] hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
