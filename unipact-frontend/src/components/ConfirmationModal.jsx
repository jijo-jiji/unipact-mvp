import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from './Modal';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    maxWidth="max-w-md"
    icon={isDanger ? <AlertTriangle size={20} className="text-red-600" /> : <HelpCircle size={20} />}
  >
    <p className="text-sm text-[#5B6478] leading-relaxed">{message}</p>
    <div className="flex justify-end gap-3 mt-6">
      <button type="button" onClick={onClose} className="btn-secondary">
        {cancelText}
      </button>
      <button
        type="button"
        onClick={() => {
          onConfirm();
          onClose();
        }}
        className={isDanger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}
      >
        {confirmText}
      </button>
    </div>
  </Modal>
);

export default ConfirmationModal;
