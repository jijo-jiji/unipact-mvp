import React from 'react';
import { AlertCircle, X, Check } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className={`bg-[var(--bg-panel)] border ${isDanger ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-[var(--border-tech)] shadow-[0_0_50px_rgba(160,32,240,0.2)]'} w-full max-w-sm relative p-6`}>

                <div className="flex flex-col items-center text-center mb-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 border ${isDanger ? 'bg-red-500/10 text-red-500 border-red-500' : 'bg-[var(--text-gold)]/10 text-[var(--text-gold)] border-[var(--text-gold)]'}`}>
                        <AlertCircle size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">{title}</h3>
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">{message}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={onClose}
                        className="border border-gray-600 text-gray-400 hover:text-white hover:border-white py-2 px-4 text-xs font-bold uppercase tracking-wider transition-all"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--text-gold)] text-black hover:bg-white'} py-2 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2`}
                    >
                        <Check size={14} /> {confirmText}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ConfirmationModal;
