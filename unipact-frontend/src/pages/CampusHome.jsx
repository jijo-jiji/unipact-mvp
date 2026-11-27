import React, { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import api from '../api/client';
import WorkspaceNav from '../components/WorkspaceNav';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

// UniPact Campus home (M0): the signed-in person's current campus roles. Club, activity and approval screens
// hang off this page from M1 onwards.
const CampusHome = () => {
  usePageTitle('Campus');
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | off | error
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get('/campus/me/')
      .then((res) => { if (alive) { setData(res.data); setState('ready'); } })
      .catch((err) => {
        if (!alive) return;
        if (err?.response?.status === 404) setState('off');
        else { setError(getErrorMessage(err, "We couldn't load your campus roles.")); setState('error'); }
      });
    return () => { alive = false; };
  }, []);

  const assignments = data?.assignments || [];

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
      <WorkspaceNav />
      <main className="max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-8 space-y-6 flex-1">
        <div>
          <p className="eyebrow mb-2"><span className="eyebrow-dot" /> UniPact Campus</p>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">Campus</h1>
          <p className="text-sm text-[#5B6478] mt-1 max-w-[640px]">
            Clubs, activity approvals and GHOCS points for your campus. Your roles below decide what you can do.
          </p>
        </div>

        {state === 'loading' && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00AEEF]" /></div>}
        {state === 'error' && <p className="alert-error">{error}</p>}
        {state === 'off' && (
          <div className="card p-10 bg-white border border-[rgba(10,23,72,0.1)] text-center">
            <Building2 className="mx-auto text-[#00AEEF]" size={28} aria-hidden="true" />
            <p className="font-semibold mt-3">Campus isn't open yet</p>
            <p className="text-sm text-[#5B6478] mt-1">Your university's campus space will appear here once it is switched on.</p>
          </div>
        )}

        {state === 'ready' && (
          <section className="card p-5 sm:p-6 bg-white border border-[rgba(10,23,72,0.1)]">
            <h2 className="font-heading font-bold text-xl">Your roles</h2>
            {data.is_platform_admin && (
              <p className="text-sm text-[#5B6478] mt-1">You are a UniPact admin, so you can manage every campus.</p>
            )}
            {assignments.length === 0 && !data.is_platform_admin && (
              <p className="text-sm text-[#5B6478] mt-2">
                You don't hold a campus role yet. Your campus office or club advisor adds you.
              </p>
            )}
            {assignments.length > 0 && (
              <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-3 border-t border-[rgba(10,23,72,0.08)]">
                {assignments.map((a) => (
                  <li key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="font-semibold">
                        {a.position ? `${a.position} · ` : ''}{a.role_label}
                      </p>
                      <p className="text-sm text-[#5B6478]">
                        {a.unit.name}{a.campus && a.campus.id !== a.unit.id ? ` · ${a.campus.short_name || a.campus.name}` : ''}
                      </p>
                    </div>
                    {a.session && <span className="text-xs text-[#5B6478]">{a.session}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default CampusHome;
