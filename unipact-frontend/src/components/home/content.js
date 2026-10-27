import { SERVICE_FEE_PERCENT } from '../../utils/constants';

// Words and pictures for the front page. The screenshots in public/home are real screens from a
// local demo project (made-up client and students), captured at 820px wide so their text stays
// readable at the size the page shows them.

export const TOUR = {
  client: {
    label: 'For clients',
    cta: { to: '/register/company', label: 'Post a project' },
    steps: [
      {
        title: 'Post your brief',
        text: 'Choose software or marketing, describe the work, and set your budget and deadline. Posting is free.',
        image: '/home/client-1-post.webp',
        alt: 'The Post a new project form, with Software development chosen and the project title and description filled in.',
      },
      {
        title: 'Review the team we propose',
        text: 'Within 48 hours a UniPact admin proposes verified students for your brief. Each student accepts first, then you see their university, skills and portfolio.',
        image: '/home/client-2-team.webp',
        alt: 'A project’s Team tab: two students who have accepted, each with their university, skills and a link to their portfolio.',
      },
      {
        title: 'Confirm and pay into escrow',
        text: 'Confirming starts the project. UniPact holds your fee and releases each milestone’s share only when you approve it.',
        image: '/home/client-3-confirm.webp',
        alt: 'The Confirm this student match dialog, explaining that the fee is held in escrow and released milestone by milestone.',
      },
      {
        title: 'Follow the work and talk to your team',
        text: 'Every project has its own page with milestones, files, payments and one conversation shared by you, your team and UniPact.',
        image: '/home/client-4-messages.webp',
        alt: 'A project conversation: UniPact welcomes the team, and the client and a student agree how the booking flow should start.',
      },
      {
        title: 'Approve each milestone',
        text: 'Open what the team submitted, then approve it or ask for changes. Two rounds of revisions are included, and you have 5 working days to review.',
        image: '/home/client-5-review.webp',
        alt: 'Three milestones with their amounts: one approved, one submitted with Approve and release and Request revision buttons, and one still to come.',
      },
    ],
  },
  student: {
    label: 'For students',
    cta: { to: '/register/student', label: 'Create a student account' },
    steps: [
      {
        title: 'Create your account',
        text: 'Sign up with your university, course and skills. A UniPact admin verifies that you are a student, and uploading your student ID speeds this up.',
        image: '/home/student-1-signup.webp',
        alt: 'The Join as student talent form, with name, track, university, course and skills filled in.',
      },
      {
        title: 'Accept a project offer',
        text: 'You don’t bid for work. When an admin matches you to a client’s project, you see the brief, the pay and why you were picked, then accept or decline.',
        image: '/home/student-2-offer.webp',
        alt: 'A new project offer on the student workspace: the client, the team pay, what the client needs, and Accept project and Decline buttons.',
      },
      {
        title: 'Bring in your teammates',
        text: 'Invite classmates onto the project, each with a role and an agreed share of the payout.',
        image: '/home/student-3-invite.webp',
        alt: 'The Invite a teammate dialog, with the classmate’s email, their role and a 30% payout share.',
      },
      {
        title: 'Submit each milestone',
        text: 'Send a link or a file with notes for the client. Questions and feedback go through the project’s messages.',
        image: '/home/student-4-submit.webp',
        alt: 'The Submit milestone dialog, with a link to the work and notes for the client.',
      },
      {
        title: 'Get paid for approved work',
        text: 'When the client approves a milestone, your share is paid to your bank account within 7 working days. Finished projects go on your portfolio.',
        image: '/home/student-5-earnings.webp',
        alt: 'How this project pays: each milestone’s amount and whether it has been released, with the first payout marked Disbursed.',
      },
    ],
  },
};

// The walk-through videos: the same five steps, filmed on the app with the local demo data. The
// preview is a small copy that loops silently under the steps' heading.
export const VIDEOS = {
  client: {
    src: '/home/how-it-works-client.mp4',
    poster: '/home/how-it-works-client.webp',
    preview: '/home/how-it-works-client-preview.mp4',
    label: 'Video: how clients use UniPact, in five captioned steps: post a brief, review the team, confirm and pay into escrow, talk to the team, and approve each milestone.',
  },
  student: {
    src: '/home/how-it-works-student.mp4',
    poster: '/home/how-it-works-student.webp',
    preview: '/home/how-it-works-student-preview.mp4',
    label: 'Video: how students use UniPact, in five captioned steps: create an account, accept a project offer, invite teammates, submit each milestone, and get paid.',
  },
};

export const WORKSPACE = [
  {
    title: 'A dated record of every step',
    text: 'Open any phase of the progress bar to see what happened in it and when: who joined, what was submitted, and what was paid.',
    image: '/home/work-history.webp',
    alt: 'A project’s progress bar with the In progress phase opened, listing dated events from team confirmed to milestone submitted.',
  },
  {
    title: 'Files kept with the project',
    text: 'Briefs, brand guides and raw footage are shared with the team in one place, and stay with the project after it ends.',
    image: '/home/work-files.webp',
    alt: 'The Project files panel: a brand guide and the opening hours by branch, with a form to add another file.',
  },
  {
    title: 'A portfolio built from real work',
    text: 'Every finished project is added to the student’s public portfolio, with their client rating.',
    image: '/home/work-portfolio.webp',
    alt: 'A student’s public portfolio: verified student badge, university, track, client rating and completed projects.',
  },
];

export const ESCROW_STEPS = [
  { title: 'You confirm your team', text: 'and pay the project fee. Nothing starts before that.' },
  { title: 'UniPact holds the fee', text: 'in escrow while the team works.' },
  { title: 'You approve a milestone', text: 'and only then is its share released to the team.' },
];

// Each point is a short title the eye can scan, then the detail
export const CLIENT_PROTECTIONS = [
  { title: 'Two rounds of revisions', text: 'Included on every milestone, at no extra cost.' },
  { title: 'A refund if it misses the brief', text: 'For a milestone that still misses it after the revisions.' },
  { title: 'A free replacement', text: 'If a student drops out, UniPact finds someone else.' },
  { title: 'The work is yours', text: 'All rights pass to you once a milestone is paid.' },
];

export const STUDENT_PAY = [
  { title: 'Your pay is set up front', text: `The project fee minus UniPact’s ${SERVICE_FEE_PERCENT}%, shown before you accept.` },
  { title: 'Released milestone by milestone', text: 'Each share is released when the client approves that milestone.' },
  { title: 'In your bank within 7 working days', text: 'By bank transfer after each approval.' },
  { title: 'Teammates paid directly', text: 'Everyone receives their agreed share in their own account.' },
];

export const FAQ = {
  client: [
    {
      q: 'How long until I have a team?',
      a: 'A UniPact admin proposes students within 48 hours of your brief going up. Each of them accepts the offer first, then you review the team and confirm it.',
    },
    {
      q: 'What does it cost?',
      a: `Posting is free. You set the budget, and UniPact’s ${SERVICE_FEE_PERCENT}% service fee comes out of it, never on top. You pay the fee when you confirm your team, and UniPact holds it in escrow until you approve each milestone.`,
    },
    {
      q: 'What if I’m not happy with a milestone?',
      a: 'Ask for changes: every milestone includes two rounds of revisions. You have 5 working days to review each submission, after which it counts as approved. If a milestone still misses the brief after revisions, its payment is refunded.',
    },
    {
      q: 'Can I message the students directly?',
      a: 'Yes. Each project has one conversation shared by you, your team and UniPact. It opens when work starts and stays open for 30 days after the project is completed. Changes to scope, price or payment go through UniPact.',
    },
    {
      q: 'Who owns the finished work?',
      a: 'You do. All rights to a milestone’s work pass to you once it is paid, as set out in the Client Service Agreement.',
    },
    {
      q: 'Can I post more than one project?',
      a: 'Yes. Posting is free, and each project gets its own team, page, payments and conversation.',
    },
  ],
  student: [
    {
      q: 'Who can join?',
      a: 'Students at Malaysian universities, in software development, digital marketing or both. A UniPact admin checks your student status before you can be matched to a project.',
    },
    {
      q: 'Does it cost anything to join?',
      a: `No. A student account is free. UniPact’s ${SERVICE_FEE_PERCENT}% fee is taken from the client’s price before the team’s pay is set, and you see your pay before you accept.`,
    },
    {
      q: 'How do I get projects?',
      a: 'There is no bidding. UniPact admins match students to client projects by skills and track record. The offer appears on your workspace with the brief and the pay.',
    },
    {
      q: 'What if an offer doesn’t suit me?',
      a: 'Decline it from your workspace, and tell UniPact why if you like. Every offer shows the brief, the pay and the deadline before you decide.',
    },
    {
      q: 'When and how am I paid?',
      a: 'By bank transfer, within 7 working days of the client approving each milestone. Add your bank details in Settings so payouts are not held up.',
    },
    {
      q: 'Can I work with my friends?',
      a: 'Yes. Once you are on a project you can invite other students to join it, each with a role and an agreed share of the payout.',
    },
  ],
};
