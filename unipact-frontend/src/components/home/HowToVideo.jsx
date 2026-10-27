import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import Modal from '../Modal';
import AudienceSwitch from './AudienceSwitch';
import { VIDEOS } from './content';

const prefersStill = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// The one-minute walk-through, filmed on the app with demo data. Nothing loads until it's opened; it
// starts playing then, from the beginning, since opening it is asking to watch (not for readers who
// prefer reduced motion, who press play themselves). There's no sound: each step's caption is part of
// the picture.
export const HowToVideo = ({ audience, onAudience, onClose }) => {
  const videoRef = useRef(null);
  const video = audience ? VIDEOS[audience] : null;

  useEffect(() => {
    if (!video || prefersStill()) return;
    videoRef.current?.play().catch(() => {});
  }, [video]);

  return (
    <Modal isOpen={Boolean(video)} onClose={onClose} title="How UniPact works" maxWidth="max-w-5xl">
      {video && (
        <>
          <div className="mb-4">
            <AudienceSwitch audience={audience} onAudience={onAudience} label="Show the video for" />
          </div>
          <video
            key={audience}
            ref={videoRef}
            src={video.src}
            poster={video.poster}
            controls
            playsInline
            preload="none"
            aria-label={video.label}
            className="block w-full aspect-video rounded-lg bg-[#E4F1F9]"
          />
        </>
      )}
    </Modal>
  );
};

// "Prefer to watch?": a card above the steps with a small, silent copy of the video playing on a loop.
// The copy loads only once it's near the screen (a 640px version, not the full one), plays only while on
// screen and while the full video is closed, and stays still for readers who prefer reduced motion.
// Clicking the card opens the full video.
export const VideoPreview = ({ audience, paused, onOpen, className = '' }) => {
  const boxRef = useRef(null);
  const videoRef = useRef(null);
  // without IntersectionObserver (very old browsers), it just loads and plays
  const [near, setNear] = useState(() => !('IntersectionObserver' in window));
  const [onScreen, setOnScreen] = useState(() => !('IntersectionObserver' in window));
  const video = VIDEOS[audience];

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setOnScreen(entry.isIntersecting);
      if (entry.isIntersecting) setNear(true);
    }, { rootMargin: '200px' });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !near) return;
    if (onScreen && !paused && !prefersStill()) el.play().catch(() => {});
    else el.pause();
  }, [near, onScreen, paused, audience]);

  return (
    <button
      ref={boxRef}
      type="button"
      onClick={onOpen}
      className={`group w-full flex items-center gap-4 sm:gap-5 p-2.5 pr-4 rounded-xl bg-white border border-[rgba(10,23,72,0.12)] text-left transition-[border-color,box-shadow] hover:border-[#00AEEF] hover:shadow-[0_10px_28px_rgba(10,23,72,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] focus-visible:ring-offset-2 ${className}`}
    >
      <span className="relative shrink-0 w-[44%] max-w-[208px] aspect-video rounded-lg overflow-hidden bg-[#E4F1F9]">
        <video
          key={audience}
          ref={videoRef}
          src={near ? video.preview : undefined}
          poster={video.poster}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </span>
      <span className="min-w-0">
        <span className="block font-heading font-bold text-lg leading-snug text-[#0A1748]">Prefer to watch?</span>
        <span className="block text-sm text-[#5B6478] mt-1">
          All five steps {audience === 'student' ? 'for students' : 'for clients'}, in about a minute.
        </span>
        <span className="mt-2.5 inline-flex items-center gap-2 text-sm font-semibold text-[#0A1748]">
          <span className="w-6 h-6 rounded-full bg-[#00AEEF] text-[#0A1748] flex items-center justify-center group-hover:bg-[#0090C6] transition-colors" aria-hidden="true">
            <Play size={11} fill="currentColor" className="ml-0.5" />
          </span>
          <span className="underline-offset-4 group-hover:underline">Watch the video</span>
        </span>
      </span>
    </button>
  );
};

// "Watch how it works" in the hero: a cyan play button and its label
export const WatchButton = ({ onClick, children, className = '' }) => (
  <button type="button" onClick={onClick} className={`group inline-flex items-center gap-3 py-1 font-semibold text-[#0A1748] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] rounded-md ${className}`}>
    <span className="w-8 h-8 rounded-full bg-[#00AEEF] text-[#0A1748] flex items-center justify-center group-hover:bg-[#0090C6] transition-colors" aria-hidden="true">
      <Play size={14} fill="currentColor" className="ml-0.5" />
    </span>
    <span className="underline-offset-4 group-hover:underline">{children}</span>
  </button>
);
