import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Plus, QrCode, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import AdminWorkshopModal from './AdminWorkshopModal';
import { formatDate, formatMoney, getErrorMessage } from '../utils/format';

const KINDS = [
  ['B40', 'B40 upskilling'],
  ['DIGITAL_MARKETING', 'Digital marketing'],
  ['SOFTWARE', 'Software development'],
  ['OTHER', 'Other'],
];

// Every figure is counted from UniPact's own records; nothing is entered by hand
const ROWS = [
  ['workshops_held', 'Workshops held', false],
  ['workshop_attendees', 'Workshop attendees', false],
  ['b40_students_paid', 'B40 students paid', false],
  ['b40_amount_paid', 'Paid to B40 students', true],
  ['projects_delivered', 'Projects delivered', false],
  ['students_paid', 'All students paid (admin only)', false],
  ['amount_paid', 'Paid to all students (admin only)', true],
];

const today = () => new Date().toISOString().slice(0, 10);
const emptyWorkshop = () => ({ title: '', kind: 'B40', held_on: today(), location: '', attendees: '', module_ids: [] });

const AdminImpactPanel = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [workshops, setWorkshops] = useState([]);
  const [b40, setB40] = useState([]);
  const [students, setStudents] = useState([]);
  const [modules, setModules] = useState([]);
  const [openWorkshop, setOpenWorkshop] = useState(null);
  const [saving, setSaving] = useState(false);
  const [workshop, setWorkshop] = useState(emptyWorkshop);
  const [pick, setPick] = useState({ student_id: '', evidence_note: '' });

  const load = useCallback(async () => {
    try {
      const [impactRes, workshopRes, b40Res, studentRes, moduleRes] = await Promise.all([
        api.get('/impact/admin/'), api.get('/impact/admin/workshops/'), api.get('/impact/admin/b40/'), api.get('/users/admin/students/'),
        api.get('/impact/admin/modules/'),
      ]);
      setStats(impactRes.data.stats);
      setConfig(impactRes.data.settings);
      setStartDate(impactRes.data.settings.counting_starts_on || '');
      setWorkshops(workshopRes.data);
      setB40(b40Res.data);
      setStudents(studentRes.data);
      setModules(moduleRes.data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load the impact figures.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const unmarked = useMemo(() => {
    const marked = new Set(b40.map((r) => r.student_id));
    return students.filter((s) => !marked.has(s.id));
  }, [students, b40]);

  const saveSettings = async (changes) => {
    setSaving(true);
    try {
      const res = await api.patch('/impact/admin/', changes);
      setStats(res.data.stats);
      setConfig(res.data.settings);
      setStartDate(res.data.settings.counting_starts_on || '');
      showToast('Impact counter updated.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the counter.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addWorkshop = async (e) => {
    e.preventDefault();
    try {
      await api.post('/impact/admin/workshops/', { ...workshop, attendees: Number(workshop.attendees) || 0 });
      setWorkshop(emptyWorkshop());
      showToast('Workshop logged.', 'success');
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not log the workshop.'), 'error');
    }
  };

  const removeWorkshop = async (id) => {
    if (!window.confirm('Remove this workshop from the count?')) return;
    try {
      await api.delete(`/impact/admin/workshops/${id}/`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not remove the workshop.'), 'error');
    }
  };

  const markB40 = async (e) => {
    e.preventDefault();
    if (!pick.student_id) return;
    try {
      await api.post('/impact/admin/b40/', pick);
      setPick({ student_id: '', evidence_note: '' });
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not mark the student.'), 'error');
    }
  };

  const unmarkB40 = async (id) => {
    if (!window.confirm('Remove this student from the B40 count?')) return;
    try {
      await api.delete(`/impact/admin/b40/${id}/`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the student.'), 'error');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00AEEF]" /></div>;
  }
  if (!stats || !config) return <p className="text-[#5B6478]">The impact figures could not be loaded.</p>;

  const show = (value, money) => (money ? formatMoney(value) : value);

  return (
    <div className="space-y-6">
      {/* Figures and publishing */}
      <section className="card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)]">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-heading font-bold text-xl">Front-page impact counter</h2>
            <p className="text-sm text-[#5B6478] mt-1 max-w-[620px]">
              Counted only from records on UniPact: workshops logged below, payouts marked as disbursed and
              completed projects. Only the totals of the first five rows go on the front page, never names.
            </p>
          </div>
          <button
            type="button"
            className={config.show_on_homepage ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
            disabled={saving}
            onClick={() => saveSettings({ show_on_homepage: !config.show_on_homepage })}
          >
            {config.show_on_homepage ? <><EyeOff size={14} /> Hide from front page</> : <><Eye size={14} /> Publish on front page</>}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[#5B6478]">
              <tr>
                <th className="py-2 pr-4 font-medium">Figure</th>
                <th className="py-2 pl-4 font-medium text-right">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(10,23,72,0.08)]">
              {ROWS.map(([key, label, money]) => (
                <tr key={key}>
                  <td className="py-2 pr-4">{label}</td>
                  <td className="py-2 pl-4 text-right tabular-nums font-semibold">{show(stats[key], money)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#5B6478] mt-3">
          {config.counting_starts_on
            ? `Counting records from ${formatDate(config.counting_starts_on)}. `
            : 'Counting all records. '}
          Payouts count once disbursed, workshops once their date has passed.
        </p>
      </section>

      {/* Counting start date */}
      <section className="card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)]">
        <h2 className="font-heading font-bold text-xl">Start counting from</h2>
        <p className="text-sm text-[#5B6478] mt-1 mb-4 max-w-[680px]">
          Leave out anything older than this date, such as test projects or payouts from before the team recorded
          everything on UniPact. Leave it empty to count every record.
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings({ counting_starts_on: startDate || null });
          }}
        >
          <label className="block">
            <span className="field-label">Start date</span>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-navy btn-sm" disabled={saving}>Save date</button>
          {config.counting_starts_on && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => saveSettings({ counting_starts_on: null })}>
              Count everything
            </button>
          )}
        </form>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Workshops */}
        <section className="card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)]">
          <h2 className="font-heading font-bold text-xl mb-4">Workshops</h2>
          <form className="grid sm:grid-cols-2 gap-3 mb-5" onSubmit={addWorkshop}>
            <input className="input sm:col-span-2" required placeholder="Title" value={workshop.title} onChange={(e) => setWorkshop({ ...workshop, title: e.target.value })} />
            <select className="input" value={workshop.kind} onChange={(e) => setWorkshop({ ...workshop, kind: e.target.value })} aria-label="Type">
              {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="input" type="date" required value={workshop.held_on} onChange={(e) => setWorkshop({ ...workshop, held_on: e.target.value })} aria-label="Date" />
            <input className="input" placeholder="Location" value={workshop.location} onChange={(e) => setWorkshop({ ...workshop, location: e.target.value })} />
            <input className="input" type="number" min="0" placeholder="Attendees (if not using check-in)" value={workshop.attendees} onChange={(e) => setWorkshop({ ...workshop, attendees: e.target.value })} />
            {modules.length > 0 && (
              <fieldset className="sm:col-span-2">
                <legend className="field-label">Modules taught</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {modules.map((m) => (
                    <label key={m.id} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={workshop.module_ids.includes(m.id)}
                        onChange={(e) => setWorkshop({
                          ...workshop,
                          module_ids: e.target.checked ? [...workshop.module_ids, m.id] : workshop.module_ids.filter((id) => id !== m.id),
                        })}
                      />
                      {m.title}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /> Log workshop</button>
            </div>
          </form>
          {workshops.length === 0 ? (
            <p className="text-sm text-[#5B6478]">No workshops logged yet.</p>
          ) : (
            <ul className="divide-y divide-[rgba(10,23,72,0.08)]">
              {workshops.map((w) => (
                <li key={w.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{w.title}</p>
                    <p className="text-sm text-[#5B6478]">{formatDate(w.held_on)} · {w.kind_label} · {w.checkin_count > 0 ? `${w.checkin_count} checked in` : `${w.attendees} attendees`}{w.location ? ` · ${w.location}` : ''}</p>
                    {w.module_titles?.length > 0 && <p className="text-xs text-[#5B6478] mt-0.5">Modules: {w.module_titles.join(', ')}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenWorkshop(w)}>
                      <QrCode size={14} /> Check-in & results
                    </button>
                    <button type="button" className="text-[#5B6478] hover:text-red-600 p-1" onClick={() => removeWorkshop(w.id)} aria-label={`Remove ${w.title}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* B40 students */}
        <section className="card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)]">
          <h2 className="font-heading font-bold text-xl">B40 students</h2>
          <p className="text-sm text-[#5B6478] mt-1 mb-4">Private: only admins see who is on this list. Mark a student only after checking proof such as an STR letter.</p>
          <form className="grid sm:grid-cols-2 gap-3 mb-5" onSubmit={markB40}>
            <select className="input sm:col-span-2" required value={pick.student_id} onChange={(e) => setPick({ ...pick, student_id: e.target.value })} aria-label="Student">
              <option value="">Choose a student…</option>
              {unmarked.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.university}</option>)}
            </select>
            <input className="input sm:col-span-2" placeholder="Proof checked (e.g. STR letter seen 12 Oct)" value={pick.evidence_note} onChange={(e) => setPick({ ...pick, evidence_note: e.target.value })} />
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary btn-sm" disabled={!pick.student_id}><Plus size={14} /> Mark as B40</button>
            </div>
          </form>
          {b40.length === 0 ? (
            <p className="text-sm text-[#5B6478]">No students marked yet.</p>
          ) : (
            <ul className="divide-y divide-[rgba(10,23,72,0.08)]">
              {b40.map((r) => (
                <li key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.full_name}</p>
                    <p className="text-sm text-[#5B6478]">{r.university} · paid {formatMoney(r.amount_paid)}{r.evidence_note ? ` · ${r.evidence_note}` : ''}</p>
                  </div>
                  <button type="button" className="text-[#5B6478] hover:text-red-600 p-1" onClick={() => unmarkB40(r.id)} aria-label={`Remove ${r.full_name} from the B40 list`}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {openWorkshop && (
        <AdminWorkshopModal key={openWorkshop.id} workshop={openWorkshop} onClose={() => setOpenWorkshop(null)} onChanged={load} />
      )}
    </div>
  );
};

export default AdminImpactPanel;
