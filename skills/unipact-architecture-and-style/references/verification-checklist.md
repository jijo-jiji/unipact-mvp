# Reference: Pre-Commit Verification Checklist

Whenever code changes are made to UniPact:

- [ ] **1. Dual-Track Role Verification**
  - Ensure `User.Role.STUDENT` and `User.Role.CLUB` remain separate.
  - Verify club endpoints are not deprecated or modified unexpectedly.
- [ ] **2. Backend Test Suite**
  - Run: `python manage.py test` from `unipact-backend/`
  - Verify all tests pass with zero failures (80+ tests, including production-settings, rate-limit, upload, email and account tests).
- [ ] **3. Database Migration Integrity**
  - Run: `python manage.py makemigrations --check --dry-run`
  - Ensure no uncommitted model changes or accidental schema deletions. New fields must be `null=True, blank=True`.
- [ ] **4. Frontend Lint & Production Build**
  - Run: `npx eslint src` and `npm run build` from `unipact-frontend/`
  - Verify 0 lint errors and that Vite bundles with 0 JSX or CSS errors.
- [ ] **5. Theme & Design Consistency (per `STYLE_GUIDE.md`)**
  - Light canvas (`#F5F7FC`) with white cards, Navy (`#0B1E63` / `#0A1748`) text and headings, Action Cyan (`#00AEEF`, hover `#0090C6`) for primary actions.
  - Headings in `Outfit`, body text in `Inter`. No dark-theme leftovers (`bg-black`, `bg-gray-900`, white text on light backgrounds, gold/purple accents).
  - Reuse the shared building blocks: `card`, `btn-primary` / `btn-secondary`, `input`, `badge`, `WorkspaceNav` / `PublicNav`, `Modal`, `StatusBadge`.
  - Sign-in pages show the official logo via `BrandLogo`.
  - Verify desktop, tablet (768px) and phone (375px) widths: no sideways scrolling, form inputs at least 16px on phones, tap targets about 40px.
- [ ] **6. User-Facing Safety**
  - Any new email goes through `unipact_backend/notifications.py` (never blocks the request if sending fails).
  - New uploads use `unipact_backend/validators.py`; new public endpoints consider rate limits.
  - Plain-language errors via `getErrorMessage`, no raw `alert()`.
