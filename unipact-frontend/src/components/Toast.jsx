import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const STYLES = {
  success: { icon: <CheckCircle2 className="text-emerald-600" size={20} />, bar: 'bg-emerald-500', ring: 'border-emerald-200' },
  error: { icon: <AlertCircle className="text-red-600" size={20} />, bar: 'bg-red-500', ring: 'border-red-200' },
  info: { icon: <Info className="text-[#00AEEF]" size={20} />, bar: 'bg-[#00AEEF]', ring: 'border-[rgba(10,23,72,0.12)]' },
};

const Toast = ({ message, type = 'info', onClose }) => {
  // Errors stay a little longer so there is time to read them
  const duration = type === 'error' ? 6000 : 3500;

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const style = STYLES[type] || STYLES.info;

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`fixed top-4 right-4 left-4 sm:left-auto z-[70] sm:w-[380px] flex items-start gap-3 p-4 pb-5 rounded-lg border bg-white shadow-lg overflow-hidden animate-fade-in ${style.ring}`}
    >
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 text-sm text-[#0A1748] leading-snug">{message}</div>
      <button onClick={onClose} aria-label="Dismiss" className="text-[#5B6478] hover:text-[#0A1748] transition-colors">
        <X size={16} />
      </button>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-[#F5F7FC]">
        <div className={`h-full ${style.bar}`} style={{ animation: `toast-shrink ${duration}ms linear forwards` }} />
      </div>
      <style>{`@keyframes toast-shrink { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
};

export default Toast;
