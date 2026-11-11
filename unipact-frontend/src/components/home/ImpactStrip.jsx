import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { formatMoney } from '../../utils/format';

// "Our impact" on the front page. Hidden until an admin publishes the figures from the Impact tab,
// and hidden if the request fails, so the page never shows a zero or a broken number.
const ImpactStrip = () => {
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/impact/')
      .then((res) => { if (alive && res.data?.published) setImpact(res.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!impact) return null;

  const figures = [
    { value: impact.workshops_held, label: 'Workshops held', note: impact.workshop_attendees ? `${impact.workshop_attendees} attendees` : null },
    { value: impact.b40_students_paid, label: 'B40 students paid', note: 'For real client projects' },
    { value: formatMoney(impact.b40_amount_paid), label: 'Paid to B40 students', note: 'Disbursed to their bank accounts' },
    { value: impact.projects_delivered, label: 'Projects delivered', note: null },
  ];

  return (
    <section id="impact" className="scroll-mt-[128px] pb-16 sm:pb-24">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
        <p className="eyebrow mb-3"><span className="eyebrow-dot" /> Our impact</p>
        <h2 className="font-heading font-bold tracking-[-0.5px] text-[clamp(1.75rem,3vw,2.5rem)] text-balance max-w-[700px]">
          Paid work for students who need it most
        </h2>
        <div className="h-0.5 w-16 bg-[#00AEEF] mt-5 mb-10" aria-hidden="true" />
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-[rgba(10,23,72,0.12)] bg-[rgba(10,23,72,0.12)]">
          {figures.map(({ value, label, note }) => (
            <div key={label} className="bg-white p-5 sm:p-7 flex flex-col">
              <dt className="order-2 font-semibold text-[#0A1748] mt-2">{label}</dt>
              <dd className="order-1 font-heading font-bold text-[clamp(1.75rem,3.2vw,2.5rem)] text-[#0B1E63] tabular-nums leading-none">{value}</dd>
              {note && <dd className="order-3 text-sm text-[#5B6478] mt-1">{note}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default ImpactStrip;
