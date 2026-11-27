import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  ACTIVITY_LEVELS, Card, CampusPage, ChoiceChips, DNA_CATEGORIES, ErrorNote, Field, Loading, MERIT_ELEMENTS, useLoad,
} from '../components/campus/CampusUI';

const rm = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const firstError = (data) => {
  if (!data || typeof data !== 'object') return null;
  const [key, value] = Object.entries(data)[0] || [];
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return null;
  const message = typeof text === 'string' ? text : JSON.stringify(text);
  return ['detail', 'non_field_errors'].includes(key) ? message : `${key.replaceAll('_', ' ')}: ${message}`;
};

// Propose a club activity. The form follows MIIT's "Template Proposal SAF 2026" and the GHOCS activity form;
// it goes through the campus approval chain (SRC, advisor, section, Finance, Deputy Dean, Dean above RM 5,000).
const CampusProposeActivity = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: club, error: loadError, loading } = useLoad(`/campus/clubs/${id}/`);
  usePageTitle('Propose an activity');
  const [form, setForm] = useState({
    title: '', background: '', objectives: ['', ''], activity_level: 'CAMPUS', dna_category: '', merit_elements: [],
    venue: '', on_campus: true, date: '', start_time: '', end_date: '', end_time: '', expected_participants: '',
    justification: '', budget_items: [{ item: '', price: '', quantity: 1 }], funding_saf: '', funding_campus: '',
    funding_other: '', logistics: '', vehicle: '', sponsor: '', person_in_charge: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const total = useMemo(() => form.budget_items.reduce((sum, r) => sum + (Number(r.price) || 0) * (Number(r.quantity) || 0), 0), [form.budget_items]);
  const funding = (Number(form.funding_saf) || 0) + (Number(form.funding_campus) || 0) + (Number(form.funding_other) || 0);
  const balanced = Math.abs(total - funding) < 0.005;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.merit_elements.length) { setError('Choose at least one S.P.I.C.E.S element.'); return; }
    if (total > 0 && !balanced) { setError(`The funding (${rm(funding)}) must add up to the budget total (${rm(total)}).`); return; }
    const starts = new Date(`${form.date}T${form.start_time}`);
    const ends = new Date(`${form.end_date || form.date}T${form.end_time}`);
    setSaving(true);
    try {
      const res = await api.post(`/campus/clubs/${id}/activities/`, {
        title: form.title, background: form.background,
        objectives: form.objectives.map((o) => o.trim()).filter(Boolean),
        activity_level: form.activity_level, dna_category: form.dna_category, merit_elements: form.merit_elements,
        venue: form.venue, on_campus: form.on_campus, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
        expected_participants: form.expected_participants || null, justification: form.justification,
        budget_items: form.budget_items.filter((r) => r.item.trim()).map((r) => ({ item: r.item, price: r.price || '0', quantity: r.quantity || 1 })),
        funding_saf: form.funding_saf || '0', funding_campus: form.funding_campus || '0', funding_other: form.funding_other || '0',
        extra: { logistics: form.logistics, vehicle: form.vehicle, sponsor: form.sponsor, person_in_charge: form.person_in_charge },
      });
      showToast('Proposal sent for approval.', 'success');
      navigate(`/campus/activities/${res.data.id}`);
    } catch (err) {
      setError(firstError(err?.response?.data) || getErrorMessage(err, "We couldn't send the proposal."));
    } finally { setSaving(false); }
  };

  const row = (i, key) => (e) => setForm({ ...form, budget_items: form.budget_items.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)) });

  return (
    <CampusPage
      eyebrow={club?.name || 'Club'}
      title="Propose an activity"
      intro="This becomes the SAF proposal paper. It goes to the SRC, your advisor, the section, Finance and the Deputy Dean (and the Dean above RM 5,000). You'll see each signature on the activity page."
      back={{ to: `/campus/clubs/${id}?tab=activities`, label: club?.name || 'Club' }}
    >
      {loading && !club && <Loading />}
      <ErrorNote>{loadError}</ErrorNote>
      {club && !club.me?.can_manage && <ErrorNote>Only the committee and advisors of {club.name} can propose activities.</ErrorNote>}
      {club?.me?.can_manage && (
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">1. The programme</h2>
            <Field label="Name of the programme" htmlFor="title"><input id="title" className="input" required maxLength={255} value={form.title} onChange={set('title')} /></Field>
            <Field label="Background" hint="The purpose of the programme and a short introduction." htmlFor="background">
              <textarea id="background" className="input min-h-[110px]" required value={form.background} onChange={set('background')} />
            </Field>
            <Field label="Objectives" hint="Use the S.M.A.R.T. approach, e.g. 'To train 40 first-year students in Arduino basics on 12 Dec.'">
              <div className="space-y-2">
                {form.objectives.map((o, i) => (
                  <input key={i} className="input" aria-label={`Objective ${i + 1}`} placeholder={`Objective ${i + 1}`} value={o}
                    onChange={(e) => setForm({ ...form, objectives: form.objectives.map((x, j) => (j === i ? e.target.value : x)) })} />
                ))}
                {form.objectives.length < 8 && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({ ...form, objectives: [...form.objectives, ''] })}><Plus size={15} aria-hidden="true" /> Add objective</button>
                )}
              </div>
            </Field>
            <Field label="Justification" hint="Why this programme matters." htmlFor="justification">
              <textarea id="justification" className="input min-h-[80px]" value={form.justification} onChange={set('justification')} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">2. When and where</h2>
            <div className="grid sm:grid-cols-4 gap-4">
              <Field label="Date" htmlFor="date"><input id="date" type="date" className="input" required value={form.date} onChange={set('date')} /></Field>
              <Field label="Starts" htmlFor="start_time"><input id="start_time" type="time" className="input" required value={form.start_time} onChange={set('start_time')} /></Field>
              <Field label="End date" hint="If it runs over several days" htmlFor="end_date"><input id="end_date" type="date" className="input" value={form.end_date} onChange={set('end_date')} /></Field>
              <Field label="Ends" htmlFor="end_time"><input id="end_time" type="time" className="input" required value={form.end_time} onChange={set('end_time')} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Venue" htmlFor="venue"><input id="venue" className="input" required value={form.venue} onChange={set('venue')} /></Field>
              <Field label="Expected participants" htmlFor="expected"><input id="expected" type="number" min="1" className="input" value={form.expected_participants} onChange={set('expected_participants')} /></Field>
            </div>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.on_campus} onChange={set('on_campus')} /> Held on campus</label>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">3. GHOCS</h2>
            <p className="text-sm text-[#5B6478]">Students who take part claim GHOCS points with these details, so choose them carefully.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Level" htmlFor="level">
                <select id="level" className="input" value={form.activity_level} onChange={set('activity_level')}>
                  {ACTIVITY_LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="UniKL DNA category" htmlFor="dna">
                <select id="dna" className="input" required value={form.dna_category} onChange={set('dna_category')}>
                  <option value="">Choose…</option>
                  {DNA_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="S.P.I.C.E.S elements">
              <ChoiceChips label="S.P.I.C.E.S elements" options={MERIT_ELEMENTS} value={form.merit_elements} onChange={(v) => setForm({ ...form, merit_elements: v })} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">4. Budget</h2>
            <p className="text-sm text-[#5B6478]">Leave the budget empty if the activity costs nothing; it then skips the SRC budget and Finance steps.</p>
            <div className="space-y-2">
              {form.budget_items.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_80px_auto] gap-2 items-center">
                  <input className="input" aria-label="Item" placeholder="Item" value={r.item} onChange={row(i, 'item')} />
                  <input className="input" aria-label="Price (RM)" placeholder="Price" type="number" min="0" step="0.01" value={r.price} onChange={row(i, 'price')} />
                  <input className="input" aria-label="Quantity" placeholder="Qty" type="number" min="1" step="1" value={r.quantity} onChange={row(i, 'quantity')} />
                  <button type="button" aria-label="Remove item" className="text-[#5B6478] hover:text-red-600 px-1" onClick={() => setForm({ ...form, budget_items: form.budget_items.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({ ...form, budget_items: [...form.budget_items, { item: '', price: '', quantity: 1 }] })}><Plus size={15} aria-hidden="true" /> Add item</button>
            </div>
            <p className="font-semibold">Total: {rm(total)}{total > 5000 && <span className="ml-2 text-sm font-normal text-[#5B6478]">Above RM 5,000: the Dean approves after the Deputy Dean.</span>}</p>
            {total > 0 && (
              <>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Student Activity Fund (RM)" htmlFor="saf"><input id="saf" type="number" min="0" step="0.01" className="input" value={form.funding_saf} onChange={set('funding_saf')} /></Field>
                  <Field label="UniKL MIIT (RM)" htmlFor="campus_fund"><input id="campus_fund" type="number" min="0" step="0.01" className="input" value={form.funding_campus} onChange={set('funding_campus')} /></Field>
                  <Field label="Others (RM)" htmlFor="other_fund"><input id="other_fund" type="number" min="0" step="0.01" className="input" value={form.funding_other} onChange={set('funding_other')} /></Field>
                </div>
                <p className={`text-sm ${balanced ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Funding {rm(funding)} of {rm(total)}{balanced ? ': adds up.' : `: ${rm(Math.abs(total - funding))} ${funding < total ? 'still to cover' : 'too much'}.`}
                </p>
              </>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">5. Additional details (optional)</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Logistics" htmlFor="logistics"><input id="logistics" className="input" value={form.logistics} onChange={set('logistics')} /></Field>
              <Field label="Vehicle" htmlFor="vehicle"><input id="vehicle" className="input" value={form.vehicle} onChange={set('vehicle')} /></Field>
              <Field label="Sponsor" htmlFor="sponsor"><input id="sponsor" className="input" value={form.sponsor} onChange={set('sponsor')} /></Field>
              <Field label="Person in charge" htmlFor="pic"><input id="pic" className="input" value={form.person_in_charge} onChange={set('person_in_charge')} /></Field>
            </div>
          </Card>

          <ErrorNote>{error}</ErrorNote>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send for approval'}</button>
        </form>
      )}
    </CampusPage>
  );
};

export default CampusProposeActivity;
