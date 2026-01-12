import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Auto close after 3 seconds

        return () => clearTimeout(timer);
    }, [onClose]);

    // Styling based on type
    const styles = {
        success: {
            border: 'border-[var(--text-gold)]',
            icon: <CheckCircle className="text-[var(--text-gold)]" size={20} />,
            bg: 'bg-[var(--bg-panel)]' // Could be greenish too, but gold fits the theme
        },
        error: {
            border: 'border-[var(--accent-red)]',
            icon: <AlertCircle className="text-[var(--accent-red)]" size={20} />,
            bg: 'bg-[var(--bg-panel)]'
        },
        info: {
            border: 'border-[var(--text-blue)]',
            icon: <Info className="text-[var(--text-blue)]" size={20} />,
            bg: 'bg-[var(--bg-panel)]'
        }
    };

    const currentStyle = styles[type] || styles.info;

    return (
        <div className={`
      fixed top-4 right-4 z-50 flex items-center gap-3 p-4 
      min-w-[300px] max-w-md
      rounded-lg border shadow-lg backdrop-blur-md
      animate-fade-in
      ${currentStyle.bg}
      ${currentStyle.border}
    `}>
            {/* Icon */}
            <div className="shrink-0">
                {currentStyle.icon}
            </div>

            {/* Message */}
            <div className="flex-1 text-sm text-white font-ui">
                {message}
            </div>

            {/* Close Button */}
            <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
            >
                <X size={16} />
            </button>

            {/* Progress/Timer Bar (Optional visual flair) */}
            <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full rounded-b-lg overflow-hidden">
                <div className={`h-full ${type === 'error' ? 'bg-red-500' : 'bg-[var(--text-gold)]'} animate-[shrink_3s_linear_forwards]`} />
            </div>

            <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
        </div>
    );
};

export default Toast;
