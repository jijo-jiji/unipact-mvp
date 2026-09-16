import React, { useState } from 'react';
import { Check, Eye, EyeOff, Lock } from 'lucide-react';
import { passwordChecks } from '../utils/password';

const PasswordField = ({ id, label, value, onChange, autoComplete = 'new-password', showChecks = false, placeholder, error }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="relative">
        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478] pointer-events-none" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={showChecks ? `${id}-checks` : undefined}
          className={`input pl-10 pr-12 ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-[#5B6478] hover:text-[#0A1748]"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
      {showChecks && (
        <ul id={`${id}-checks`} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {passwordChecks(value).map((check) => (
            <li key={check.label} className={`inline-flex items-center gap-1 ${check.ok ? 'text-emerald-700' : 'text-[#5B6478]'}`}>
              <Check size={13} className={check.ok ? 'opacity-100' : 'opacity-30'} /> {check.label}
            </li>
          ))}
          <li className="text-[#5B6478]">Avoid common passwords</li>
        </ul>
      )}
    </div>
  );
};

export default PasswordField;
