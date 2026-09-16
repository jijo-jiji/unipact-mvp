import React from 'react';
import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import SiteFooter from '../components/SiteFooter';
import { LEGAL } from '../utils/legal';
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
            <li>Billing records: the amount, date and type of payments. Card details are handled by our payment provider; we only keep the card brand and last four digits so you can recognise the card.</li>
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
            <li><strong>Anyone with the link</strong> can view a student&apos;s public portfolio: name, university, course, skills, bio, rating and completed projects. Verification documents and email addresses are never shown publicly.</li>
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

  const sections = [
    {
      id: 'agreement', title: 'About these terms',
      body: (
        <>
          <p>These Terms of Service (&quot;Terms&quot;) are an agreement between you and {LEGAL.entityName} (&quot;UniPact&quot;) for use of the UniPact website and services. By creating an account or using UniPact you agree to these Terms and to our <Link to="/privacy">Privacy Policy</Link>.</p>
        </>
      ),
    },
    {
      id: 'accounts', title: 'Accounts and eligibility',
      body: (
        <ul>
          <li>You must be at least 18 years old, or have permission from a parent or guardian, to use UniPact.</li>
          <li>Student accounts are for people currently enrolled at a university or college. Company accounts must represent a genuine business, and the person signing up must be authorised to act for it.</li>
          <li>The information you provide must be accurate and kept up to date. We may ask for documents to verify your account and may refuse or remove accounts we cannot verify.</li>
          <li>You are responsible for keeping your password secure and for activity on your account.</li>
        </ul>
      ),
    },
    {
      id: 'how-it-works', title: 'How projects work',
      body: (
        <ul>
          <li>Companies post projects describing the work, budget, deadline and deliverables.</li>
          <li>UniPact offers the project to verified students, who are free to accept or decline. Once the team has accepted, the company reviews it and decides whether to confirm the match. Students may invite other registered students to join their team.</li>
          <li>The student team completes the work and submits deliverables through UniPact. The company reviews them, completes the project and may leave a rating.</li>
          <li>UniPact provides the platform and matching service. Unless we agree otherwise in writing, we are not a party to the working arrangement between a company and its student team, and we do not guarantee the outcome of any project.</li>
        </ul>
      ),
    },
    {
      id: 'fees', title: 'Fees and payments',
      body: (
        <ul>
          <li>Posting a project is free.</li>
          <li>On the Free plan, a one-time finder&apos;s fee applies when a company confirms a student match (currently RM 150 per project). The Pro plan (currently RM 499 per month) waives finder&apos;s fees.</li>
          <li>The price is always shown before you pay. Fees are charged through our payment provider and, except where the law requires otherwise, are non-refundable once the service has been provided.</li>
          <li>The project budget is the amount agreed for the student team&apos;s work. How and when the team is paid is set out in the project details and any separate agreement between the parties.</li>
        </ul>
      ),
    },
    {
      id: 'content', title: 'Your content and project work',
      body: (
        <ul>
          <li>You keep ownership of the content you upload, such as briefs, brand assets and profile information. You give UniPact permission to store, display and share it only as needed to run the service.</li>
          <li>Unless the company and the student team agree otherwise in writing, ownership of the final deliverables passes to the company once the project is completed and any amounts due for it have been paid.</li>
          <li>Students may show a summary of completed projects on their UniPact portfolio. Companies should tell the team in the project brief if any part of the work is confidential.</li>
          <li>Only upload content you have the right to share. Do not upload anything unlawful, harmful, infringing or containing malware.</li>
        </ul>
      ),
    },
    {
      id: 'conduct', title: 'Acceptable use',
      body: (
        <>
          <p>You agree not to:</p>
          <ul>
            <li>Provide false information, impersonate anyone or create accounts for someone else without permission.</li>
            <li>Harass, discriminate against or mistreat other users.</li>
            <li>Arrange to take a project matched through UniPact off the platform to avoid fees.</li>
            <li>Attempt to access other accounts or data, disrupt the service, or scrape or copy it at scale.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'suspension', title: 'Suspension and closing accounts',
      body: (
        <p>You can stop using UniPact at any time and ask us to close your account. We may suspend or close accounts that break these Terms, that we cannot verify, or where needed to protect other users or comply with the law. Where reasonable, we will tell you why.</p>
      ),
    },
    {
      id: 'liability', title: 'Disclaimers and liability',
      body: (
        <>
          <p>UniPact is provided &quot;as is&quot;. We work hard to keep it reliable and to verify users, but we cannot guarantee that the service will be uninterrupted or error-free, or that every user or project will meet your expectations.</p>
          <p>To the extent permitted by law, UniPact is not liable for indirect or consequential losses, and our total liability to you for any claim is limited to the fees you paid to UniPact in the 12 months before the claim. Nothing in these Terms limits rights you have under Malaysian consumer protection law that cannot be excluded.</p>
        </>
      ),
    },
    {
      id: 'law', title: 'Governing law',
      body: <p>These Terms are governed by the laws of Malaysia. Any dispute will be handled by the courts of Malaysia, although we encourage you to contact us first so we can try to resolve it informally.</p>,
    },
    {
      id: 'changes', title: 'Changes to these terms',
      body: <p>We may update these Terms. We will post the new version here with an updated date and, for significant changes, notify you in advance by email or in the app. Continuing to use UniPact after changes take effect means you accept them.</p>,
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
