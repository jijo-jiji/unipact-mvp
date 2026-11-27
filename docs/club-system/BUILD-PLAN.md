# UniPact Campus: Build Plan

Companion to [PLAN.md](PLAN.md), which holds the research and design. This file is the order of work.
Status: **approved 2026-11-27**. Milestones are built in order, M0 to M5.

## Decisions (approved)

| # | Decision | Choice |
|---|---|---|
| 1 | Accounts for lecturers, SDCL staff and the Dean | New `STAFF` account type. Staff are invited by an admin and cannot self-register. The four existing roles are unchanged. |
| 2 | Who approves a new club | Advisor endorses → Head of Section reviews → Deputy Dean SDCL approves |
| 3 | Activity with no budget | Skips the SRC budget endorsement and Finance steps |
| 4 | i-STAR | Runs alongside in the pilot. Advisors approve in UniPact, and the filled form is printed for i-STAR. |
| 5 | GHOCS points | Ashraf's values, editable, labelled "pilot points" |
| 6 | Name | "UniPact Campus", a section inside UniPact |

## Milestones

Each one ends with `python manage.py test` passing, `npm run build` compiling with 0 errors, and a commit.

### M0. Foundations (backend only) — done 2026-11-27
- New app `campus`, separate from the v2.2.1 club and V3.0 student code
- Org tree `OrgUnit`: UniKL → MIIT → Dean, Deputy Deans, Finance, SD and CL sections, SRC, clubs
- `RoleAssignment` (person + role + unit + session) and one permission check used by every endpoint
- `STAFF` account type, `StaffProfile`, staff invitations (email link → set password)
- `seed_campus_miit` command: the MIIT tree with job titles only; real people are added as data
- Feature switch `CAMPUS_ENABLED`; Django admin for all campus models

### M1. Clubs and members — done 2026-11-27
- Club directory and club page (about, activities, announcements, members)
- Join request → committee or advisor approves; members, positions, promote and demote, membership per semester
- Propose a new club (decision 2 chain); assign advisors (they get notified)
- Announcements with comments; campus news (anyone can propose, SDCL approves, can be marked "GHOCS-claimable")
- Built with it: the general approval engine (`campus/approvals.py`) that M2's SAF chain reuses, and a
  Manage campus page (structure and roles, staff invitations, semesters)

### Pilot mode — done 2026-11-27
- `CAMPUS_PILOT_ONLY` (on by default): Campus exists only for UniPact admins, staff accounts, campus role holders
  and students on the pilot list; everyone else gets "not found" and no menu item
- Pilot list kept by email (SDCL adds students before or after they sign up; each one is emailed), managed under
  Manage campus → Pilot students. How to switch it on: `DEPLOYMENT.md` → "UniPact Campus pilot"

### Installable app (PWA) — done 2026-11-27
- Web app manifest, app icons (standard + maskable), and a small service worker: pages always come from the
  network (so a deploy never leaves anyone on an old version), hashed build files are cached, and an offline page
  shows when there's no connection. Chrome reports it installable.
- "Put UniPact on your home screen" card on Campus home: one-tap install on Android/desktop Chrome, Safari's
  Share → Add to Home Screen steps on iPhone. Opens at /login, which sends signed-in people to their home.

### M2. Activities and the approval chain — done 2026-11-27
- Activity proposal: GHOCS fields + SAF 2026 template fields (objectives, programme, budget items, funding split)
- The 9-step MIIT chain: RM 5,000 Dean/Deputy Dean rule, SD/CL routing, no-budget shortcut
- Approvals inbox for each role, with the full sign-off trail
- Generated SAF 2026 form as PDF; approval numbers (e.g. `1020525`)
- Published activity: QR check-in, discussion, activity report with advisor remarks, reminder until the report is in
- Built with it: per-campus approval settings (SRC steps, Finance step, Dean threshold, report due days) under
  Manage campus → Approval chain; `campus_reminders` daily command for late reports; all Campus dates in Malaysia
  time. Check-in uses the phone's own camera to open the QR link, so no in-app scanner (and no camera permission)
  is needed on the website

### M2.5. Store apps (Google Play and App Store), after M2
One "UniPact" app for every role, built from the same React code with Capacitor.
- Token sign-in for the apps (phone apps don't send the website's cookies reliably); the website stays as is
- Native push notifications (approvals, join requests, claim decisions), camera QR scanner for check-in,
  email links that open the app
- Delete account from inside the app (Apple requires it); no company upgrade/payment screens in the app, to stay
  clear of Apple's in-app purchase rule for digital subscriptions
- Store listings, privacy forms, closed testing, then public release
- **Owner to start now (slow):** Apple Developer account as an organisation (USD 99/yr, needs a D-U-N-S number),
  Google Play developer account as an organisation (USD 25 once); a Mac with Xcode or a cloud build service for iOS
- QR check-in already works on the website by scanning with the phone's camera app; an in-app scanner is
  optional for the store apps

### M3. SRC funding (SAF/SWF)
- Fund application with the 5-document checklist
- Steps by amount: < RM 1K; < RM 5K adds pitching; > RM 5K adds the panel pitch
- SRC Treasurer decision with email
- Deadlines: 30 days to apply after approval, 3-month validity, financial report 30 days after the event, overdue flags

### M4. GHOCS
- Point rules table (pilot values, editable)
- Claims: from attended activities (pre-filled, category locked), My Excellence with evidence, Skill Development
- Verify → approve; Secretary queue oldest first; reminders at 3 and 7 days
- Management Skills per semester
- Spider web as absolute values against a target, plus a printable transcript

### M5. Pilot dashboard and survey
- Dean's dashboard: approval turnaround, on-time reports, activities by DNA category, participation, CSV export
- Ashraf's 15-question UAT survey, to compare with his 30-student baseline

### Later (not in this build)
v2.2.1 sponsorship switch-on, FAQ chatbot, UniKL SSO, other campuses.

## Screens by person

| Who | Screens |
|---|---|
| Student | Clubs directory, club page, my clubs, propose a club, activity page (check-in, discussion), my GHOCS points and web, claims, transcript |
| Club committee | Manage club (requests, members, positions, announcements), propose activity, activity reports, fund applications |
| Advisor | Approvals inbox, club overview, report remarks |
| GHOCS Secretary | Claims queue |
| SDCL, Head of Section, Deputy Dean, Dean | Approvals inbox, manage clubs and advisors, news, pilot dashboard |
| SRC (Exco, President, Treasurer) | Acknowledge and endorse inbox, fund decisions, overdue reports |

People with any campus role get a **Campus** menu in the workspace navigation, styled per `STYLE_GUIDE.md`.

## Rules
- New endpoints live under `/api/campus/`. Existing club and student endpoints and data are not changed or removed.
- No real staff names in code. Uploads limited to PDF, DOCX and images. Tests for every milestone.
