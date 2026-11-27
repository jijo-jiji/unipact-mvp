import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import { Card, CampusPage, Empty, ErrorNote, Field, Loading, useLoad } from '../components/campus/CampusUI';

// The pilot evaluation survey: UniKLSKILL's 15 acceptance questions, answered 1 (strongly disagree) to 5.
const CampusSurvey = () => {
  usePageTitle('Pilot survey');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data, error, loading } = useLoad('/campus/survey/');
  const [answers, setAnswers] = useState(null);
  const [comment, setComment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const current = answers ?? data?.my_response?.answers ?? {};
  const note = comment ?? data?.my_response?.comment ?? '';
  const total = data ? data.categories.reduce((n, c) => n + c.questions.length, 0) : 0;
  const answered = Object.keys(current).length;

  const submit = async (e) => {
    e.preventDefault();
    if (answered < total) { setProblem(`Please answer all ${total} questions (${total - answered} left).`); return; }
    setBusy(true);
    setProblem('');
    try {
      await api.post('/campus/survey/', { campus: data.campus, answers: current, comment: note });
      showToast('Thank you! Your answers help decide what happens after the pilot.', 'success');
      navigate('/campus');
    } catch (err) { setProblem(getErrorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <CampusPage title="Pilot survey" intro="15 short questions about UniPact Campus. It takes about 3 minutes. Your name isn't shown with your answers." back={{ to: '/campus', label: 'Campus' }}>
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && !data.is_open && <Card><Empty title="The survey isn't open">SDCL opens it near the end of the pilot.</Empty></Card>}
      {data?.is_open && (
        <form onSubmit={submit} className="space-y-6">
          {data.my_response && <p className="text-sm rounded-lg bg-[#00AEEF]/10 p-3">You've answered before. Changing your answers replaces them.</p>}
          {data.categories.map((c) => (
            <Card key={c.key} className="space-y-5">
              <h2 className="font-heading font-bold text-xl">{c.label}</h2>
              {c.questions.map((q, i) => (
                <fieldset key={q.id} className="space-y-2">
                  <legend className="font-semibold">{i + 1}. {q.text}</legend>
                  <div className="grid grid-cols-5 gap-1.5 max-w-xl">
                    {data.scale.map((s) => {
                      const on = current[q.id] === s.value;
                      return (
                        <label key={s.value} className={`cursor-pointer rounded-lg border px-1 py-2 text-center text-xs font-semibold transition-colors ${on ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.15)] hover:text-[#0A1748]'}`}>
                          <input type="radio" className="sr-only" name={q.id} value={s.value} checked={on} onChange={() => setAnswers({ ...current, [q.id]: s.value })} />
                          <span className="block text-base">{s.value}</span>{s.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </Card>
          ))}
          <Card>
            <Field label="Anything else? (optional)" hint="What worked, what didn't, what you'd change." htmlFor="survey-comment">
              <textarea id="survey-comment" className="input min-h-[96px]" maxLength={2000} value={note} onChange={(e) => setComment(e.target.value)} />
            </Field>
          </Card>
          <ErrorNote>{problem}</ErrorNote>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send answers'}</button>
            <span className="text-sm text-[#5B6478]">{answered} of {total} answered</span>
          </div>
        </form>
      )}
    </CampusPage>
  );
};

export default CampusSurvey;
