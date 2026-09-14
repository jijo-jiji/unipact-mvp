# Reference: Pre-Commit Verification Checklist

Whenever code changes are made to UniPact:

- [ ] **1. Dual-Track Role Verification**
  - Ensure `User.Role.STUDENT` and `User.Role.CLUB` remain separate.
  - Verify club endpoints are not deprecated or modified unexpectedly.
- [ ] **2. Backend Test Suite**
  - Run: `python manage.py test` from `unipact-backend/`
  - Verify all 24+ tests pass with zero failures.
- [ ] **3. Database Migration Integrity**
  - Run: `python manage.py makemigrations --check --dry-run`
  - Ensure no uncommitted model changes or accidental schema deletions.
- [ ] **4. Frontend Production Build**
  - Run: `npm run build` from `unipact-frontend/`
  - Verify Vite bundles with 0 JSX, TypeScript, or CSS syntax errors.
- [ ] **5. Theme & Design Consistency**
  - Check that black background (`bg-black`), dark gray cards (`bg-gray-900`), and monospace metrics (`font-mono`) are respected.
  - Verify responsive desktop and mobile views.\n