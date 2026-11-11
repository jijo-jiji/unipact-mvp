import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Download, ExternalLink, Eye, EyeOff, FileText, Loader2, PenLine, Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/format';

const TOPICS = [
  ['B40', 'B40 upskilling'],
  ['DIGITAL_MARKETING', 'Digital marketing'],
  ['SOFTWARE', 'Software development'],
  ['OTHER', 'Other'],
];

const emptyModule = { title: '', topic: 'DIGITAL_MARKETING', summary: '' };
const emptyItem = { item_type: 'MATERIAL', title: '', description: '', link_url: '', file: null };

const ItemForm = ({ moduleId, onAdded }) => {
  const { showToast } = useToast();
  const [item, setItem] = useState(emptyItem);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0); // resets the file input after a save
  const exercise = item.item_type === 'EXERCISE';

  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('item_type', item.item_type);
    form.append('title', item.title);
    form.append('description', item.description);
    form.append('link_url', item.link_url.trim());
    if (item.file) form.append('file', item.file);
    setBusy(true);
    try {
      await api.post(`/impact/admin/modules/${moduleId}/items/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setItem(emptyItem);
      setFileKey((k) => k + 1);
      onAdded();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not add this item.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-dashed border-[rgba(10,23,72,0.2)] p-4 grid sm:grid-cols-2 gap-3 mt-4">
      <div className="sm:col-span-2 flex gap-1" role="group" aria-label="Item type">
        {[['MATERIAL', 'Material'], ['EXERCISE', 'Exercise']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={item.item_type === value}
            onClick={() => setItem({ ...item, item_type: value })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${item.item_type === value ? 'bg-[#0B1E63] text-white border-[#0B1E63]' : 'bg-white text-[#5B6478] border-[rgba(10,23,72,0.12)]'}`}
          >
            {value === 'EXERCISE' ? <PenLine size={14} /> : <FileText size={14} />} {label}
          </button>
        ))}
      </div>
      <input className="input sm:col-span-2" required placeholder={exercise ? 'Exercise title, e.g. Design a poster for a cafe' : 'Title, e.g. Workshop slides'} value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />
      <textarea
        className="input sm:col-span-2"
        rows={exercise ? 4 : 2}
        placeholder={exercise ? 'Instructions: what to make, what a good answer looks like, how long it should take' : 'Short description (optional)'}
        value={item.description}
        onChange={(e) => setItem({ ...item, description: e.target.value })}
      />
      <label className="block">
        <span className="field-label">File (PDF, slides, worksheet…)</span>
        <input key={fileKey} className="input" type="file" onChange={(e) => setItem({ ...item, file: e.target.files[0] || null })} />
      </label>
      <label className="block">
        <span className="field-label">Or a link (Canva, Google Slides, YouTube)</span>
        <input className="input" type="url" placeholder="https://" value={item.link_url} onChange={(e) => setItem({ ...item, link_url: e.target.value })} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add {exercise ? 'exercise' : 'material'}
        </button>
      </div>
    </form>
  );
};

const AdminLearningPanel = () => {
  const { showToast } = useToast();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyModule);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/impact/admin/modules/');
      setModules(res.data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load the modules.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const createModule = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/impact/admin/modules/', { ...draft, order: modules.length });
      setDraft(emptyModule);
      setOpen(res.data.id);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not create the module.'), 'error');
    }
  };

  const togglePublished = async (m) => {
    if (!m.is_published && m.items.length === 0 && !window.confirm('This module has no materials yet. Publish it anyway?')) return;
    try {
      await api.patch(`/impact/admin/modules/${m.id}/`, { is_published: !m.is_published });
      showToast(m.is_published ? 'Module hidden from students.' : 'Module published to students.', 'success');
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the module.'), 'error');
    }
  };

  const remove = async (url, message) => {
    if (!window.confirm(message)) return;
    try {
      await api.delete(url);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not delete it.'), 'error');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00AEEF]" /></div>;

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-xl">Learning library</h2>
            <p className="text-sm text-[#5B6478] mt-1 max-w-[640px]">
              Save each workshop module with its slides, notes and exercises. Students see published modules on their Learning page.
            </p>
          </div>
          <Link to="/learning" className="btn btn-secondary btn-sm"><Eye size={14} /> See it as a student</Link>
        </div>
        <form onSubmit={createModule} className="grid sm:grid-cols-3 gap-3 mt-5">
          <input className="input sm:col-span-2" required placeholder="New module title, e.g. Social media content for small businesses" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <select className="input" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} aria-label="Topic">
            {TOPICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <textarea className="input sm:col-span-3" rows={2} placeholder="What students will learn (optional)" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
          <div className="sm:col-span-3">
            <button type="submit" className="btn btn-navy btn-sm"><Plus size={14} /> Create module</button>
          </div>
        </form>
      </section>

      {modules.length === 0 && <p className="text-sm text-[#5B6478]">No modules yet. Create the first one above.</p>}

      {modules.map((m) => {
        const expanded = open === m.id;
        return (
          <section key={m.id} className="card bg-white border border-[rgba(10,23,72,0.1)]">
            <div className="p-5 sm:p-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setOpen(expanded ? null : m.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left" aria-expanded={expanded}>
                {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="min-w-0">
                  <span className="block font-heading font-bold text-lg truncate">{m.title}</span>
                  <span className="block text-sm text-[#5B6478]">{m.topic_label} · {m.items.length} item{m.items.length === 1 ? '' : 's'}</span>
                </span>
              </button>
              <span className={`badge ${m.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-[#0A1748]/5 text-[#5B6478]'}`}>{m.is_published ? 'Published' : 'Draft'}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => togglePublished(m)}>
                {m.is_published ? <><EyeOff size={14} /> Unpublish</> : <><Eye size={14} /> Publish</>}
              </button>
              <button type="button" className="text-[#5B6478] hover:text-red-600 p-1" onClick={() => remove(`/impact/admin/modules/${m.id}/`, `Delete "${m.title}" and all its files?`)} aria-label={`Delete ${m.title}`}>
                <Trash2 size={16} />
              </button>
            </div>
            {expanded && (
              <div className="px-5 sm:px-6 pb-6 border-t border-[rgba(10,23,72,0.08)]">
                {m.summary && <p className="text-sm text-[#5B6478] mt-4 whitespace-pre-line">{m.summary}</p>}
                {m.items.length > 0 && (
                  <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
                    {m.items.map((item) => (
                      <li key={item.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {item.item_type === 'EXERCISE' && <span className="text-xs font-bold uppercase tracking-wider text-[#00729F] mr-2">Exercise</span>}
                            {item.title}
                          </p>
                          {item.description && <p className="text-sm text-[#5B6478] line-clamp-2">{item.description}</p>}
                          <div className="flex flex-wrap gap-3 mt-1 text-sm">
                            {item.file_url && <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#00729F] hover:underline"><Download size={13} /> {item.file_name}</a>}
                            {item.link_url && <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#00729F] hover:underline"><ExternalLink size={13} /> Link</a>}
                          </div>
                        </div>
                        <button type="button" className="text-[#5B6478] hover:text-red-600 p-1" onClick={() => remove(`/impact/admin/items/${item.id}/`, `Remove "${item.title}"?`)} aria-label={`Remove ${item.title}`}>
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <ItemForm moduleId={m.id} onAdded={load} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default AdminLearningPanel;
