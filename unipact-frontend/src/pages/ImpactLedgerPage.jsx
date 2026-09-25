import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Download, FileSearch, Link2, Quote, Share2, ShieldCheck } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import BrandLogo from '../components/BrandLogo';
import PageLoader from '../components/PageLoader';
import { formatDate, formatMoney } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const READINESS = [
  ['project_completed', 'Project completed'],
  ['client_signed', 'Client signed the impact statement'],
  ['student_submitted', 'Student submitted their part'],
  ['escrow_released', 'Payout disbursed to the student'],
];

const SectionTitle = ({ children }) => (
  <h2 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-[#0090C6] mb-3">{children}</h2>
);

const ProofImage = ({ src, caption, label }) => (
  <figure className="space-y-2">
    <div className="aspect-[16/10] rounded-lg border border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] overflow-hidden flex items-center justify-center">
      <img src={src} alt={caption || label} className="w-full h-full object-contain" />
    </div>
    <figcaption className="text-xs font-semibold text-center text-[#0A1748]">
      <span className="text-[#5B6478] uppercase tracking-wide">{label}:</span> {caption}
    </figcaption>
  </figure>
);

const ImpactLedgerPage = () => {
  const { slug } = useParams();
  const { showToast } = useToast();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(ledger ? `Impact Ledger - ${ledger.student.full_name}` : 'Impact Ledger');

  useEffect(() => {
    let active = true;
    api.get(`/campaigns/ledger/${slug}/`)
      .then((res) => active && setLedger(res.data))
      .catch(() => active && setLedger(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Ledger link copied.', 'success');
    } catch {
      showToast('Copy the link from your browser address bar.', 'info');
    }
  };

  if (loading) return <PageLoader message="Loading ledger…" />;

  if (!ledger) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] font-body flex flex-col items-center justify-center px-6 text-center">
        <FileSearch size={44} className="text-[#5B6478]/50 mb-3" />
        <h1 className="font-heading font-bold text-xl text-[#0A1748] mb-2">Ledger not found</h1>
        <p className="text-sm text-[#5B6478] mb-6 max-w-sm">This impact ledger doesn&apos;t exist or hasn&apos;t been published yet. Check the link you were given.</p>
        <Link to="/" className="btn-primary">Go to UniPact</Link>
      </div>
    );
  }

  const { student, project, testimonial, proof } = ledger;
  const isPublished = ledger.status === 'PUBLISHED';
  const verifyUrl = `${window.location.origin}/ledger/${ledger.slug}`;
  const metrics = [...(ledger.metrics || []), { value: formatMoney(ledger.bounty_value), label: 'Bounty project value' }];
  const images = [
    proof.before_image && { src: proof.before_image, caption: proof.before_caption, label: 'Before' },
    proof.after_image && { src: proof.after_image, caption: proof.after_caption, label: 'After' },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body print:bg-white">
      {/* Toolbar: never part of the printed ledger */}
      <div className="print:hidden sticky top-0 z-10 bg-[rgba(245,247,252,0.94)] backdrop-blur-md border-b border-[rgba(10,23,72,0.08)]">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-3">
          <Link to="/" aria-label="UniPact home"><BrandLogo /></Link>
          <div className="flex gap-2">
            {isPublished && <button onClick={copyLink} className="btn-secondary btn-sm"><Share2 size={14} /> Copy link</button>}
            <button onClick={() => window.print()} className="btn-primary btn-sm"><Download size={14} /> Download PDF</button>
          </div>
        </div>
      </div>

      <main className="max-w-[860px] mx-auto px-4 sm:px-6 py-8 print:p-0 space-y-4">
        {!isPublished && (
          <div className="print:hidden p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <p className="font-semibold mb-2">Draft preview - only you, the client and UniPact can see this. It goes public once UniPact publishes it.</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {READINESS.map(([key, label]) => (
                <li key={key} className="flex items-center gap-1.5">
                  {ledger.readiness[key] ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Clock size={14} className="text-amber-600" />} {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <article className="ledger-sheet card p-6 sm:p-10 space-y-8 print:border-0 print:shadow-none print:p-0">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b-2 border-[#00AEEF]">
            <BrandLogo subtitle="Verified Impact Ledger" />
            {isPublished ? (
              <span className="badge bg-emerald-50 border-emerald-200 text-emerald-700 self-start sm:self-auto">
                <ShieldCheck size={14} /> Verified Complete (Escrow Released)
              </span>
            ) : (
              <span className="badge bg-amber-50 border-amber-200 text-amber-800 self-start sm:self-auto">Draft - not yet verified</span>
            )}
          </header>

          {/* Student & engagement */}
          <section className="flex flex-col md:flex-row justify-between gap-5 pl-5 border-l-4 border-[#0B1E63]">
            <div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0A1748] leading-tight">{student.full_name}</h1>
              <p className="text-[#5B6478] mt-1">
                {[student.major || student.university, student.role && `Role: ${student.role}`].filter(Boolean).join(' • ')}
              </p>
            </div>
            <dl className="text-sm md:text-right space-y-1">
              <div><dt className="inline font-semibold">Bounty ID: </dt><dd className="inline">#{ledger.bounty_id}</dd></div>
              <div>
                <dt className="inline font-semibold">Client: </dt>
                <dd className="inline">{project.client_name}{project.client_industry && ` (${project.client_industry})`}</dd>
              </div>
              {project.execution_days && (
                <div><dt className="inline font-semibold">Execution Time: </dt><dd className="inline">{project.execution_days} {project.execution_days === 1 ? 'Day' : 'Days'}</dd></div>
              )}
            </dl>
          </section>

          {/* Scope */}
          <section>
            <SectionTitle>Project Scope &amp; Execution</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-heading font-bold text-base mb-1.5">The Business Pain Point</h3>
                <p className="text-sm leading-relaxed whitespace-pre-line">{ledger.business_pain_point || '—'}</p>
              </div>
              <div>
                <h3 className="font-heading font-bold text-base mb-1.5">The Technical Solution</h3>
                <p className="text-sm leading-relaxed whitespace-pre-line">{ledger.technical_solution || '—'}</p>
              </div>
            </div>
          </section>

          {/* Metrics */}
          <section>
            <SectionTitle>Commercial Impact Metrics</SectionTitle>
            <div className={`grid grid-cols-1 gap-3 ${metrics.length === 3 ? 'sm:grid-cols-3' : metrics.length === 2 ? 'sm:grid-cols-2' : ''}`}>
              {metrics.map((m, i) => (
                <div key={i} className="rounded-xl border border-[rgba(10,23,72,0.12)] p-4 text-center">
                  <p className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0B1E63]">{m.value}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6478] mt-1">{m.label}</p>
                </div>
              ))}
            </div>
            {ledger.verified_skills?.length > 0 && (
              <p className="text-sm text-center mt-4">
                <span className="font-semibold">Verified Technical Skills:</span> {ledger.verified_skills.join(', ')}
              </p>
            )}
          </section>

          {/* Proof */}
          {(proof.url || images.length > 0) && (
            <section>
              <SectionTitle>Visual Proof of Work</SectionTitle>
              {proof.url && (
                <p className="text-sm mb-4 flex items-center gap-2 break-all">
                  <Link2 size={15} className="text-[#00AEEF] shrink-0" />
                  <span className="font-semibold shrink-0">Project link:</span>
                  <a href={proof.url} target="_blank" rel="noreferrer" className="text-[#0090C6] hover:underline">{proof.url.replace(/^https?:\/\//, '')}</a>
                </p>
              )}
              {images.length > 0 && (
                <div className={`grid grid-cols-1 gap-4 ${images.length === 2 ? 'sm:grid-cols-2' : ''}`}>
                  {images.map((img) => <ProofImage key={img.label} {...img} />)}
                </div>
              )}
            </section>
          )}

          {/* Testimonial & signature */}
          {testimonial.quote && (
            <section className="rounded-xl border border-[rgba(10,23,72,0.12)] p-5 sm:p-6">
              <Quote size={22} className="text-[#00AEEF] mb-2" />
              <p className="italic leading-relaxed">{testimonial.quote}</p>
              <div className="mt-5 pt-4 border-t border-[rgba(10,23,72,0.08)] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="font-heading font-bold">{testimonial.signer_name}</p>
                  <p className="text-sm text-[#5B6478]">{[testimonial.signer_title, project.client_name].filter(Boolean).join(', ')}</p>
                </div>
                {testimonial.signed_at && (
                  <div className="sm:text-right">
                    <p className="font-signature text-3xl text-[#0A1748] leading-none border-b border-[#0A1748] pb-1 inline-block">{testimonial.signer_name}</p>
                    <p className="text-[11px] text-[#5B6478] mt-1.5 flex sm:justify-end items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-600" /> Signed via verified UniPact client account · {formatDate(testimonial.signed_at)}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Verification & terminology */}
          <footer className="pt-5 border-t border-[rgba(10,23,72,0.12)] space-y-3 text-xs text-[#5B6478] leading-relaxed">
            <p>
              <span className="font-semibold text-[#0A1748]">Ledger ID {ledger.slug}</span>
              {isPublished && <> · Published {formatDate(ledger.published_at)} · Verify the original at <span className="text-[#0090C6] break-all">{verifyUrl}</span></>}
            </p>
            <p>
              <span className="font-semibold text-[#0A1748]">Corporate Terminology Guide: </span>
              <strong>Bounty / Project Value:</strong> a fixed compensation fee paid to the student upon successful completion of a specific
              freelance scope (not a recurring salary or internship allowance). <strong>Escrow Released:</strong> payment was held securely by
              UniPact and only released to the student after the corporate client verified the task was completed to industry standards.
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
};

export default ImpactLedgerPage;
