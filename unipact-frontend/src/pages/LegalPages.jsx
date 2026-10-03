import React from 'react';
import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import SiteFooter from '../components/SiteFooter';
import { LEGAL } from '../utils/legal';
import { SERVICE_FEE_PERCENT } from '../utils/constants';
import { usePageTitle } from '../hooks/usePageTitle';

/*
 * DRAFT LEGAL TEXT: written as a plain-language starting point for a Malaysian marketplace under the
 * Personal Data Protection Act 2010 (PDPA). It is not legal advice. Have it reviewed by a qualified
 * lawyer before launch, and confirm the business decisions marked "confirm" in DEPLOYMENT.md.
 */

const LegalLayout = ({ title, intro, sections }) => (
  <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col">
    <PublicNav />
    <main className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14">
      <div className="max-w-3xl mb-10">
        <p className="eyebrow mb-3"><span className="eyebrow-dot" /> Legal</p>
        <h1 className="font-heading font-extrabold tracking-tight text-[clamp(2rem,4vw,2.75rem)]">{title}</h1>
        <p className="text-sm text-[#5B6478] mt-2">Last updated {LEGAL.lastUpdated}</p>
        <p className="text-base sm:text-lg text-[#5B6478] mt-4">{intro}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10 items-start">
        <nav aria-label="On this page" className="hidden lg:block sticky top-28">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5B6478] mb-3">On this page</p>
          <ol className="space-y-1 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block py-1.5 text-[#5B6478] hover:text-[#0A1748]">{i + 1}. {s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="card p-6 sm:p-10 max-w-3xl space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="font-heading font-bold text-xl mb-3">{i + 1}. {s.title}</h2>
              <div className="space-y-3 text-[0.95rem] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-[#0090C6] [&_a]:underline">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </div>
    </main>
    <SiteFooter />
  </div>
);

const Contact = () => (
  <p>
    {LEGAL.entityName} ({LEGAL.registrationNumber})<br />
    {LEGAL.address}<br />
    Email: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
  </p>
);

export const PrivacyPolicyPage = () => {
  usePageTitle('Privacy Policy');

  const sections = [
    {
      id: 'who-we-are', title: 'Who we are',
      body: (
        <>
          <p>UniPact is operated by {LEGAL.entityName} (&quot;UniPact&quot;, &quot;we&quot;, &quot;us&quot;). We connect companies with verified university students for software development and digital marketing projects.</p>
          <p>This policy explains what personal data we collect, why, who we share it with and the choices you have, in line with Malaysia&apos;s Personal Data Protection Act 2010 (PDPA).</p>
        </>
      ),
    },
    {
      id: 'data-we-collect', title: 'Personal data we collect',
      body: (
        <>
          <p><strong>Information you give us:</strong></p>
          <ul>
            <li>Account details: name, email address, password (stored only in encrypted, hashed form) and account type.</li>
            <li>Student profiles: university, course, skills, bio, club affiliation, an optional backup email, and verification documents such as a student ID or enrolment letter.</li>
            <li>Company profiles: company name, SSM registration number and registration documents.</li>
            <li>Project content: project briefs, files you upload, deliverables and contribution notes, team invitations, ratings and feedback.</li>
            <li>Billing records: the amount, date, type and reference of payments. Online payments are processed by ToyyibPay through FPX online banking: we share the payer&apos;s name, email and phone number with ToyyibPay for the receipt, and we receive the payment status and reference, never your banking login or account details.</li>
            <li>Student payout details: the bank name, account number, account holder name or DuitNow ID a student gives us, used only to pay them for approved project milestones.</li>
          </ul>
          <p><strong>Information collected automatically:</strong> sign-in records, IP address and basic device information used for security (for example to block repeated failed sign-ins), and error reports that help us fix problems.</p>
        </>
      ),
    },
    {
      id: 'how-we-use', title: 'How we use your data',
      body: (
        <ul>
          <li>To create and secure your account, and to verify that students and companies are genuine.</li>
          <li>To match students to client projects and run those projects: sharing briefs and files, collecting deliverables and recording ratings.</li>
          <li>To send you service emails, such as verification results, match updates, password resets and payment receipts.</li>
          <li>To process fees and keep financial records required by law.</li>
          <li>To prevent fraud and abuse, keep the platform secure and fix errors.</li>
          <li>To improve UniPact using aggregated information that does not identify you.</li>
        </ul>
      ),
    },
    {
      id: 'sharing', title: 'Who we share it with',
      body: (
        <>
          <ul>
            <li><strong>Companies you are matched with</strong> see your name, university, course, skills, bio, rating and the work you submit on their project.</li>
            <li><strong>Students matched to a company&apos;s project</strong> see the company name, the project brief and the files shared with the team.</li>
            <li><strong>Anyone with the link</strong> can view a student&apos;s public portfolio: name, university, course, skills, bio, rating and the types of jobs they have completed. A project&apos;s name, the client&apos;s name and the work itself appear only once the client has approved it, for example by signing the project&apos;s Verified Impact Ledger. Verification documents, bank details and email addresses are never shown publicly.</li>
            <li><strong>UniPact administrators</strong> review verification documents and manage matches.</li>
            <li><strong>Service providers</strong> who host our website, store files, send email, process payments and report errors, under contracts that require them to protect your data.</li>
            <li><strong>Authorities</strong> when the law requires it.</li>
          </ul>
          <p>We do not sell your personal data. Some of our service providers may store data outside Malaysia; where they do, we take steps to ensure it is protected to a comparable standard.</p>
        </>
      ),
    },
    {
      id: 'security', title: 'How we protect your data',
      body: (
        <p>We use encrypted connections (HTTPS), hashed passwords, secure sign-in cookies, limits on repeated sign-in attempts, private file storage with expiring download links and restricted admin access. No system is perfectly secure, so please use a strong, unique password and tell us straight away if you suspect unauthorised access to your account.</p>
      ),
    },
    {
      id: 'retention', title: 'How long we keep it',
      body: (
        <p>We keep your data for as long as your account is active and for as long as needed to provide the service. If you close your account we delete or anonymise your personal data, except records we must keep for legal, tax or dispute-resolution purposes, which we keep only for the period required.</p>
      ),
    },
    {
      id: 'your-rights', title: 'Your choices and rights',
      body: (
        <>
          <p>Under the PDPA you can:</p>
          <ul>
            <li>Access the personal data we hold about you and correct anything inaccurate. You can update most profile details yourself in <Link to="/settings">Account settings</Link>.</li>
            <li>Withdraw consent or ask us to close your account and delete your data.</li>
            <li>Ask us to stop using your data for a particular purpose.</li>
          </ul>
          <p>Contact us using the details below. We may need to confirm your identity and will respond within the time the law requires. Some requests may mean we can no longer provide the service to you.</p>
        </>
      ),
    },
    {
      id: 'cookies', title: 'Cookies',
      body: (
        <p>We use essential cookies only: two secure cookies that keep you signed in. They cannot be read by other websites. We do not use advertising or tracking cookies.</p>
      ),
    },
    {
      id: 'changes', title: 'Changes to this policy',
      body: <p>We may update this policy as UniPact grows. We will post the new version here with an updated date and, for significant changes, let you know by email or in the app.</p>,
    },
    {
      id: 'contact', title: 'Contact us',
      body: (
        <>
          <p>For privacy questions or requests, contact:</p>
          <Contact />
        </>
      ),
    },
  ];

  return (
    <LegalLayout
      title="Privacy Policy"
      intro="We only collect what we need to run UniPact, and we never sell your data. Here is exactly what we collect and why."
      sections={sections}
    />
  );
};

export const TermsPage = () => {
  usePageTitle('Terms of Service');

  // Kept in step with the Client Service Agreement and the Talent Agreement (see the agreements pack):
  // where a signed agreement and these Terms differ, the signed agreement wins.
  const sections = [
    {
      id: 'agreement', title: 'About these terms',
      body: (
        <>
          <p>These Terms of Service (&quot;Terms&quot;) are an agreement between you and {LEGAL.entityName} (&quot;UniPact&quot;) for use of the UniPact website and services. By creating an account or using UniPact you agree to these Terms and to our <Link to="/privacy">Privacy Policy</Link>.</p>
          <p>Clients also work with UniPact under a Client Service Agreement, and students under a Talent Agreement. If you have signed or accepted one of those, it applies together with these Terms, and it takes priority wherever the two differ.</p>
          <p>In these Terms, a <strong>Client</strong> is a company or brand that buys work through UniPact, <strong>Talent</strong> is a verified university student who does that work, and a <strong>Job Order</strong> is a project set out on UniPact or in writing: its deliverables, milestones, deadlines and price.</p>
        </>
      ),
    },
    {
      id: 'accounts', title: 'Accounts and eligibility',
      body: (
        <ul>
          <li>You must be at least 18 years old to use UniPact.</li>
          <li>Talent accounts are for people currently enrolled at a university or college. UniPact verifies Talent through a student ID or enrolment letter and may also check their skills before offering them work.</li>
          <li>Client accounts must represent a genuine business, and the person signing up must be authorised to act for it.</li>
          <li>The information you provide must be accurate and kept up to date. We may ask for documents to verify your account and may refuse or remove accounts we cannot verify.</li>
          <li>You are responsible for keeping your password secure and for activity on your account.</li>
          <li>Talent are independent contractors, not employees of UniPact or of any Client. Talent choose which jobs to accept and are responsible for their own income tax.</li>
        </ul>
      ),
    },
    {
      id: 'how-it-works', title: 'How projects work',
      body: (
        <ul>
          <li>UniPact delivers software, digital marketing and content work through Talent that UniPact selects, manages and quality-checks. UniPact is responsible to the Client for the delivery: the Client deals with UniPact, not directly with the Talent, on scope, payment and disputes.</li>
          <li>A Client posts a project describing the work, price, deadline and deliverables. UniPact offers it to suitable Talent, who are free to accept or decline; each offer shows the deliverables, the deadline and what the Talent will be paid. Once the team has accepted, the Client reviews it and confirms the match. Talent may invite other registered Talent to join their team, with a stated role and share of the payout.</li>
          <li>Work outside the Job Order is a new Job Order.</li>
          <li>The Client supplies on time everything the Job Order lists, such as raw footage, logos, brand guidelines, system access and data. Deadlines move by any delay in supplying it.</li>
          <li>Talent deliver accepted jobs on time and to the brief, communicate with Clients through UniPact, and tell UniPact at once if a deadline is at risk.</li>
          <li>If a Talent becomes unavailable during a job, UniPact assigns a replacement at no extra cost to the Client and tells the Client within 2 working days. The Talent is paid for the milestones they completed.</li>
        </ul>
      ),
    },
    {
      id: 'fees', title: 'Fees and payments',
      body: (
        <ul>
          <li>Posting a project is free.</li>
          <li>The Client pays for each milestone in full before work on it starts. On UniPact this is collected as the project fee when the Client confirms its team, unless UniPact has agreed a different schedule with the Client in writing, such as a monthly retainer paid in advance.</li>
          <li>Clients can pay online by FPX through toyyibPay, or by bank transfer against a UniPact invoice. UniPact pays the payment gateway&apos;s fees. Ad spend on Meta, Google or other platforms is paid by the Client directly to those platforms, not through UniPact.</li>
          <li>UniPact holds the Client&apos;s payment and releases the Talent&apos;s share only when the milestone is accepted. UniPact keeps a service fee from each project fee for matching and managing the project (currently {SERVICE_FEE_PERCENT}%, unless a different fee is agreed for that project).</li>
          <li>Talent are paid by bank transfer within 7 working days after the Client accepts the milestone, split between team members by their agreed shares. Talent must keep their bank details up to date; payouts go to the account on file, and we may pause a payout to confirm a recent change of bank details.</li>
          <li>If a Client refuses to pay for work that matches the Job Order, UniPact still pays the Talent for accepted milestones and handles the dispute with the Client.</li>
          <li>If UniPact cannot deliver a milestone that matches the Job Order after the included revisions, the Client gets a full refund of that milestone&apos;s payment. Otherwise, except where the law requires, payments for accepted milestones are not refundable.</li>
        </ul>
      ),
    },
    {
      id: 'revisions', title: 'Revisions and acceptance',
      body: (
        <ul>
          <li>Each deliverable includes 2 rounds of minor revisions, such as text changes, music swaps, colour or layout tweaks, and small bug fixes. Major changes to structure or scope are a new Job Order.</li>
          <li>Within 5 working days of delivery, the Client either accepts the deliverable or requests a revision in writing, saying what does not match the Job Order.</li>
          <li>If the Client does neither within 5 working days, the deliverable is treated as accepted and the payment for it is released.</li>
        </ul>
      ),
    },
    {
      id: 'content', title: 'Ownership of work and portfolios',
      body: (
        <ul>
          <li>You keep ownership of the content you upload, such as briefs, brand assets and profile information. You give UniPact permission to store, display and share it only as needed to run the service, and you confirm you have the rights to everything you supply.</li>
          <li>Once a milestone is paid in full, all rights in its deliverables pass to the Client. Talent assign those rights to UniPact when they are paid for the work, and UniPact passes them to the Client.</li>
          <li>UniPact keeps its own platform, tools and reusable code libraries, and Talent keep their general skills, know-how and any tools they owned before the job. The Client gets a permanent licence to use any of these built into its deliverables.</li>
          <li>Talent deliver original work, with no copied code, footage, music or designs without a proper licence.</li>
          <li>Every accepted job is added to the Talent&apos;s verified record on UniPact. Without the Client&apos;s approval, that record shows only the type of job and that it was completed. The project&apos;s name, the Client&apos;s name and the work itself are shown, by UniPact or the Talent, only once the Client has approved it in writing, for example by signing the project&apos;s Verified Impact Ledger.</li>
          <li>Talent keep Client information, files and login details confidential during and after the job, and delete Client files when UniPact asks.</li>
        </ul>
      ),
    },
    {
      id: 'warranty', title: 'Software warranty',
      body: (
        <p>Software deliverables come with 30 days of free bug fixes after acceptance, for defects against the Job Order. Talent fix bugs in their own work during that period at no extra payout.</p>
      ),
    },
    {
      id: 'conduct', title: 'Acceptable use and working directly',
      body: (
        <>
          <p>You agree not to:</p>
          <ul>
            <li>Provide false information, impersonate anyone or create accounts for someone else without permission.</li>
            <li>Harass, discriminate against or mistreat other users.</li>
            <li>Attempt to access other accounts or data, disrupt the service, or scrape or copy it at scale.</li>
          </ul>
          <p>For 12 months after a Talent&apos;s last job for a Client, any further work between them goes through UniPact. A Talent approached directly by such a Client refers them back to UniPact; a Client that hires or engages the Talent outside UniPact in that period pays the conversion fee set out in its Client Service Agreement. Talent may still work with anyone they knew before UniPact introduced them.</p>
        </>
      ),
    },
    {
      id: 'suspension', title: 'Ending and closing accounts',
      body: (
        <ul>
          <li>A Client or UniPact may end their agreement with 14 days&apos; written notice. Accepted milestones stay paid; funds for work not yet started are refunded. Either may end it immediately if the other seriously breaches it and does not fix the breach within 7 days of written notice.</li>
          <li>Talent may close their account at any time after finishing or handing over any accepted jobs.</li>
          <li>UniPact may pause or remove Talent who repeatedly miss deadlines, deliver poor work or behave unprofessionally, and may suspend or close any account that breaks these Terms, that we cannot verify, or where needed to protect other users or comply with the law. Payouts already earned are still paid. Where reasonable, we will tell you why.</li>
        </ul>
      ),
    },
    {
      id: 'liability', title: 'Disclaimers and liability',
      body: (
        <>
          <p>We work hard to keep the UniPact website reliable, but we cannot guarantee that it will be uninterrupted or error-free.</p>
          <p>To the extent permitted by law, neither UniPact nor you is liable to the other for indirect losses, such as lost profits or lost data, and UniPact&apos;s total liability under a Job Order is limited to the amount the Client paid for that Job Order. Nothing in these Terms limits rights you have under Malaysian law that cannot be excluded.</p>
        </>
      ),
    },
    {
      id: 'law', title: 'Disputes and governing law',
      body: <p>We will try to settle any dispute with you in good faith within 14 days, and then through mediation. If that fails, the dispute goes to the courts of Malaysia. These Terms are governed by the laws of Malaysia.</p>,
    },
    {
      id: 'changes', title: 'Changes to these terms',
      body: <p>We may update these Terms. We will post the new version here with an updated date and give you 30 days&apos; notice of significant changes by email or in the app. Jobs already accepted stay on the terms that applied when they were accepted.</p>,
    },
    {
      id: 'contact', title: 'Contact us',
      body: <Contact />,
    },
  ];

  return (
    <LegalLayout
      title="Terms of Service"
      intro="The rules for using UniPact, written to be easy to read. Please read them before creating an account."
      sections={sections}
    />
  );
};
