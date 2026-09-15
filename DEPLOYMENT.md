# Deploying UniPact

Recommended setup: **frontend on Vercel**, **backend on Render or Railway**, **PostgreSQL on Neon/Render/Supabase**, **uploads on Cloudflare R2**.
Put the site and API on the same domain family, e.g. `unipact.my` (frontend) and `api.unipact.my` (backend), so login cookies work with `SameSite=Lax`.

Local development is unchanged: with no environment variables you get DEBUG mode, SQLite and local file storage.

---

## 1. Backend (Django API)

**Build command** (Render/Railway):
```
cd unipact-backend && ./build.sh
```
**Start command:**
```
cd unipact-backend && gunicorn unipact_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120
```
(A `Procfile` with the same commands is included for Heroku-style hosts.)

**Health check path:** `/api/health/` (returns 200 when the app and database are reachable).

**Environment variables:** copy every setting from `unipact-backend/.env.example` into the host's dashboard. The essentials:

| Variable | Example | Notes |
|---|---|---|
| `DJANGO_ENV` | `production` | Turns on HTTPS redirect, secure cookies, HSTS and required-setting checks |
| `DJANGO_SECRET_KEY` | 50+ random characters | `python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"` |
| `DJANGO_ALLOWED_HOSTS` | `api.unipact.my` | |
| `DJANGO_ADMIN_URL` | `ops-x7k2/` | Moves the Django admin off `/admin/` |
| `CORS_ALLOWED_ORIGINS` | `https://unipact.my` | The frontend address |
| `AUTH_COOKIE_DOMAIN` | `.unipact.my` | Shares the login cookie between site and API |
| `DATABASE_URL` | `postgres://…` | From your PostgreSQL provider |
| `USE_S3` + `AWS_*` | see `.env.example` | Cloudflare R2 / S3 bucket for uploads (keep the bucket **private**; links are signed) |

The app **refuses to start** in production if the secret key, allowed hosts, database, CORS origins or file storage are missing, so misconfiguration fails loudly instead of running insecurely.

**Verify before going live:**
```
cd unipact-backend
python manage.py check --deploy
```

**First deploy:**
1. `python manage.py migrate` runs automatically in `build.sh`.
2. Create a real admin: `python manage.py createsuperuser` and enter `ADMIN` when asked for the role. Use a strong, unique password.
3. **Do not** run the seed scripts (`create_seed_users.py`, `seed_demo_data.py`) against production; they create accounts with known passwords.

## 2. Frontend (React)

On Vercel, set the project root to `unipact-frontend`:
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://api.unipact.my/api`

`vercel.json` makes deep links such as `/student/dashboard` work and adds security headers. `public/_redirects` does the same on Netlify.

## 3. What is protected now

- **Rate limits (per IP):** login 10/min, registration 20/hour, token refresh 60/min, general API 120/min anonymous and 600/min signed in. Tune with `THROTTLE_*` variables. If you run several server processes, set `REDIS_URL` so they share counters.
- **Passwords:** at least 8 characters, not common, not all numbers, not similar to the email. Applies to every sign-up form.
- **Uploads:** allow-listed file types only, executables/HTML/SVG blocked (including disguised files), and size limits of 10 MB for ID/SSM documents and 500 MB for project files (`MAX_*_UPLOAD_MB`). Also set the same limit on your host or proxy (e.g. Nginx `client_max_body_size 500m`).
- **Cookies:** HttpOnly, `Secure` and a controlled `SameSite`/domain in production.
- **Headers:** HTTPS redirect, HSTS (1 year), no-sniff, clickjacking protection, strict referrer policy. The browsable API is disabled in production.

## 4. Still to do before real users

These need decisions or third-party accounts, so they are not built yet:
- Real payment provider and student payouts (the checkout is a demo).
- Transactional email (verification, invites, receipts) and "forgot password".
- Privacy Policy / Terms of Service and sign-up consent (PDPA).
- Database backups and error monitoring (e.g. Sentry).
