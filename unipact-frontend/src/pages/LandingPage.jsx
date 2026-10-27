import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import SiteFooter from '../components/SiteFooter';
import AnnouncementBar from '../components/home/AnnouncementBar';
import HomeHero from '../components/home/HomeHero';
import SectionNav from '../components/home/SectionNav';
import HowItWorks from '../components/home/HowItWorks';
import { HowToVideo } from '../components/home/HowToVideo';
import { ClosingCta, HomeFaq, PaymentsSection, WorkspaceSection } from '../components/home/HomeSections';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/routes';

// The app's front page: how clients and students use UniPact, step by step, on real screens.
// The marketing site (www.unipact.my) sells the service to clients; this page shows how it works.

// On phones the page's section menu scrolls away, so the top bar's menu carries the same links
const MENU_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#workspace', label: 'Your workspace' },
  { href: '#payments', label: 'Payments' },
  { href: '#faq', label: 'FAQ' },
];

const MESSAGES_STEP = 3; // "Follow the work and talk to your team", in the client tour

const LandingPage = () => {
  const { user } = useAuth();
  const { hash } = useLocation();
  const dashboardPath = user ? homePathForRole(user.role) : null;

  // Which side of the tour is showing, and which step. A link to /#for-students opens the students' side.
  const [tour, setTour] = useState(() => ({ audience: hash === '#for-students' ? 'student' : 'client', step: 0 }));
  const showAudience = (audience) => setTour((t) => (t.audience === audience ? t : { audience, step: 0 }));
  const showStep = (step) => setTour((t) => ({ ...t, step }));
  // The walk-through video's side while it's open (null when closed); switching it switches the page too
  const [video, setVideo] = useState(null);
  const watch = () => setVideo(tour.audience);
  const showVideo = (audience) => {
    setVideo(audience);
    showAudience(audience);
  };

  const cta = dashboardPath
    ? { to: dashboardPath, label: 'Go to dashboard' }
    : tour.audience === 'student'
      ? { to: '/register/student', label: 'Join as a student' }
      : { to: '/register/company', label: 'Post a project' };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <AnnouncementBar onOpen={() => setTour({ audience: 'client', step: MESSAGES_STEP })} />
      <PublicNav links={MENU_LINKS} inlineLinks={false} />

      <main className="flex-1">
        <HomeHero dashboardPath={dashboardPath} onWatch={watch} />
        <SectionNav audience={tour.audience} onAudience={showAudience} cta={cta} />
        <HowItWorks
          audience={tour.audience}
          step={tour.step}
          onAudience={showAudience}
          onStep={showStep}
          onWatch={watch}
          videoOpen={video !== null}
          signedIn={Boolean(user)}
        />
        <WorkspaceSection />
        <PaymentsSection />
        <HomeFaq audience={tour.audience} onAudience={showAudience} />
        <ClosingCta dashboardPath={dashboardPath} />
      </main>

      <SiteFooter />
      <HowToVideo audience={video} onAudience={showVideo} onClose={() => setVideo(null)} />
    </div>
  );
};

export default LandingPage;
