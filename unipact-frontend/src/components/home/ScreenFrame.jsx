import React from 'react';

// A 4:3 screenshot of the app in a plain frame. The front page's screenshots are all this shape
// (see components/home/content.js), so swapping one for another never moves the layout.
const ScreenFrame = ({ src, alt, className = '' }) => (
  <div className={`rounded-xl bg-white border border-[rgba(10,23,72,0.12)] shadow-[0_24px_50px_-28px_rgba(10,23,72,0.35)] overflow-hidden ${className}`}>
    <img src={src} alt={alt} width="1280" height="960" loading="lazy" decoding="async" className="block w-full h-auto aspect-[4/3] object-cover" />
  </div>
);

export default ScreenFrame;
