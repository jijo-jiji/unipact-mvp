# UniPact Agent Rules, Architecture Locks & Style Guide

This project is governed by strict architectural and UI/UX design constraints. All AI agents and pair-programmers working in this repository MUST follow these rules:

1. **Official UI Style Lock (Per `STYLE_GUIDE.md`)**:
   - The user interface strictly follows `STYLE_GUIDE.md` (clean, trusting, enterprise B2B aesthetic).
   - **Colors**: Primary Navy (`#0B1E63`), Deep Navy (`#0A1748`), Action Cyan (`#00AEEF`), Deep Cyan hover (`#0090C6`), Light Canvas (`#F5F7FC`), Surface White (`#FFFFFF`), Text (`#0A1748`), Muted Text (`#5B6478`), Soft Border (`rgba(10, 23, 72, 0.12)`).
   - **Typography**: Headings use `Outfit` (bold, `#0A1748`), Body uses `Inter` (regular/medium/semibold).
   - **Layout**: Container max-width `1160px`, sticky blur navbar (76px), cyan eyebrow tags with diamond accents, cyan rule lines.

2. **SRS v2.2.1 Coexistence (DO NOT DROP)**:
   - SRS v2.2.1 (Club/Guild sponsorships) is **postponed**, NOT dropped.
   - Never remove or alter `role: "CLUB"` or club-specific models and endpoints.
   - V3.0 individual student marketplace operates concurrently under `role: "STUDENT"`.

3. **Mandatory Verification**:
   - Backend: `python manage.py test` inside `unipact-backend/` must pass 100%.
   - Frontend: `npm run build` inside `unipact-frontend/` must compile with 0 errors.

Refer to `.agents/skills/unipact-architecture-and-style/SKILL.md` for complete specifications.\n