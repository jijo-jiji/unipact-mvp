import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutDashboard } from 'lucide-react';

// The two renders of the hero picture (hero-render/README.md): "level", with the camera slightly below,
// and "topdown", looking down onto the stand like Microsoft's Outlook picture. Each is sized to fill
// the panel at every width without running off the screen; the top-down one is squarer, so it's
// narrower. To switch, change HERO below.
const RENDERS = {
  level: {
    name: 'hero-level',
    height: 1034,
    box: 'aspect-[5/4] sm:aspect-[16/11] lg:aspect-auto lg:h-[520px]',
    size: 'w-full lg:w-[104%] xl:w-[116%] min-[1440px]:w-[124%]',
    sizes: '(min-width: 1440px) 650px, (min-width: 1280px) 610px, (min-width: 1024px) 474px, 92vw',
  },
  topdown: {
    name: 'hero-topdown',
    height: 1278,
    box: 'aspect-[10/9] sm:aspect-[4/3] lg:aspect-auto lg:h-[560px]',
    size: 'w-[96%] sm:w-[78%] lg:w-[102%] xl:w-[108%] min-[1440px]:w-[112%]',
    sizes: '(min-width: 1440px) 590px, (min-width: 1280px) 566px, (min-width: 1024px) 466px, (min-width: 640px) 78vw, 92vw',
  },
};
const HERO = RENDERS.level;

// The product as a 3D render: the client's project page in a browser window and the project's
// conversation on the student's phone, standing on a stand, with two moments from the project floating
// in front. Rendered in Blender with a transparent background, so it sits on the pale panel, which runs
// off the right edge on wide layouts.
const HeroVisual = () => (
  <div className={`relative w-full ${HERO.box}`}>
    <div className="absolute inset-0 lg:-right-[50vw] rounded-[24px] lg:rounded-r-none bg-[#E4F1F9]" aria-hidden="true" />
    <img
      src={`/home/${HERO.name}-1400.webp`}
      srcSet={`/home/${HERO.name}-700.webp 700w, /home/${HERO.name}-1400.webp 1400w`}
      sizes={HERO.sizes}
      width="1400"
      height={HERO.height}
      fetchPriority="high"
      alt="UniPact on a laptop and a phone: the client's project page shows a milestone waiting for approval, and the student's phone shows the project's conversation with the client."
      className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 max-w-none h-auto lg:left-0 lg:translate-x-0 ${HERO.size}`}
    />
  </div>
);

const HomeHero = ({ dashboardPath }) => (
  <section id="overview" className="relative overflow-hidden scroll-mt-[76px]">
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8 pt-10 pb-14 sm:pt-14 lg:pt-16 lg:pb-20 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-12 lg:gap-12 items-center">
      <div>
        <h1 className="font-heading font-bold tracking-[-0.03em] leading-[1.06] text-[clamp(2.5rem,4.3vw,3.6rem)] mb-6">
          Your brief, matched.
          <br />
          Your work, delivered.
        </h1>
        <p className="text-[#5B6478] text-lg leading-relaxed max-w-[34rem] mb-8">
          Post a software or marketing project, get a team of verified university students within 48 hours, and follow
          every milestone in one place. Your fee waits in escrow until you approve the work.
        </p>

        {dashboardPath ? (
          <Link to={dashboardPath} className="btn-navy px-6 py-3 text-base rounded-md">
            <LayoutDashboard size={18} /> Go to your dashboard
          </Link>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Link to="/register/company" className="btn-navy px-6 py-3 text-base rounded-md">Post a project</Link>
              <Link to="/login" className="btn px-6 py-3 text-base rounded-md border-2 border-[#0A1748] text-[#0A1748] hover:bg-[#0A1748] hover:text-white">
                Sign in
              </Link>
            </div>
            <Link to="/register/student" className="group mt-7 inline-flex items-center gap-3 py-1 font-semibold text-[#0A1748]">
              <span className="w-7 h-7 rounded-md bg-[#0B1E63] text-white flex items-center justify-center group-hover:bg-[#00AEEF] group-hover:text-[#0A1748] transition-colors">
                <ChevronRight size={16} />
              </span>
              <span className="underline-offset-4 group-hover:underline">Student? Create a free account</span>
            </Link>
          </>
        )}
      </div>

      <HeroVisual />
    </div>
  </section>
);

export default HomeHero;
