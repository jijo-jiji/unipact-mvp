import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, PartyPopper } from 'lucide-react';
import PublicNav from '../components/PublicNav';
import SiteFooter from '../components/SiteFooter';
import { submitLead } from '../utils/leads';
import { usePageTitle } from '../hooks/usePageTitle';

const EDUCATION_STATUSES = ['Foundation', 'Diploma', 'Degree', 'Master', 'PHD'];
const SEMESTERS = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];
const AVAILABILITY = ['Available now', 'Available next month', 'Available next semester'];

const PERKS = [
  'Get matched to real, paid work in your scope',
  'Build a verified talent record on every project you finish',
  'Bring classmates onto your team with a fair payout share',
];

const TRACKS = {
  software: {
    leadType: 'Student_SoftwareDev',
    pageTitle: 'Apply as a software development student',
    eyebrow: 'For students — software development',
    heading: 'Apply as a Software Development student.',
    intro: 'Tell us about your background. Once matched, you work on real client projects with a clear scope, deadline and payout.',
    formTitle: 'Software developer application',
    skills: ['React', 'Node.js', 'Python', 'Django', 'Flutter', 'Java', 'PHP', 'Vue', 'Databases'],
    projectTypes: ['Frontend', 'Backend', 'Full-stack', 'Mobile', 'No preference'],
    coursePlaceholder: 'e.g. Computer Science',
    portfolioLabel: 'GitHub profile or portfolio link',
    portfolioPlaceholder: 'https://github.com/yourname',
    experiencePlaceholder: 'e.g. Built a full-stack todo app with React and Node.js, deployed on Vercel.',
  },
  marketing: {
    leadType: 'Student_DigitalMarketing',
    pageTitle: 'Apply as a digital marketing student',
    eyebrow: 'For students — digital marketing / video',
    heading: 'Apply as a Digital Marketing / Video student.',
    intro: 'Tell us about your background. Once matched, you work on real client campaigns with a clear scope, deadline and payout.',
    formTitle: 'Digital marketing / video application',
    skills: ['Content Creation', 'Copywriting', 'Social Media Management', 'Video Editing', 'SEO', 'Analytics', 'Paid Ads', 'Community Management'],
    projectTypes: null,
    coursePlaceholder: 'e.g. Mass Communication',
    portfolioLabel: 'Portfolio or website link',
    portfolioPlaceholder: 'https://yourportfolio.com',
    experiencePlaceholder: 'e.g. Created social media content for a local e-commerce brand, growing their Instagram following by 40% in 3 months.',
  },
};

const EMPTY = {
  student_email: '', student_name: '', student_phone: '', institution: '', education_status: '',
  course: '', semester: '', skills: [], skills_other: '', project_type: '', portfolio_link: '',
  availability: '', experience: '',
};

const Field = ({ id, label, optional, children }) => (
  <div>
    <label htmlFor={id} className="label">
      {label} {optional && <span className="font-normal text-[#5B6478]">(optional)</span>}
    </label>
    {children}
  </div>
);

const StudentApplyPage = ({ track }) => {
  const config = TRACKS[track];
  usePageTitle(config.pageTitle);

  const [form, setForm] = useState(EMPTY);
  const [otherOpen, setOtherOpen] = useState(false);
  const [skillsError, setSkillsError] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleSkill = (skill) => setForm((prev) => ({
    ...prev,
    skills: prev.skills.includes(skill) ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // The browser cannot require "at least one of a checkbox group", so it is checked here.
    if (!form.skills.length && !form.skills_other.trim()) {
      setSkillsError(true);
      return;
    }
    setSkillsError(false);
    setSending(true);
    try {
      await submitLead({ ...form, lead_type: config.leadType, consent: 'Yes' });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('We could not send your application. Please try again, or email unipact.my@gmail.com.');
    } finally {
      setSending(false);
    }
  };

  const chip = (active) => `px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${active
    ? 'bg-[#00AEEF] border-[#00AEEF] text-white'
    : 'bg-white border-[rgba(10,23,72,0.15)] text-[#5B6478] hover:border-[#00AEEF]'}`;

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#5B6478] hover:text-[#0A1748] mb-8 py-1.5">
          <ArrowLeft size={16} /> Back to home
        </Link>

        {sent ? (
          <div className="card p-8 sm:p-12 max-w-2xl mx-auto text-center">
            <span className="w-14 h-14 rounded-full bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center mx-auto mb-5">
              <PartyPopper size={28} />
            </span>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl mb-3">Application received</h1>
            <p className="text-[#5B6478] mb-8">
              Thank you. We will be in touch at <strong className="text-[#0A1748]">{form.student_email}</strong> when there is a project that fits your skills.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/register/student" className="btn-primary px-6 py-3">Create your student account</Link>
              <Link to="/" className="btn-secondary px-6 py-3">Back to home</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-10 items-start">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow mb-3"><span className="eyebrow-dot" /> {config.eyebrow}</p>
              <h1 className="font-heading font-extrabold tracking-tight text-[clamp(1.85rem,4vw,2.5rem)] leading-tight mb-4">{config.heading}</h1>
              <p className="text-[#5B6478] leading-relaxed mb-7">{config.intro}</p>
              <ul className="space-y-3">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-sm"><CheckCircle2 size={18} className="text-[#00AEEF] shrink-0 mt-0.5" /> {perk}</li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5">
              <h2 className="font-heading font-bold text-xl">{config.formTitle}</h2>

              <Field id="student_email" label="Email address">
                <input id="student_email" type="email" required autoComplete="email" placeholder="you@example.com" value={form.student_email} onChange={set('student_email')} className="input" />
              </Field>

              <Field id="student_name" label="Full name">
                <input id="student_name" required autoComplete="name" placeholder="Jane Doe" value={form.student_name} onChange={set('student_name')} className="input" />
              </Field>

              <Field id="student_phone" label="Phone number (WhatsApp)">
                <input id="student_phone" type="tel" required autoComplete="tel" placeholder="+60 12-345 6789" value={form.student_phone} onChange={set('student_phone')} className="input" />
              </Field>

              <Field id="institution" label="Where do you study?">
                <input id="institution" required placeholder="e.g. Universiti Malaya" value={form.institution} onChange={set('institution')} className="input" />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field id="education_status" label="Education status">
                  <select id="education_status" required value={form.education_status} onChange={set('education_status')} className="input">
                    <option value="">Select…</option>
                    {EDUCATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field id="semester" label="Current semester">
                  <select id="semester" required value={form.semester} onChange={set('semester')} className="input">
                    <option value="">Select…</option>
                    {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <Field id="course" label="What course do you take?">
                <input id="course" required placeholder={config.coursePlaceholder} value={form.course} onChange={set('course')} className="input" />
              </Field>

              <fieldset>
                <legend className="label">What are your skills?</legend>
                <div className="flex flex-wrap gap-2 mt-1">
                  {config.skills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => { toggleSkill(skill); setSkillsError(false); }}
                      aria-pressed={form.skills.includes(skill)}
                      className={chip(form.skills.includes(skill))}
                    >
                      {skill}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setOtherOpen((v) => !v); if (otherOpen) setForm((p) => ({ ...p, skills_other: '' })); }}
                    aria-pressed={otherOpen}
                    className={chip(otherOpen)}
                  >
                    Other
                  </button>
                </div>
                {otherOpen && (
                  <input
                    id="skills_other"
                    placeholder="Type your other skills"
                    value={form.skills_other}
                    onChange={(e) => { set('skills_other')(e); setSkillsError(false); }}
                    className="input mt-3"
                    aria-label="Other skills"
                  />
                )}
                {skillsError && <p className="text-sm text-[#D14343] mt-2">Please pick at least one skill, or add your own under Other.</p>}
              </fieldset>

              {config.projectTypes && (
                <Field id="project_type" label="Preferred project type" optional>
                  <select id="project_type" value={form.project_type} onChange={set('project_type')} className="input">
                    <option value="">No preference</option>
                    {config.projectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              )}

              <Field id="portfolio_link" label={config.portfolioLabel} optional>
                <input id="portfolio_link" type="url" placeholder={config.portfolioPlaceholder} value={form.portfolio_link} onChange={set('portfolio_link')} className="input" />
              </Field>

              <Field id="availability" label="Availability">
                <select id="availability" required value={form.availability} onChange={set('availability')} className="input">
                  <option value="">Select…</option>
                  {AVAILABILITY.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>

              <Field id="experience" label="Describe a project or work you've done" optional>
                <textarea id="experience" rows={4} placeholder={config.experiencePlaceholder} value={form.experience} onChange={set('experience')} className="input" />
              </Field>

              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" required className="mt-0.5 w-4 h-4 accent-[#00AEEF]" />
                <span>
                  I agree UniPact may share my profile with verified companies, and to the{' '}
                  <Link to="/privacy" className="text-[#0090C6] underline">Privacy Policy</Link>.
                </span>
              </label>

              {error && <p className="text-sm text-[#D14343]">{error}</p>}

              <button type="submit" disabled={sending} className="btn-primary w-full py-3.5 disabled:opacity-60">
                {sending ? <><Loader2 size={17} className="animate-spin" /> Sending…</> : 'Submit application'}
              </button>
              <p className="text-xs text-[#5B6478] text-center">
                Already applied? <Link to="/register/student" className="text-[#0090C6] underline">Create your student account</Link> to finish setting up your profile.
              </p>
            </form>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export const SoftwareDeveloperApplyPage = () => <StudentApplyPage track="software" />;
export const DigitalMarketingApplyPage = () => <StudentApplyPage track="marketing" />;
