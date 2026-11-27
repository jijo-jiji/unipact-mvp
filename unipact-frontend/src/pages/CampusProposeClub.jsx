import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  CLUB_TYPES, Card, CampusPage, ChoiceChips, DNA_CATEGORIES, ErrorNote, Field, Loading, MERIT_ELEMENTS, useLoad,
} from '../components/campus/CampusUI';

const firstError = (data) => {
  if (!data || typeof data !== 'object') return null;
  const [key, value] = Object.entries(data)[0] || [];
  const text = Array.isArray(value) ? value[0] : typeof value === 'string' ? value : null;
  return text ? `${key === 'detail' || key === 'non_field_errors' ? '' : `${key.replaceAll('_', ' ')}: `}${typeof text === 'string' ? text : JSON.stringify(text)}` : null;
};

const Rows = ({ rows, onChange, columns, addLabel }) => (
  <div className="space-y-2">
    {rows.map((row, i) => (
      <div key={i} className="flex gap-2">
        {columns.map(([key, placeholder, type]) => (
          <input key={key} className={`input ${type === 'number' ? 'w-32' : ''}`} type={type || 'text'} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined}
            placeholder={placeholder} aria-label={placeholder} value={row[key] || ''}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)))} />
        ))}
        <button type="button" className="text-[#5B6478] hover:text-red-600 px-1" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
      </div>
    ))}
    <button type="button" className="btn-secondary btn-sm" onClick={() => onChange([...rows, {}])}><Plus size={15} aria-hidden="true" /> {addLabel}</button>
  </div>
);

// Propose a new club (UniKLSKILL F015), following the UniKL student club proposal template.
// Approval: the named advisor endorses → Head of Section reviews → Deputy Dean (SDCL) approves.
const CampusProposeClub = () => {
  usePageTitle('Start a club');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: campuses, error: loadError, loading } = useLoad('/campus/campuses/');
  const [form, setForm] = useState({
    campus: '', section: '', name: '', club_type: '', dna_category: '', merit_elements: [], description: '',
    objectives: ['', '', ''], proposed_activities: [{}], target_members: '', expected_members: '', benefits: '',
    budget_items: [{}], proposed_advisor_email: '', founding_members: '',
  });
  const [document, setDocument] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const campus = (campuses || []).find((c) => String(c.id) === String(form.campus)) || (campuses?.length === 1 ? campuses[0] : null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      section: form.section,
      name: form.name,
      club_type: form.club_type,
      dna_category: form.dna_category,
      merit_elements: form.merit_elements,
      description: form.description,
      objectives: form.objectives.map((o) => o.trim()).filter(Boolean),
      proposed_activities: form.proposed_activities.filter((a) => a.name?.trim()).map((a) => ({ ...a, cost: a.cost || null })),
      target_members: form.target_members,
      expected_members: form.expected_members || null,
      benefits: form.benefits,
      budget_items: form.budget_items.filter((b) => b.item?.trim()).map((b) => ({ item: b.item, cost: b.cost || '0' })),
      proposed_advisor_email: form.proposed_advisor_email,
      founding_members: form.founding_members.split(/[\s,;]+/).map((m) => m.trim()).filter(Boolean),
    };
    try {
      let body = payload;
      if (document) {
        body = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v === null || v === undefined) return;
          body.append(k, Array.isArray(v) ? JSON.stringify(v) : v);
        });
        body.append('document', document);
      }
      const res = await api.post('/campus/club-proposals/', body, document ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
      showToast('Proposal sent to your advisor.', 'success');
      navigate(`/campus/approvals?mine=1&open=${res.data.approval_id}`);
    } catch (err) {
      setError(firstError(err?.response?.data) || getErrorMessage(err, "We couldn't send the proposal."));
    } finally { setSaving(false); }
  };

  return (
    <CampusPage
      title="Start a club"
      intro="Fill in the club proposal. Your proposed advisor endorses it, then the Head of Section reviews it and the Deputy Dean (SDCL) approves it. You become the club's president."
      back={{ to: '/campus/clubs', label: 'Clubs' }}
    >
      {loading && <Loading />}
      <ErrorNote>{loadError}</ErrorNote>
      {campuses && (
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">1. Club information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {campuses.length > 1 && (
                <Field label="Campus" htmlFor="campus">
                  <select id="campus" className="input" required value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value, section: '' })}>
                    <option value="">Choose…</option>
                    {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Section" hint="Student Development for academic and spiritual clubs; Campus Lifestyle for sports, recreation and culture." htmlFor="section">
                <select id="section" className="input" required value={form.section} onChange={set('section')}>
                  <option value="">Choose…</option>
                  {(campus?.sections || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Club name" htmlFor="name"><input id="name" className="input" required maxLength={255} value={form.name} onChange={set('name')} /></Field>
              <Field label="Club type" htmlFor="club_type">
                <select id="club_type" className="input" required value={form.club_type} onChange={set('club_type')}>
                  <option value="">Choose…</option>
                  {CLUB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="UniKL DNA category" hint="The GHOCS category your club's activities mostly fall under." htmlFor="dna">
                <select id="dna" className="input" value={form.dna_category} onChange={set('dna_category')}>
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
            <h2 className="font-heading font-bold text-xl">2. Description and objectives</h2>
            <Field label="Description" hint="What the club does and why it matters to UniKL students." htmlFor="description">
              <textarea id="description" className="input min-h-[110px]" required value={form.description} onChange={set('description')} />
            </Field>
            <Field label="Objectives (1 to 5)">
              <div className="space-y-2">
                {form.objectives.map((o, i) => (
                  <input key={i} className="input" placeholder={`Objective ${i + 1}`} aria-label={`Objective ${i + 1}`} value={o}
                    onChange={(e) => setForm({ ...form, objectives: form.objectives.map((x, j) => (j === i ? e.target.value : x)) })} />
                ))}
                {form.objectives.length < 5 && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({ ...form, objectives: [...form.objectives, ''] })}><Plus size={15} aria-hidden="true" /> Add objective</button>
                )}
              </div>
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">3. Activities, members and budget</h2>
            <Field label="Proposed activities">
              <Rows rows={form.proposed_activities} onChange={(rows) => setForm({ ...form, proposed_activities: rows })} addLabel="Add activity"
                columns={[['name', 'Activity name'], ['date', 'Expected date'], ['cost', 'Cost (RM)', 'number']]} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Target members" htmlFor="target"><input id="target" className="input" placeholder="e.g. All UniKL MIIT students" value={form.target_members} onChange={set('target_members')} /></Field>
              <Field label="Expected number of members" htmlFor="expected"><input id="expected" className="input" type="number" min="1" value={form.expected_members} onChange={set('expected_members')} /></Field>
            </div>
            <Field label="Benefits to students and the university" htmlFor="benefits"><textarea id="benefits" className="input min-h-[80px]" value={form.benefits} onChange={set('benefits')} /></Field>
            <Field label="Budget estimate">
              <Rows rows={form.budget_items} onChange={(rows) => setForm({ ...form, budget_items: rows })} addLabel="Add item"
                columns={[['item', 'Item'], ['cost', 'Cost (RM)', 'number']]} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-heading font-bold text-xl">4. Advisor and founders</h2>
            <Field label="Proposed advisor's email" hint="A lecturer with a UniPact Campus staff account. They endorse the proposal first." htmlFor="advisor">
              <input id="advisor" className="input" type="email" required value={form.proposed_advisor_email} onChange={set('proposed_advisor_email')} />
            </Field>
            <Field label="Founding members' emails" hint="Separate with commas or new lines. Those with a UniPact account join the club when it is approved." htmlFor="founders">
              <textarea id="founders" className="input min-h-[80px]" value={form.founding_members} onChange={set('founding_members')} />
            </Field>
            <Field label="Signed proposal (optional)" hint="PDF or Word, if your advisor asked for the template." htmlFor="document">
              <input id="document" type="file" accept=".pdf,.doc,.docx" className="text-sm" onChange={(e) => setDocument(e.target.files?.[0] || null)} />
            </Field>
          </Card>

          <ErrorNote>{error}</ErrorNote>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send proposal'}</button>
        </form>
      )}
    </CampusPage>
  );
};

export default CampusProposeClub;
