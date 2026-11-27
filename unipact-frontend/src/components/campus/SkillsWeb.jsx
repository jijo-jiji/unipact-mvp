import React, { useState } from 'react';

// The UniKL DNA transferable-skills web (SC1–SC5): one series, the student's points as a share of the campus
// target. Rings at 25/50/75/100% of the target; the 100% ring is dashed and labelled "Target". Hovering an
// axis shows the exact value; the same numbers are in the table next to it on the page.
const SIZE = 340;
const C = SIZE / 2;
const R = 118;
const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
const at = (i, f) => [C + R * f * Math.cos(angle(i)), C + R * f * Math.sin(angle(i))];
const ring = (f) => [0, 1, 2, 3, 4].map((i) => at(i, f).join(',')).join(' ');

const SkillsWeb = ({ web, target }) => {
  const [hover, setHover] = useState(null);
  const shape = web.map((row, i) => at(i, Math.max(row.percent, 0) / 100).join(',')).join(' ');
  const empty = web.every((row) => Number(row.points) === 0);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[340px] mx-auto block" role="img"
        aria-label={`Transferable skills web. ${web.map((r) => `${r.code} ${r.percent}% of target`).join(', ')}.`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <polygon key={f} points={ring(f)} fill="none" stroke="rgba(10,23,72,0.10)" strokeWidth="1" />
        ))}
        <polygon points={ring(1)} fill="none" stroke="rgba(10,23,72,0.35)" strokeWidth="1.25" strokeDasharray="4 4" />
        {web.map((row, i) => {
          const [x, y] = at(i, 1);
          return <line key={row.code} x1={C} y1={C} x2={x} y2={y} stroke="rgba(10,23,72,0.10)" strokeWidth="1" />;
        })}
        <text x={at(0, 1)[0] + 6} y={at(0, 1)[1] + 14} fontSize="10" fill="#5B6478">Target</text>
        {!empty && (
          <polygon points={shape} fill="rgba(0,174,239,0.22)" stroke="#00AEEF" strokeWidth="2" strokeLinejoin="round" />
        )}
        {web.map((row, i) => {
          const [x, y] = at(i, Math.max(row.percent, 0) / 100);
          const [lx, ly] = at(i, 1.16);
          return (
            <g key={row.code} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)}
              onBlur={() => setHover(null)} tabIndex={0} aria-label={`${row.code} ${row.name}: ${Number(row.points)} points, ${row.percent}% of target`}>
              <circle cx={x} cy={y} r="14" fill="transparent" />
              {!empty && <circle cx={x} cy={y} r={hover === i ? 6 : 4.5} fill="#fff" stroke="#0B1E63" strokeWidth="2" />}
              <text x={lx} y={ly + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0A1748" fontFamily="Outfit, Inter, sans-serif">{row.code}</text>
            </g>
          );
        })}
        {hover !== null && (() => {
          const row = web[hover];
          const [x, y] = at(hover, Math.max(row.percent, 0) / 100);
          const tx = Math.min(Math.max(x, 70), SIZE - 70);
          const ty = y < C ? y + 22 : y - 44;
          return (
            <g pointerEvents="none">
              <rect x={tx - 66} y={ty} width="132" height="34" rx="6" fill="#0A1748" />
              <text x={tx} y={ty + 14} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{row.code} · {Number(row.points)} pts</text>
              <text x={tx} y={ty + 27} textAnchor="middle" fontSize="10" fill="#C9D3EA">{row.percent}% of target {Number(target)}</text>
            </g>
          );
        })()}
      </svg>
      {empty && <figcaption className="text-center text-sm text-[#5B6478] -mt-2">Your web grows as you take part in activities.</figcaption>}
    </figure>
  );
};

export default SkillsWeb;
