import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/client';
import PublicNav from '../components/PublicNav';
import { formatDate, getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const CONFIDENCE_QUESTION = 'How confident are you using these skills on a real client project?';

// A row of numbered buttons for a 1-5 or 0-10 answer
const Scale = ({ from, to, value, onChange, low, high, label }) => (
  <fieldset>
    <legend className="field-label">{label}</legend>
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-lg border font-semibold tabular-nums ${value === n ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#0A1748] border-[rgba(10,23,72,0.15)] hover:border-[#00AEEF]'}`}
        >
          {n}
        </button>
      ))}
    </div>
    <div className="flex justify-between text-xs text-[#5B6478] mt-1.5 max-w-[440px]"><span>{low}</span><span>{high}</span></div>
  </fieldset>
);

const Done = ({ title, text, hasAccount }) => (
  <div className="text-center py-4">
    <CheckCircle2 className="mx-auto text-emerald-600" size={40} aria-hidden="true" />
    <h2 className="font-heading font-bold text-2xl mt-3">{title}</h2>
    <p className="text-[#5B6478] mt-2">{text}</p>
    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
      {hasAccount ? (
        <Link to="/learning" className="btn btn-primary"><BookOpen size={16} /> Open the workshop materials</Link>
      ) : (
        <Link to="/register/student" className="btn btn-primary">Join UniPact to get paid projects</Link>
      )}
    </div>
    {!hasAccount && (
      <p className="text-sm text-[#5B6478] mt-3">
        Sign up with this same email and we&apos;ll link today&apos;s workshop to your account, with its slides and exercises.
      </p>
    )}
  </div>
);

const WorkshopCheckIn = ({ mode = 'checkin' }) => {
  const { code } = useParams();
  const feedbackMode = mode === 'feedback';
  usePageTitle(feedbackMode ? 'Workshop feedback' : 'Workshop check-in');
  const [workshop, setWorkshop] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', university: '', b40_self_declared: 'UNSAID', confidence_before: null, consent: false,
    confidence_after: null, recommend_score: null, comment: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get(`/impact/w/${code}/`)
      .then((res) => setWorkshop(res.data))
      .catch((err) => setLoadError(err.response?.status === 404 ? 'This workshop link is not valid. Check the QR code or ask the organiser.' : getErrorMessage(err)));
  }, [code]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const field = (key) => ({ value: form[key], onChange: (e) => set(key)(e.target.value) });
  const fieldError = (key) => errors[key] && <p className="text-sm text-red-600 mt-1">{[].concat(errors[key])[0]}</p>;

  const submit = async (e) => {
    e.preventDefault();
    const missing = {};
    if (feedbackMode) {
      if (!form.confidence_after) missing.confidence_after = 'Choose a number.';
      if (form.recommend_score === null) missing.recommend_score = 'Choose a number.';
    } else {
      if (!form.confidence_before) missing.confidence_before = 'Choose a number.';
      if (!form.consent) missing.consent = 'Please agree so we can keep your check-in.';
    }
    if (Object.keys(missing).length) { setErrors(missing); return; }

    setBusy(true);
    setErrors({});
    try {
      if (feedbackMode) {
        const res = await api.post(`/impact/w/${code}/feedback/`, {
          email: form.email, confidence_after: form.confidence_after, recommend_score: form.recommend_score, comment: form.comment,
        });
        setDone({ title: 'Thank you!', text: 'Your feedback helps us make the next workshop better.', hasAccount: res.data.has_account });
      } else {
        const { confidence_after: _a, recommend_score: _r, comment: _c, ...body } = form;
        const res = await api.post(`/impact/w/${code}/checkin/`, body);
        setDone({
          title: res.data.already ? "You're already checked in" : "You're checked in",
          text: `Enjoy ${workshop.title}! We'll send a short feedback form at the end.`,
          hasAccount: res.data.has_account,
        });
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object' && !data.error && !data.detail) setErrors(data);
      else setErrors({ form: data?.error || getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const closed = workshop && (feedbackMode ? !workshop.feedback_open : !workshop.checkin_open);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <PublicNav />
      <main className="flex-1 w-full max-w-[640px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {!workshop && !loadError && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00AEEF]" /></div>}
        {loadError && <p className="alert-error">{loadError}</p>}
        {workshop && (
          <div className="card p-6 sm:p-8 bg-white border border-[rgba(10,23,72,0.1)]">
            <p className="eyebrow mb-2"><span className="eyebrow-dot" /> {feedbackMode ? 'Workshop feedback' : 'Workshop check-in'}</p>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">{workshop.title}</h1>
            <p className="text-sm text-[#5B6478] mt-1">
              {formatDate(workshop.held_on)}{workshop.location ? ` · ${workshop.location}` : ''} · {workshop.kind_label}
            </p>
            <div className="h-0.5 w-12 bg-[#00AEEF] my-6" aria-hidden="true" />

            {done && <Done {...done} />}
            {!done && closed && (
              <p className="text-[#5B6478]">{feedbackMode ? 'Feedback for this workshop is closed.' : 'Check-in for this workshop is closed.'} Ask the organiser if you think this is a mistake.</p>
            )}
            {!done && !closed && (
              <form onSubmit={submit} className="space-y-5" noValidate>
                {errors.form && <p className="alert-error">{errors.form}</p>}
                {!feedbackMode && (
                  <label className="block">
                    <span className="field-label">Full name</span>
                    <input className="input" required autoComplete="name" {...field('full_name')} />
                    {fieldError('full_name')}
                  </label>
                )}
                <label className="block">
                  <span className="field-label">Email</span>
                  <input className="input" type="email" required autoComplete="email" {...field('email')} />
                  <span className="field-hint">{feedbackMode ? 'The same email you checked in with.' : 'Use the email you use (or will use) for UniPact.'}</span>
                  {fieldError('email')}
                </label>

                {!feedbackMode && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="field-label">WhatsApp number (optional)</span>
                        <input className="input" type="tel" autoComplete="tel" placeholder="+60" {...field('phone')} />
                      </label>
                      <label className="block">
                        <span className="field-label">University (optional)</span>
                        <input className="input" {...field('university')} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="field-label">Is your household in the B40 income group? (optional)</span>
                      <select className="input" {...field('b40_self_declared')}>
                        <option value="UNSAID">Prefer not to say</option>
                        <option value="YES">Yes</option>
                        <option value="NO">No</option>
                      </select>
                      <span className="field-hint">Private. Only used in totals, so we know who our workshops reach.</span>
                    </label>
                    <div>
                      <Scale from={1} to={5} value={form.confidence_before} onChange={set('confidence_before')} label={CONFIDENCE_QUESTION} low="1 · Not at all" high="5 · Very confident" />
                      {fieldError('confidence_before')}
                    </div>
                    <label className="flex gap-3 items-start text-sm">
                      <input type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => set('consent')(e.target.checked)} />
                      <span>
                        I agree that UniPact may keep these details to record my attendance, send me the feedback form and
                        workshop materials, and see whether the workshop helped me get paid work. See the{' '}
                        <Link to="/privacy" className="text-[#00729F] underline">privacy policy</Link>.
                      </span>
                    </label>
                    {fieldError('consent')}
                  </>
                )}

                {feedbackMode && (
                  <>
                    <div>
                      <Scale from={1} to={5} value={form.confidence_after} onChange={set('confidence_after')} label={`Now: ${CONFIDENCE_QUESTION.toLowerCase()}`} low="1 · Not at all" high="5 · Very confident" />
                      {fieldError('confidence_after')}
                    </div>
                    <div>
                      <Scale from={0} to={10} value={form.recommend_score} onChange={set('recommend_score')} label="How likely are you to recommend this workshop to a friend?" low="0 · Not likely" high="10 · Very likely" />
                      {fieldError('recommend_score')}
                    </div>
                    <label className="block">
                      <span className="field-label">Anything we should improve? (optional)</span>
                      <textarea className="input" rows={3} {...field('comment')} />
                    </label>
                  </>
                )}

                <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy}>
                  {busy && <Loader2 size={16} className="animate-spin" />} {feedbackMode ? 'Send feedback' : 'Check in'}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default WorkshopCheckIn;
