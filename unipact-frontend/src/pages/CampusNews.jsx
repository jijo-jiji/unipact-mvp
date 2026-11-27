import React, { useState } from 'react';
import { Award, Newspaper, PenLine } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import Modal from '../components/Modal';
import {
  ACTIVITY_LEVELS, Card, CampusPage, ChoiceChips, DNA_CATEGORIES, Empty, ErrorNote, Field, Loading, MERIT_ELEMENTS,
  StatusPill, formatDate, labelOf, useLoad,
} from '../components/campus/CampusUI';

const blank = {
  title: '', body: '', ghocs_claimable: false, activity_level: '', dna_category: '', merit_elements: [],
  starts_on: '', ends_on: '', location: '',
};

const PostForm = ({ campuses, onDone }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({ ...blank, campus: campuses.length === 1 ? String(campuses[0].id) : '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    try {
      const res = await api.post('/campus/news/', body);
      showToast(res.data.status === 'PUBLISHED' ? 'Posted.' : 'Sent to SDCL for approval.', 'success');
      onDone();
    } catch (err) {
      const data = err?.response?.data;
      const first = data && typeof data === 'object' ? Object.entries(data)[0] : null;
      setError(first ? `${first[0].replaceAll('_', ' ')}: ${[].concat(first[1])[0]}` : getErrorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {campuses.length > 1 && (
        <Field label="Campus" htmlFor="news-campus">
          <select id="news-campus" className="input" required value={form.campus} onChange={set('campus')}>
            <option value="">Choose…</option>
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Title" htmlFor="news-title"><input id="news-title" className="input" required maxLength={200} value={form.title} onChange={set('title')} /></Field>
      <Field label="Details" htmlFor="news-body"><textarea id="news-body" className="input min-h-[110px]" required value={form.body} onChange={set('body')} /></Field>
      <label className="text-sm flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={form.ghocs_claimable} onChange={set('ghocs_claimable')} /> Students can claim GHOCS points for this
      </label>
      {form.ghocs_claimable && (
        <div className="space-y-4 rounded-lg bg-[#F5F7FC] p-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Activity level" htmlFor="news-level">
              <select id="news-level" className="input" required value={form.activity_level} onChange={set('activity_level')}>
                <option value="">Choose…</option>
                {ACTIVITY_LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="UniKL DNA category" htmlFor="news-dna">
              <select id="news-dna" className="input" required value={form.dna_category} onChange={set('dna_category')}>
                <option value="">Choose…</option>
                {DNA_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="S.P.I.C.E.S elements">
            <ChoiceChips label="S.P.I.C.E.S elements" options={MERIT_ELEMENTS} value={form.merit_elements} onChange={(v) => setForm({ ...form, merit_elements: v })} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Starts" htmlFor="news-start"><input id="news-start" type="date" className="input" required value={form.starts_on} onChange={set('starts_on')} /></Field>
            <Field label="Ends" htmlFor="news-end"><input id="news-end" type="date" className="input" value={form.ends_on} onChange={set('ends_on')} /></Field>
            <Field label="Location" htmlFor="news-location"><input id="news-location" className="input" value={form.location} onChange={set('location')} /></Field>
          </div>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send'}</button>
    </form>
  );
};

// Campus news (UniKLSKILL F023–F025): anyone signed in proposes a post, SDCL approves it.
const CampusNews = () => {
  usePageTitle('Campus news');
  const [writing, setWriting] = useState(false);
  const { data, error, loading, reload } = useLoad('/campus/news/');
  const mine = useLoad('/campus/news/mine/');
  const campuses = useLoad('/campus/campuses/');
  const waiting = (mine.data || []).filter((p) => p.status !== 'PUBLISHED');

  return (
    <CampusPage
      title="News"
      intro="Campus news and activities. Posts marked GHOCS-claimable count towards your GHOCS points once you take part."
      back={{ to: '/campus', label: 'Campus' }}
      actions={<button type="button" className="btn-primary btn-sm" onClick={() => setWriting(true)}><PenLine size={15} aria-hidden="true" /> Post news</button>}
    >
      {waiting.length > 0 && (
        <Card>
          <h2 className="font-heading font-bold text-lg">Your posts</h2>
          <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
            {waiting.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <span className="truncate">{p.title}</span>
                <StatusPill status={p.status} label={{ PENDING: 'In review', REJECTED: 'Not approved', WITHDRAWN: 'Withdrawn' }[p.status]} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && data.length === 0 && <Card><Empty icon={Newspaper} title="No news yet">Be the first to post.</Empty></Card>}
      <div className="grid md:grid-cols-2 gap-4">
        {(data || []).map((p) => (
          <Card key={p.id} className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {p.ghocs_claimable && <span className="badge bg-[#00AEEF]/10 text-[#00729F] border-[#00AEEF]/30"><Award size={12} aria-hidden="true" /> GHOCS-claimable</span>}
              {p.activity_level && <span className="badge bg-[#F5F7FC] text-[#0A1748] border-[rgba(10,23,72,0.12)]">{labelOf(ACTIVITY_LEVELS, p.activity_level)} level</span>}
              {p.dna_category && <span className="badge bg-[#F5F7FC] text-[#0A1748] border-[rgba(10,23,72,0.12)]">{labelOf(DNA_CATEGORIES, p.dna_category)}</span>}
            </div>
            <h2 className="font-heading font-bold text-lg">{p.title}</h2>
            <p className="text-xs text-[#5B6478]">
              {p.author?.name} · {formatDate(p.published_at)}
              {p.starts_on && ` · ${formatDate(p.starts_on)}${p.ends_on && p.ends_on !== p.starts_on ? ` to ${formatDate(p.ends_on)}` : ''}`}
              {p.location && ` · ${p.location}`}
            </p>
            <p className="text-[#5B6478] whitespace-pre-line">{p.body}</p>
          </Card>
        ))}
      </div>
      <Modal isOpen={writing} onClose={() => setWriting(false)} title="Post news" subtitle="SDCL approves posts before they appear." maxWidth="max-w-2xl">
        {campuses.data && <PostForm campuses={campuses.data} onDone={() => { setWriting(false); reload(); mine.reload(); }} />}
      </Modal>
    </CampusPage>
  );
};

export default CampusNews;
