import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Accessible modal shell: closes on Escape or backdrop click, locks page scroll while open
const Modal = ({ isOpen, onClose, title, subtitle, icon, children, maxWidth = 'max-w-lg', dismissible = true }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, dismissible]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A1748]/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${maxWidth} max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative shadow-2xl`}
      >
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-md text-[#5B6478] hover:text-[#0A1748] hover:bg-[#F5F7FC] transition-colors"
          >
            <X size={18} />
          </button>
        )}
        {(title || icon) && (
          <div className="flex items-start gap-3 mb-5 pr-8">
            {icon && (
              <div className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="font-heading font-bold text-xl text-[#0A1748]">{title}</h2>
              {subtitle && <p className="text-sm text-[#5B6478] mt-0.5">{subtitle}</p>}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal;
