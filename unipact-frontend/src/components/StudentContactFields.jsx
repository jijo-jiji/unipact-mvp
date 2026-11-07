import React from 'react';
import { SEMESTER_OPTIONS, WEEKLY_AVAILABILITY_OPTIONS, YEAR_OF_STUDY_OPTIONS } from '../utils/constants';

// WhatsApp, university email, study year and semester, weekly hours and links: asked at sign-up and
// editable in Account settings. A portfolio link is required for the software track; any link works.
const StudentContactFields = ({ values, onChange, domainFocus, idPrefix = 'sc', required = true }) => {
  const set = (name) => (e) => onChange(name, e.target.value);
  const portfolioRequired = required && ['SOFTWARE_DEV', 'BOTH'].includes(domainFocus);

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold mb-2">Contact and availability</legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-wa`}>WhatsApp number</label>
          <input id={`${idPrefix}-wa`} type="tel" inputMode="tel" autoComplete="tel" required={required}
            value={values.whatsapp_number} onChange={set('whatsapp_number')} placeholder="012-345 6789" className="input" />
          <p className="field-hint">So UniPact can reach you quickly about a project. Clients never see it.</p>
        </div>
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-uni`}>University email</label>
          <input id={`${idPrefix}-uni`} type="email" required={required}
            value={values.university_email} onChange={set('university_email')} placeholder="you@siswa.um.edu.my" className="input" />
          <p className="field-hint">We&apos;ll send a link to confirm it. This shows you&apos;re a current student.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-year`}>Year of study</label>
          <select id={`${idPrefix}-year`} required={required} value={values.year_of_study ?? ''} onChange={set('year_of_study')} className="input">
            <option value="" disabled>Choose</option>
            {YEAR_OF_STUDY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-sem`}>Current semester</label>
          <select id={`${idPrefix}-sem`} required={required} value={values.current_semester ?? ''} onChange={set('current_semester')} className="input">
            <option value="" disabled>Choose</option>
            {SEMESTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-hours`}>Weekly availability</label>
          <select id={`${idPrefix}-hours`} required={required} value={values.weekly_availability} onChange={set('weekly_availability')} className="input">
            <option value="" disabled>Choose</option>
            {WEEKLY_AVAILABILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-portfolio`}>Portfolio link{portfolioRequired ? '' : ' (optional)'}</label>
          <input id={`${idPrefix}-portfolio`} type="url" required={portfolioRequired}
            value={values.portfolio_url} onChange={set('portfolio_url')} placeholder="https://github.com/you" className="input" />
          <p className="field-hint">Any link that shows your work: GitHub, Canva, Behance, a Google Drive folder…</p>
        </div>
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-linkedin`}>LinkedIn profile (optional)</label>
          <input id={`${idPrefix}-linkedin`} type="url"
            value={values.linkedin_url} onChange={set('linkedin_url')} placeholder="https://www.linkedin.com/in/you" className="input" />
        </div>
      </div>
    </fieldset>
  );
};

export default StudentContactFields;
