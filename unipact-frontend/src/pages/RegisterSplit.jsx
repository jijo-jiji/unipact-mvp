import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Briefcase, GraduationCap, ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import PublicNav from '../components/PublicNav';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/routes';

const OPTIONS = [
  {
    to: '/register/company',
    icon: Briefcase,
    eyebrow: 'For companies & SMEs',
    title: "I'm hiring talent",
    text: 'Post projects and get a curated team of verified students.',
    points: [
      'Post software and marketing projects for free',
      'Review and confirm admin-curated student teams',
      'Share briefs, brand assets and raw footage',
      "Pay a finder's fee only when you confirm a match",
    ],
    cta: 'Create a client account',
    iconClass: 'bg-[#0B1E63] text-[#00AEEF]',
  },
  {
    to: '/register/student',
    icon: GraduationCap,
    eyebrow: 'For university students',
    title: "I'm a student",
    text: 'Work on paid client projects and build a verified portfolio.',
    points: [
      'Get matched to paid, real-world projects',
      'Invite classmates to join your project team',
      'Earn client ratings on completed work',
      'Share a public portfolio with employers',
    ],
    cta: 'Create a student account',
    iconClass: 'bg-[#00AEEF] text-white',
  },
];

const RegisterSplit = () => {
  const { user } = useAuth();

  // Signed-in users don't need to pick an account type again
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-12 sm:py-16 animate-fade-in">
        <div className="text-center mb-10">
          <p className="eyebrow mb-3 justify-center"><span className="eyebrow-dot" /> Create your free account</p>
          <h1 className="font-heading font-extrabold tracking-tight text-[clamp(2rem,4vw,2.75rem)] mb-3">How will you use UniPact?</h1>
          <p className="text-[#5B6478] text-base sm:text-lg max-w-xl mx-auto">Choose the account type that fits you. It only takes a couple of minutes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {OPTIONS.map(({ to, icon, eyebrow, title, text, points, cta, iconClass }) => (
            <Link
              key={to}
              to={to}
              className="group card p-7 sm:p-8 flex flex-col hover:border-[#00AEEF] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]"
            >
              <span className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-sm ${iconClass}`}>
                {React.createElement(icon, { size: 28 })}
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#0090C6]">{eyebrow}</span>
              <h2 className="font-heading font-bold text-2xl mt-1 mb-2 group-hover:text-[#0090C6] transition-colors">{title}</h2>
              <p className="text-[#5B6478] mb-5">{text}</p>
              <ul className="space-y-2.5 text-sm mb-8">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-[#00AEEF] shrink-0 mt-0.5" /> {point}
                  </li>
                ))}
              </ul>
              <span className="btn-primary w-full mt-auto py-3">
                {cta} <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>

        <div className="flex items-start gap-2.5 p-4 rounded-lg bg-white border border-[rgba(10,23,72,0.12)] text-sm text-[#5B6478] max-w-2xl mx-auto">
          <Info size={16} className="text-[#00AEEF] shrink-0 mt-0.5" />
          <span><strong className="text-[#0A1748]">Student clubs:</strong> club sponsorships are being rolled out gradually. Club members can register individually as students and add their club to their profile.</span>
        </div>

        <p className="text-center text-sm text-[#5B6478] mt-8">
          Already have an account?{' '}
          <Link to="/login" className="inline-block py-2 font-semibold text-[#0090C6] hover:underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
};

export default RegisterSplit;
