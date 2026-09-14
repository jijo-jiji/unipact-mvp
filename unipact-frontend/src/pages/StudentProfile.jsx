import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Download,
  Star,
  Briefcase,
  Award,
  ShieldCheck,
  Code2,
  Share2,
  GraduationCap,
  ExternalLink,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import api from '../api/client';

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/users/student/${id || 1}/profile/`);
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to load student profile", err);
        setError("Student profile could not be retrieved.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center text-[#5B6478] text-sm font-body">
        Loading Student Portfolio...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex flex-col items-center justify-center p-6 text-center font-body">
        <GraduationCap size={48} className="text-[#5B6478]/40 mb-3" />
        <h2 className="font-heading font-bold text-xl text-[#0A1748] mb-2">Student Profile Not Found</h2>
        <p className="text-xs text-[#5B6478] mb-6">The requested talent showcase is either private or unavailable.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-md bg-[#0B1E63] text-white text-xs font-semibold"
        >
          Return Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col selection:bg-[#00AEEF] selection:text-white">

      {/* Top Bar */}
      <nav className="h-[76px] bg-[#F5F7FC]/90 backdrop-blur-md border-b border-[rgba(10,23,72,0.08)] flex items-center px-6 lg:px-12">
        <div className="max-w-[1160px] w-full mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center font-heading font-extrabold text-xl shadow-sm">
              UP
            </div>
            <div>
              <span className="font-heading font-extrabold text-xl text-[#0A1748] tracking-tight block leading-none">
                Uni<span className="text-[#00AEEF]">Pact</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-[#5B6478] uppercase">
                Verified Portfolio
              </span>
            </div>
          </Link>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#5B6478] hover:text-[#0A1748] transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-[1160px] w-full mx-auto px-6 py-10 space-y-8 flex-1">

        {/* Hero Card */}
        <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-10 shadow-sm flex flex-col md:flex-row gap-8 items-start">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#0B1E63] text-white flex items-center justify-center shrink-0 shadow-md">
            <GraduationCap size={56} className="text-[#00AEEF]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0A1748]">
                {profile.full_name}
              </h1>
              {profile.verification_status === 'VERIFIED' ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <ShieldCheck size={14} className="text-emerald-600" /> VERIFIED TALENT
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  Pending Verification
                </span>
              )}
            </div>

            <p className="text-[#5B6478] text-sm sm:text-base mb-4">
              {profile.university} • {profile.major}
              {profile.club_affiliation_name && (
                <span className="block sm:inline sm:ml-2 font-medium text-[#0B1E63]">
                  [{profile.club_affiliation_role || 'Member'}, {profile.club_affiliation_name}]
                </span>
              )}
            </p>

            {profile.bio && (
              <p className="text-xs sm:text-sm text-[#0A1748] leading-relaxed mb-6 max-w-2xl bg-[#F5F7FC] p-4 rounded-lg border border-[rgba(10,23,72,0.06)]">
                "{profile.bio}"
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-[#F5F7FC] p-3 rounded-lg border border-[rgba(10,23,72,0.06)]">
                <span className="text-[#5B6478] block text-[10px] uppercase font-bold">Track Focus</span>
                <span className="font-heading font-bold text-sm text-[#0B1E63]">
                  {profile.domain_focus === 'SOFTWARE_DEV' ? 'Software Dev' : 'Marketing'}
                </span>
              </div>
              <div className="bg-[#F5F7FC] p-3 rounded-lg border border-[rgba(10,23,72,0.06)]">
                <span className="text-[#5B6478] block text-[10px] uppercase font-bold">Client Rating</span>
                <span className="font-heading font-bold text-sm text-amber-600 flex items-center gap-1">
                  {profile.rating || '5.0'} ★
                </span>
              </div>
              <div className="bg-[#F5F7FC] p-3 rounded-lg border border-[rgba(10,23,72,0.06)]">
                <span className="text-[#5B6478] block text-[10px] uppercase font-bold">Completed Orders</span>
                <span className="font-heading font-bold text-sm text-emerald-600">
                  {profile.completed_projects?.length || 0}
                </span>
              </div>
              <div className="bg-[#F5F7FC] p-3 rounded-lg border border-[rgba(10,23,72,0.06)]">
                <span className="text-[#5B6478] block text-[10px] uppercase font-bold">Status</span>
                <span className="font-heading font-bold text-sm text-[#00AEEF]">
                  Available for Match
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verified Skills Section */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-8 shadow-sm">
            <h3 className="font-heading font-bold text-lg text-[#0A1748] mb-4 flex items-center gap-2">
              <Code2 size={20} className="text-[#00AEEF]" /> Verified Technical & Creative Competencies
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, sIdx) => (
                <span
                  key={sIdx}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] text-[#0A1748]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Verified Project Showcase */}
        <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-8 shadow-sm">
          <h3 className="font-heading font-bold text-lg text-[#0A1748] mb-6 flex items-center gap-2">
            <Briefcase size={20} className="text-[#00AEEF]" /> Verified Enterprise Projects & Outcomes
          </h3>

          {profile.completed_projects && profile.completed_projects.length > 0 ? (
            <div className="space-y-6">
              {profile.completed_projects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-5 rounded-lg border border-[rgba(10,23,72,0.08)] bg-[#F5F7FC]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h4 className="font-heading font-bold text-base text-[#0A1748]">{proj.title}</h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                      Completed & Approved
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6478] mb-3">Client: <strong className="text-[#0A1748]">{proj.company_name}</strong></p>
                  {proj.requirements && proj.requirements.length > 0 && (
                    <ul className="text-xs text-[#0A1748] space-y-1">
                      {proj.requirements.map((r, rIdx) => (
                        <li key={rIdx} className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-[#00AEEF] shrink-0" /> {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#5B6478] bg-[#F5F7FC] rounded-lg border border-[rgba(10,23,72,0.06)]">
              This student is currently executing active project orders. Verified showcase items will appear here once milestones are completed and rated by clients.
            </div>
          )}
        </div>

      </main>

      <footer className="mt-auto border-t border-[rgba(10,23,72,0.08)] bg-white py-8 px-6 text-center text-xs text-[#5B6478]">
        UniPact Enterprise Talent Platform • Built to STYLE_GUIDE.md
      </footer>
    </div>
  );
};

export default StudentProfile;
