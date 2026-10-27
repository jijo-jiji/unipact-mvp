import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { TOUR } from './content';
import ScreenFrame from './ScreenFrame';
import AudienceSwitch from './AudienceSwitch';
import { VideoPreview } from './HowToVideo';

// Five steps for each side of a project. Picking a step opens its description and shows its screen:
// beside the list on wide screens, under the step on phones. The same steps play in a small video above
// the list, which opens the full one.
const HowItWorks = ({ audience, step, onAudience, onStep, onWatch, videoOpen, signedIn }) => {
  const tour = TOUR[audience];

  return (
    <section id="how-it-works" className="scroll-mt-[128px] py-16 sm:py-24">
      {/* Targets for links from elsewhere, e.g. /#for-students */}
      <span id="for-clients" className="block scroll-mt-[192px] sm:scroll-mt-[224px]" aria-hidden="true" />
      <span id="for-students" className="block scroll-mt-[192px] sm:scroll-mt-[224px]" aria-hidden="true" />

      <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
          <div className="max-w-[640px]">
            <h2 className="font-heading font-bold tracking-[-0.5px] text-[clamp(2rem,3.4vw,2.75rem)] text-balance">How UniPact works</h2>
            <p className="text-[#5B6478] text-base sm:text-lg mt-3">
              Five steps from brief to paid work. Pick one to see its screen.
            </p>
          </div>
          <AudienceSwitch audience={audience} onAudience={onAudience} label="Show the steps for" />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 lg:gap-14 items-start">
          <div>
            {/* The same steps as a video, for readers who'd rather watch than click through */}
            <VideoPreview audience={audience} paused={videoOpen} onOpen={onWatch} className="mb-8" />
            <ol className="border-t border-[rgba(10,23,72,0.1)]">
              {tour.steps.map((s, i) => {
                const open = i === step;
                return (
                  <li key={s.title} className="border-b border-[rgba(10,23,72,0.1)]">
                    <button
                      type="button"
                      onClick={() => onStep(i)}
                      aria-expanded={open}
                      aria-controls={`tour-step-${i}`}
                      className="relative w-full flex items-center gap-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] rounded-sm"
                    >
                      <span className={`absolute -left-px top-3 bottom-3 w-[3px] rounded-full ${open ? 'bg-[#00AEEF]' : 'bg-transparent'}`} aria-hidden="true" />
                      <span className={`ml-4 w-8 h-8 shrink-0 rounded-md flex items-center justify-center text-sm font-bold ${open ? 'bg-[#0A1748] text-white' : 'bg-white border border-[rgba(10,23,72,0.15)] text-[#5B6478]'}`}>
                        {i + 1}
                      </span>
                      <span className={`font-heading font-bold text-lg ${open ? 'text-[#0A1748]' : 'text-[#5B6478]'}`}>{s.title}</span>
                    </button>
                    <div id={`tour-step-${i}`} hidden={!open} className="pl-16 pr-2 pb-5 -mt-1">
                      <p className="text-[#5B6478] leading-relaxed">{s.text}</p>
                      <div className="lg:hidden mt-5 -ml-12 sm:ml-0">
                        <ScreenFrame src={s.image} alt={s.alt} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* All five screens sit on top of each other, so changing step cross-fades without a wait */}
          <div className="hidden lg:grid lg:sticky lg:top-[150px]">
            {tour.steps.map((s, i) => (
              <ScreenFrame
                key={s.image}
                src={s.image}
                alt={i === step ? s.alt : ''}
                className={`[grid-area:1/1] transition-opacity duration-300 motion-reduce:transition-none ${i === step ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              />
            ))}
          </div>
        </div>

        {!signedIn && (
          <div className="mt-10 sm:mt-12 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link to={tour.cta.to} className="btn-navy px-6 py-3 text-base">
              {tour.cta.label} <ArrowRight size={17} />
            </Link>
            <Link to="/login" className="text-sm font-semibold text-[#0B1E63] underline decoration-[#00AEEF] decoration-2 underline-offset-4 hover:text-[#00729F]">
              Already have an account? Sign in
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default HowItWorks;
