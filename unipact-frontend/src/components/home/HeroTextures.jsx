import React from 'react';
import { ApprovedCard, BrowserBar, DesktopScreen, MessageCard, PhoneScreen } from './HeroScreens';

// Development only (/dev/hero-textures): the hero picture's screens and cards laid out flat, each at the
// size the Blender scene expects, for hero-render/capture-textures.cjs to capture. Not part of the
// production build.
const HeroTextures = () => (
  <div className="p-10 flex flex-col items-start gap-10">
    <div data-texture="window" className="w-[560px] h-[382px] rounded-[16px] overflow-hidden bg-[#F5F7FC]">
      <BrowserBar />
      <DesktopScreen />
    </div>
    <div data-texture="phone" className="w-[166px] h-[360px] rounded-[24px] overflow-hidden bg-[#F5F7FC]">
      <PhoneScreen />
    </div>
    <div data-texture="card-approved" className="flex items-center gap-3 w-max px-4 py-3 rounded-[14px] bg-white border border-[rgba(10,23,72,0.08)]">
      <ApprovedCard />
    </div>
    <div data-texture="card-message" className="flex items-start gap-2.5 w-[250px] px-3.5 py-3 rounded-[14px] bg-white border border-[rgba(10,23,72,0.08)]">
      <MessageCard />
    </div>
  </div>
);

export default HeroTextures;
