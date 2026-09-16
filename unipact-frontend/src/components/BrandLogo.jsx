import React from 'react';
import markNavy from '../assets/unipact-mark.png';
import markWhite from '../assets/unipact-mark-white.png';
import logoNavy from '../assets/unipact-logo.png';
import logoWhite from '../assets/unipact-logo-white.png';

// Official UniPact logo.
// variant="horizontal": graduation-cap shield + UNIPACT wordmark side by side (navbars, footer)
// variant="stacked":    the full official lockup image (login, auth screens)
const BrandLogo = ({ variant = 'horizontal', subtitle, onDark = false, className = '' }) => {
  if (variant === 'stacked') {
    return <img src={onDark ? logoWhite : logoNavy} alt="UniPact" className={`w-auto select-none ${className || 'h-24'}`} draggable="false" />;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src={onDark ? markWhite : markNavy} alt="" aria-hidden="true" className="h-10 w-auto shrink-0 select-none" draggable="false" />
      <span className="flex flex-col justify-center leading-none">
        <span className={`font-heading font-extrabold text-[1.2rem] tracking-[0.08em] ${onDark ? 'text-white' : 'text-[#0A1748]'}`}>
          UNIPACT
        </span>
        {subtitle && (
          <span className={`mt-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${onDark ? 'text-white/70' : 'text-[#0090C6]'}`}>
            {subtitle}
          </span>
        )}
      </span>
      <span className="sr-only">UniPact</span>
    </span>
  );
};

export default BrandLogo;
