import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, ShieldCheck, Code2, GraduationCap, CheckCircle2, Star, Share2 } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import PageLoader from '../components/PageLoader';
import { campaignTypeLabel, domainLabel, formatDate } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const StudentProfile = () => {
  usePageTitle('Student portfolio');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/student/${id}/profile/`);
        setProfile(res.data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  const isOwnProfile = profile && user?.id === profile.user_id;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Portfolio link copied.', 'success');
    } catch {
      showToast('Copy the link from your browser address bar.', 'info');
    }
  };

  if (loading) return <PageLoader message="Loading portfolio…" />;

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] font-body">
        <WorkspaceNav />
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <GraduationCap size={48} className="text-[#5B6478]/40 mb-3" />
          <h1 className="font-heading font-bold text-xl mb-2">Portfolio not found</h1>
          <p className="text-sm text-[#5B6478] mb-6">This student profile doesn&apos;t exist or is no longer available.</p>
          <button onClick={() => navigate(-1)} className="btn-navy">Go back</button>
        </div>
      </div>
    );
  }

  const projects = profile.completed_projects || [];

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />

      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6 flex-1">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="back-link">
            <ArrowLeft size={15} /> Back
          </button>
          <button onClick={copyLink} className="btn-secondary btn-sm"><Share2 size={14} /> Copy link</button>
        </div>

        <section className="card p-6 sm:p-10 flex flex-col md:flex-row gap-8 items-start">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#0B1E63] flex items-center justify-center shrink-0 shadow-md">
            <span className="font-heading font-extrabold text-4xl text-[#00AEEF]">{profile.full_name?.charAt(0)}</span>
          </div>

          <div className="flex-1 min-w-0">
            {isOwnProfile && <p className="eyebrow mb-1"><span className="eyebrow-dot" /> Your public portfolio</p>}
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">{profile.full_name}</h1>
              {profile.verification_status === 'VERIFIED' ? (
                <span className="badge bg-emerald-50 border-emerald-200 text-emerald-700"><ShieldCheck size={13} /> Verified student</span>
              ) : (
                <span className="badge bg-amber-50 border-amber-200 text-amber-800">Verification pending</span>
              )}
            </div>
            <p className="text-[#5B6478] mb-4">
              {[profile.university, profile.major].filter(Boolean).join(' • ')}
              {profile.club_affiliation_name && <span className="block sm:inline sm:ml-2 text-[#0B1E63] font-medium">{profile.club_affiliation_role || 'Member'}, {profile.club_affiliation_name}</span>}
            </p>
            {profile.bio && <p className="text-sm leading-relaxed mb-6 max-w-2xl">{profile.bio}</p>}

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-[#F5F7FC] p-3 rounded-lg">
                <dt className="text-xs text-[#5B6478]">Track</dt>
                <dd className="font-semibold text-[#0B1E63]">{domainLabel(profile.domain_focus)}</dd>
              </div>
              <div className="bg-[#F5F7FC] p-3 rounded-lg">
                <dt className="text-xs text-[#5B6478]">Client rating</dt>
                <dd className="font-semibold text-amber-600 inline-flex items-center gap-1"><Star size={14} className="fill-amber-400 text-amber-400" /> {profile.rating}</dd>
              </div>
              <div className="bg-[#F5F7FC] p-3 rounded-lg">
                <dt className="text-xs text-[#5B6478]">Completed projects</dt>
                <dd className="font-semibold text-emerald-600">{projects.length}</dd>
              </div>
            </dl>
          </div>
        </section>

        {profile.skills?.length > 0 && (
          <section className="card p-6 sm:p-8">
            <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2"><Code2 size={20} className="text-[#00AEEF]" /> Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span key={skill} className="px-3 py-1.5 rounded-md text-sm font-medium bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)]">{skill}</span>
              ))}
            </div>
          </section>
        )}

        <section className="card p-6 sm:p-8">
          <h2 className="font-heading font-bold text-lg mb-6 flex items-center gap-2"><Briefcase size={20} className="text-[#00AEEF]" /> Completed client projects</h2>
          {projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((proj) => (
                <article key={proj.id} className="p-5 rounded-lg border border-[rgba(10,23,72,0.08)] bg-[#F5F7FC]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                    <h3 className="font-heading font-bold text-base">{proj.title}</h3>
                    <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 self-start sm:self-auto"><CheckCircle2 size={12} /> Completed</span>
                  </div>
                  <p className="text-sm text-[#5B6478] mb-3">{proj.company_name} · {campaignTypeLabel(proj.type)} · {formatDate(proj.completed_at)}</p>
                  {proj.requirements?.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {proj.requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-2"><CheckCircle2 size={14} className="text-[#00AEEF] shrink-0 mt-0.5" /> {r}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-[#5B6478] bg-[#F5F7FC] rounded-lg">
              {isOwnProfile ? 'Projects you complete for clients will be showcased here automatically.' : 'No completed projects yet.'}
            </p>
          )}
        </section>
      </main>
    </div>
  );
};

export default StudentProfile;
