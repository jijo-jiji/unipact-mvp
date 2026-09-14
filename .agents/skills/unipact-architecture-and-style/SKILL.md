---
name: unipact-architecture-and-style
description: >-
  Enforces architectural consistency, dual-track coexistence (V3.0 Individual Student Talent and postponed V2.2.1 Student Clubs/Guilds), and the official UniPact Enterprise Navy & Cyan UI design system from STYLE_GUIDE.md across all codebase updates. Activate whenever creating, updating, or refactoring backend models, API endpoints, database migrations, or frontend React components.
---

# UniPact Architecture & Official UI Style Lock

This skill is the **authoritative source of truth** for all code changes, refactors, and feature additions across `unipact-backend` and `unipact-frontend`. It guarantees architectural integrity and visual compliance with the official **STYLE_GUIDE.md**.

---

## 1. Official UI Style Lock (Per STYLE_GUIDE.md)

> [!IMPORTANT]
> All frontend components, landing pages, forms, tables, and dashboards MUST strictly conform to `STYLE_GUIDE.md`.
> Brand Voice: Clean, professional, trusting enterprise B2B aesthetic using Navy and Cyan on light backgrounds (`#F5F7FC`).

### A. Color System & Design Tokens
- **Primary Navy (`--navy`)**: `#0B1E63` — Primary brand identity.
- **Deep Navy (`--navy-deep`)**: `#0A1748` — High-contrast headings and primary text.
- **Action Cyan (`--cyan`)**: `#00AEEF` — Primary buttons, highlights, active indicators, and interactive elements.
- **Deep Cyan (`--cyan-deep`)**: `#0090C6` — Hover states on cyan buttons and links.
- **Background (`--bg`)**: `#F5F7FC` — Default application canvas background.
- **Surface White (`--white`)**: `#FFFFFF` — Cards, modals, containers, and elevated components.
- **Main Text (`--text-main`)**: `#0A1748` — Standard body copy and data table cells.
- **Muted Text (`--text-muted`)**: `#5B6478` — Subtitles, captions, metadata, and supporting info.
- **Soft Border (`--border-color`)**: `rgba(10, 23, 72, 0.12)` — Subtle card borders, dividers, table rows.
- **Strong Border (`--border-strong`)**: `rgba(10, 23, 72, 0.22)` — Form input focus, active states, emphasized borders.

### B. Typography
- **Headings**: `Outfit`, Bold (`700`), Color: `--navy-deep` (`#0A1748`), Line-height: `1.15`.
- **Body & Controls**: `Inter`, Weights: Regular (`400`), Medium (`500`), Semi-bold (`600`), Color: `--text-main` or `--text-muted`, Line-height: `1.6`.

### C. Layout & Component Standards
- **Container**: Max-width `1160px` (`max-w-[1160px] mx-auto px-8`), consistent horizontal alignment.
- **Navbar**: Height `76px`, sticky, glassmorphic backdrop (`backdrop-filter: blur(12px)` over `rgba(245, 247, 252, 0.94)`).
- **Eyebrow Tags**: Uppercase, tracked (`tracking-[0.12em]`), `text-xs font-bold text-[#00AEEF]`, paired with cyan diamond dot.
- **Section Titles**: Fluid clamp (`clamp(2rem, 3.4vw, 2.75rem)`), letter-spacing `-0.5px`, max-width `700px`.
- **Buttons**:
  - Primary Action: Cyan background (`#00AEEF`), white bold text, hover deep cyan (`#0090C6`), transition `0.2s ease`.
  - Secondary: White surface, navy border (`rgba(10, 23, 72, 0.22)`), deep navy text.
- **Transitions**:
  - Fast: `0.2s ease` (color/opacity hover)
  - Normal: `0.3s cubic-bezier(0.4, 0, 0.2, 1)` (transforms/modals)

---

## 2. Ironclad Architecture Locks

### A. Dual-Track Model Coexistence (V3.0 + V2.2.1)
> [!IMPORTANT]
> **SRS v2.2.1 is POSTPONED, NOT DROPPED.**
> University administrative clearance (HEP/Student Affairs approval, university-sanctioned club bank accounts, institutional MoUs) is pending. When clearance is granted, v2.2.1 club sponsorships will be reactivated alongside V3.0 individual project bounties.

1. **Role Segregation**:
   - `role: "STUDENT"` = V3.0 individual freelance talent (portfolio, matric ID, direct matchmaking, deliverable payouts).
   - `role: "CLUB"` = v2.2.1 student clubs / guilds (presidents, rosters, rank S/A/B/C, sponsorship tiers).
   - `role: "COMPANY"` = Client / SME posting quests and funding projects.
   - `role: "ADMIN"` = Platform operators managing verifications and matchmaking.
   - **RULE**: NEVER merge or replace `CLUB` with `STUDENT`. They must remain distinct in `users.models.User.Role` and all authorization policies.

2. **Endpoint Isolation**:
   - V3.0 endpoints (`/api/users/register/student/`, `/api/campaigns/student/assigned/`, `/api/campaigns/<id>/match/`, `/api/campaigns/<id>/finalize/`, `/api/campaigns/<id>/student-deliverable/`, `/api/campaigns/<id>/assets/`) must NEVER overwrite or delete v2.2.1 club endpoints (`/api/club/*`, `/api/campaigns/<id>/apply/`, `/api/users/register/club/`).

3. **Forward-Compatible Linking**:
   - `StudentProfile.club_affiliation` is a lightweight string field today (e.g., "Google Developer Student Club - MMU").
   - When v2.2.1 is reactivated, this will be safely linked via a foreign key to `ClubProfile` without breaking individual profiles.

4. **Escrow & Platform Fee Structure**:
   - V3.0 projects enforce a **10% platform fee** automatically captured upon admin match finalization (`POST /api/campaigns/<id>/finalize/`).

---

## 3. Mandatory Verification Checklist

Before considering any update complete:
1. **Backend Tests**: Run `python manage.py test` inside `unipact-backend/` (must pass 100%).
2. **Frontend Build**: Run `npm run build` inside `unipact-frontend/` (must compile with 0 errors).
3. **Style Fidelity**: Verify colors, fonts, borders, and layouts match `STYLE_GUIDE.md`.

---

## 4. References
- [Official UI Style Guide & Design Tokens](./references/style-guide.md)
- [Architecture Lock Specification](./references/architecture-lock.md)
- [Verification Checklist](./references/verification-checklist.md)\n