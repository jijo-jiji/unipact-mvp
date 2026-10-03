import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout } from './LegalPages';
import { AGREEMENTS, UNIPACT_PARTY } from '../utils/agreements';
import { usePageTitle } from '../hooks/usePageTitle';

/*
 * The Talent Agreement and Client Service Agreement, as accepted inside the app.
 *
 * DRAFT WORDING from the UniPact agreements pack (29 September 2026): not legal advice, and still to be
 * reviewed by a Malaysian lawyer. When the wording changes, change `version` in src/utils/agreements.js and
 * CURRENT_VERSIONS in the API's users/agreements.py too, so everyone is asked to accept the new text.
 */

const unipact = `${UNIPACT_PARTY.owner} trading as ${UNIPACT_PARTY.name}, Registration No. ${UNIPACT_PARTY.registrationNumber}, ${UNIPACT_PARTY.address}`;

// A section is a list of numbered clauses. The parties and acceptance blocks carry no number, so
// clause numbers match the signed document (1.1 is the first clause of its first numbered section).
const toSections = (parts) => {
  let count = 0;
  return parts.map(({ id, title, intro, clauses = [], unnumbered }) => {
    const number = unnumbered ? null : (count += 1);
    return {
      id,
      title,
      unnumbered,
      body: (
        <>
          {intro}
          {clauses.map((text, i) => (
            <p key={text}><strong>{number}.{i + 1}</strong> {text}</p>
          ))}
        </>
      ),
    };
  });
};

const DraftNotice = ({ agreement, who }) => (
  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
    <strong>{agreement.versionLabel}.</strong> This wording is still being reviewed by UniPact&apos;s lawyer. If it changes,
    {' '}{who} will be asked to read and accept the new version before their next {agreement.key === 'TALENT' ? 'job' : 'payment'}.
  </div>
);

const Acceptance = ({ who }) => (
  <p>
    This agreement is accepted electronically on app.unipact.my. UniPact records the account that accepted it, the version
    accepted, and the date and time, and {who} can ask UniPact for a copy of that record at any time.
  </p>
);

export const TalentAgreementPage = () => {
  const agreement = AGREEMENTS.TALENT;
  usePageTitle(agreement.title);

  const sections = toSections([
    {
      id: 'parties', title: 'Who this agreement is between', unnumbered: true,
      intro: (
        <>
          <DraftNotice agreement={agreement} who="students" />
          <p>This agreement is between {unipact} (<strong>UniPact</strong>), and the student who accepts it (the <strong>Talent</strong>). If UniPact is incorporated as UniPact Sdn Bhd, this agreement passes to the new company on the same terms.</p>
          <p>It applies together with UniPact&apos;s <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>; where they differ, this agreement takes priority.</p>
        </>
      ),
    },
    {
      id: 'who-can-join', title: 'Who can join',
      clauses: [
        'The Talent is an active university student, verified by UniPact through a student ID and a skills check.',
        'The Talent is 18 or older.',
      ],
    },
    {
      id: 'status', title: 'Status',
      clauses: [
        'The Talent is an independent contractor, not an employee of UniPact or of any client. The Talent chooses which jobs to accept.',
        'The Talent is responsible for their own income tax.',
      ],
    },
    {
      id: 'jobs', title: 'Jobs',
      clauses: [
        'UniPact offers the Talent jobs from Job Orders agreed with clients. Each offer states the deliverables, deadline and the Talent’s payout.',
        'Once the Talent accepts a job, they deliver it on time and to the brief, including up to 2 rounds of minor revisions.',
        'The Talent communicates with clients through UniPact, and tells UniPact at once if a deadline is at risk.',
      ],
    },
    {
      id: 'payouts', title: 'Payouts',
      clauses: [
        'The payout for each job is stated in the job offer before the Talent accepts it.',
        'UniPact pays the Talent within 7 working days after the client accepts the deliverable, by bank transfer.',
        'If a client refuses to pay for work that matches the Job Order, UniPact still pays the Talent for accepted milestones and handles the dispute with the client.',
      ],
    },
    {
      id: 'standards', title: 'Standards and replacement',
      clauses: [
        'The Talent delivers original work, with no copied code, footage, music or designs without a proper licence.',
        'For software, the Talent fixes bugs in their own work for 30 days after acceptance, at no extra payout.',
        'If the Talent cannot finish a job (exams, illness or other reasons), they tell UniPact as early as possible. UniPact assigns a replacement and pays the Talent for completed milestones only.',
        'UniPact may pause or remove a Talent who repeatedly misses deadlines, delivers poor work, or behaves unprofessionally.',
      ],
    },
    {
      id: 'ip', title: 'Intellectual property',
      clauses: [
        'The Talent assigns all rights in their job deliverables to UniPact once they are paid for that work. UniPact passes these rights to the client.',
        'The Talent keeps rights in general skills, know-how and any tools they owned before the job.',
      ],
    },
    {
      id: 'portfolio', title: 'Portfolio and verified record',
      clauses: [
        'Every accepted job is added to the Talent’s verified record on UniPact, which the Talent may share with employers.',
        'The Talent may show the actual work in a portfolio only after the client approves it in writing. Otherwise, the record shows only the job type and outcome.',
      ],
    },
    {
      id: 'confidentiality', title: 'Confidentiality and data',
      clauses: [
        'The Talent keeps client information, files and login details confidential, during and after the job, and deletes client files when UniPact asks.',
        'The Talent handles any personal data in client files only for the job, in line with the Personal Data Protection Act 2010.',
      ],
    },
    {
      id: 'off-platform', title: 'Working off-platform',
      clauses: [
        'For 12 months after the Talent’s last job for a client, any further work for that client goes through UniPact.',
        'If a client approaches the Talent directly, the Talent refers them back to UniPact. The Talent may still work with anyone they knew before UniPact introduced them.',
      ],
    },
    {
      id: 'ending', title: 'Ending the agreement',
      clauses: [
        'The Talent may close their account at any time after finishing or handing over any accepted jobs.',
        'UniPact may close an account under clause 5.4 or for a breach of this agreement. Payouts already earned are still paid.',
      ],
    },
    {
      id: 'general', title: 'General',
      clauses: [
        'UniPact may update these terms with 30 days’ notice. Jobs already accepted stay on the old terms.',
        'This agreement is governed by the laws of Malaysia.',
      ],
    },
    { id: 'acceptance', title: 'Acceptance', unnumbered: true, intro: <Acceptance who="the Talent" /> },
  ]);

  return (
    <LegalLayout
      title={agreement.title}
      intro="The agreement every student accepts before taking paid jobs through UniPact."
      updated={agreement.versionLabel}
      sections={sections}
    />
  );
};

export const ClientAgreementPage = () => {
  const agreement = AGREEMENTS.CLIENT;
  usePageTitle(agreement.title);

  const sections = toSections([
    {
      id: 'parties', title: 'Who this agreement is between', unnumbered: true,
      intro: (
        <>
          <DraftNotice agreement={agreement} who="clients" />
          <p>This agreement is between {unipact} (<strong>UniPact</strong>), and the company that accepts it on app.unipact.my, as named in its UniPact account (the <strong>Client</strong>). It takes effect on the date the Client accepts it. If UniPact is incorporated as UniPact Sdn Bhd, this agreement passes to the new company on the same terms.</p>
          <p>It applies together with UniPact&apos;s <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>; where they differ, this agreement takes priority.</p>
        </>
      ),
    },
    {
      id: 'service', title: 'What UniPact provides',
      clauses: [
        'UniPact delivers software, digital marketing and content services through verified university students (Talent) that UniPact selects, manages and quality-checks.',
        'UniPact is responsible to the Client for the delivery. The Client deals with UniPact, not directly with the Talent, on scope, payment and disputes.',
      ],
    },
    {
      id: 'job-orders', title: 'Job Orders',
      clauses: [
        'Each piece of work is set out in a Job Order on app.unipact.my or in writing. A Job Order states the deliverables, milestones, deadlines, price and what the Client must supply.',
        'Work outside a Job Order is a new Job Order.',
        'The Client supplies on time everything the Job Order lists, such as raw footage, logos, brand guidelines, system access and data. Deadlines move by any delay in supplying it.',
      ],
    },
    {
      id: 'price', title: 'Price and escrow',
      clauses: [
        'Prices follow UniPact’s published rate card or the quote in the Job Order. Examples: software projects from RM5,000; content retainers at RM1,500 a month for 30 short videos.',
        'The Client pays each milestone in full before work on it starts, through toyyibPay (FPX, DuitNow QR or card) or by bank transfer against a UniPact invoice. UniPact keeps these funds in a bank account used only for client funds, and releases them to the Talent only when the milestone is accepted. UniPact pays the payment gateway fees.',
        'Monthly retainers are paid in advance at the start of each month.',
        'Ad spend on Meta, Google or other platforms is paid by the Client directly to those platforms, not through UniPact.',
        'For software projects, the price includes hosting and a domain for the Client’s system for 12 months from go-live. After that, the Client pays renewals directly to the providers, or UniPact can quote a separate hosting and maintenance plan. UniPact sets up these accounts in the Client’s name where possible and hands over all logins at the end of the 12 months.',
      ],
    },
    {
      id: 'revisions', title: 'Revisions and acceptance',
      clauses: [
        'Each deliverable includes 2 rounds of minor revisions, such as text changes, music swaps, colour or layout tweaks, and small bug fixes. Major changes to structure or scope are a new Job Order.',
        'Within 5 working days of delivery, the Client either accepts it or requests a revision in writing, saying what does not match the Job Order.',
        'If the Client does neither within 5 working days, the deliverable is treated as accepted and payment is released.',
        'If UniPact cannot deliver a milestone that matches the Job Order after the included revisions, the Client gets a full refund of that milestone’s payment.',
      ],
    },
    {
      id: 'ip', title: 'Intellectual property',
      clauses: [
        'Once a milestone is paid in full, all rights in its deliverables pass to the Client.',
        'UniPact keeps its own platform, tools and reusable code libraries. The Client gets a permanent licence to use any of them built into its deliverables.',
        'The Client confirms it has the rights to everything it supplies (footage, logos, music, data).',
        'UniPact and the Talent may list the project, and show it in a portfolio, only with the Client’s written approval.',
      ],
    },
    {
      id: 'warranty', title: 'Warranty and replacement',
      clauses: [
        'Software deliverables come with 30 days of free bug fixes after acceptance, for defects against the Job Order.',
        'If a Talent becomes unavailable during a job, UniPact assigns a replacement at no extra cost and tells the Client within 2 working days.',
      ],
    },
    {
      id: 'direct', title: 'Working with Talent directly',
      clauses: [
        'For 12 months after a Talent’s last job for the Client, any further work between them goes through UniPact.',
        'If the Client hires or engages that Talent outside UniPact during those 12 months, the Client pays UniPact a conversion fee. The fee is the percentage stated in the Job Order, or in UniPact’s rate card if the Job Order states none, of the first 12 months’ fees paid to the Talent.',
      ],
    },
    {
      id: 'liability', title: 'Liability',
      clauses: [
        'UniPact’s total liability under a Job Order is limited to the amount the Client paid for that Job Order.',
        'Neither side is liable for indirect losses, such as lost profits or lost data, except where the law does not allow this limit.',
      ],
    },
    {
      id: 'data', title: 'Personal data',
      clauses: ['Each side handles personal data it receives only for the Job Order, in line with the Personal Data Protection Act 2010.'],
    },
    {
      id: 'ending', title: 'Ending the agreement',
      clauses: [
        'Either side may end this agreement with 14 days’ written notice. Accepted milestones stay paid; funds for work not yet started are refunded.',
        'Either side may end it immediately if the other seriously breaches it and does not fix the breach within 7 days of written notice.',
      ],
    },
    {
      id: 'disputes', title: 'Disputes and law',
      clauses: [
        'The parties will try to settle any dispute in good faith within 14 days, then through mediation. If that fails, the dispute goes to the Malaysian courts.',
        'This agreement is governed by the laws of Malaysia.',
      ],
    },
    { id: 'acceptance', title: 'Acceptance', unnumbered: true, intro: <Acceptance who="the Client" /> },
  ]);

  return (
    <LegalLayout
      title={agreement.title}
      intro="The agreement every client accepts before confirming a student team or paying for a project."
      updated={agreement.versionLabel}
      sections={sections}
    />
  );
};
