# Deploying UniPact

Setup: **app on Vercel** (`app.unipact.my`), **API on Render** (`api.unipact.my`), **PostgreSQL on Neon**, **uploads on Cloudflare R2**.
The Next.js marketing site stays on `www.unipact.my`. Keep the app and API on the same domain family so login cookies work with `SameSite=Lax`.

Local development is unchanged: with no environment variables you get DEBUG mode, SQLite, local file storage and the demo card checkout.

## 0. Soft launch: step by step

Do these in order. Each step gives you a value the next one needs. Paste secrets only into the provider dashboards, never into the repo or chat.

1. **Database (Neon, free):** create a project in region *AWS Asia Pacific (Singapore)*. Copy the connection string (`postgresql://…?sslmode=require`). Turn on backups/point-in-time restore.
2. **Uploads (Cloudflare R2):** create a bucket `unipact-uploads` (leave public access **off**). Create an R2 API token with *Object Read & Write* on that bucket. Note the Access Key ID, Secret Access Key and the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
3. **Email (Gmail to start):** on the `unipact.my@gmail.com` Google account, turn on 2-Step Verification and create an *App password*. See "Sending email from Gmail" below.
4. **API (Render):** Dashboard, then *New*, then *Blueprint*, and pick the `jijo-jiji/unipact-mvp` repo. Render reads `render.yaml` and asks for the values marked `sync: false`:
   - `DATABASE_URL`: step 1. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT_URL`: step 2
   - `EMAIL_HOST_USER` `unipact.my@gmail.com`, `EMAIL_HOST_PASSWORD` (step 3), `DEFAULT_FROM_EMAIL` `UniPact <unipact.my@gmail.com>`, `SUPPORT_EMAIL` `unipact.my@gmail.com`
   - `DJANGO_ADMIN_URL`: an unguessable path ending in `/`, e.g. `ops-<random>/`. `SENTRY_DSN`: leave empty unless you use Sentry

   The first deploy installs, migrates and starts. Wait for *Live*, then open `https://unipact-api.onrender.com/api/health/` (your Render URL): it should say ok. The Starter plan (about USD 7/month) keeps the API awake; the free plan sleeps and has no Shell.
5. **API domain:** Render service, then *Settings*, then *Custom Domains*, then add `api.unipact.my`. Render shows a CNAME target. In **Vercel**, go to *Domains*, then `unipact.my`, then *DNS Records*, and add `CNAME api → <render target>` (this replaces the wildcard that currently sends `api` to Vercel). Wait for Render to show the certificate as issued.
6. **App (Vercel):** *Add New*, then *Project*, then import the same repo. Set *Root Directory* to `unipact-frontend` (framework Vite; build `npm run build`, output `dist`). Environment variables:
   - `VITE_API_BASE_URL=https://api.unipact.my/api`, `VITE_SITE_URL=https://app.unipact.my`, `VITE_SERVICE_FEE_PERCENT=10`
   - `VITE_LEGAL_ENTITY_NAME`, `VITE_LEGAL_REGISTRATION_NO`, `VITE_LEGAL_ADDRESS`, `VITE_CONTACT_EMAIL`: exactly as on the SSM certificate

   Deploy, then *Settings*, then *Domains*, then add `app.unipact.my` (Vercel adds the DNS record itself because it hosts `unipact.my`).
7. **First admin:** Render service, then *Shell*, then run `python manage.py create_admin --email unipact.my@gmail.com --name "Your Name"`.
8. **Smoke test on the live site:** register a test company and a test student, verify both from the admin dashboard, post a project, match, and confirm. The client sees "Invoice on its way" and the admins get an "Invoice needed" email. Record the payment under *Billing & escrow*; the client gets a receipt and can confirm. Approve a milestone and record the payout. Finally, request a password reset to prove email works. Delete the test accounts afterwards.
9. **Link the marketing site:** point the "Sign in"/"Get started" buttons on `www.unipact.my` to `https://app.unipact.my/login` and `https://app.unipact.my/register`.

### How clients pay during the soft launch

There is no payment gateway yet, and the demo card checkout is **switched off in production** (`MOCK_PAYMENTS_ENABLED`; the API refuses to start if it is on). When a client confirms a match:
1. The app tells them an invoice is coming, and every admin (plus `SUPPORT_EMAIL`) gets an *Invoice needed* email with the amount.
2. Send the invoice with UniPact's bank details. When the transfer lands, open *Admin, Billing & escrow* for the project and record the amount with the bank/DuitNow reference.
3. The client gets a receipt and clicks *Confirm match* again. The project starts, and milestone approvals pay out from that escrow.

Replace this with ToyyibPay once the account is verified. Keep its secret key in a Render environment variable only.

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
| `CORS_ALLOWED_ORIGINS` | `https://app.unipact.my` | The frontend address |
| `AUTH_COOKIE_DOMAIN` | `.unipact.my` | Shares the login cookie between site and API |
| `DATABASE_URL` | `postgres://…` | From your PostgreSQL provider |
| `USE_S3` + `AWS_*` | see `.env.example` | Cloudflare R2 / S3 bucket for uploads (keep the bucket **private**; links are signed) |
| `FRONTEND_URL` | `https://app.unipact.my` | Used to build links in emails (password reset, notifications) |
| `DEFAULT_PLATFORM_FEE_PERCENT` | `10` | UniPact's default cut of each project fee; admins can override it per project |
| `EMAIL_HOST` + `EMAIL_*` | see `.env.example` | Any SMTP provider (Resend, Brevo, SendGrid, Amazon SES…). To start with the project Gmail instead, see "Sending email from Gmail" below |
| `DEFAULT_FROM_EMAIL` | `UniPact <no-reply@unipact.my>` | Verify this domain with your email provider (SPF/DKIM) or emails land in spam |
| `SUPPORT_EMAIL` | `support@unipact.my` | Reply-to address shown in emails |
| `SENTRY_DSN` | from sentry.io | Optional error monitoring; no personal data is sent |

The app **refuses to start** in production if the secret key, allowed hosts, database, CORS origins, file storage, website address or email settings are missing, so misconfiguration fails loudly instead of running insecurely.

**Verify before going live:**
```
cd unipact-backend
python manage.py check --deploy
```

**First deploy:**
1. `python manage.py migrate` runs automatically in `build.sh`.
2. Create a real admin from the host's shell:
   ```
   python manage.py create_admin --email you@unipact.my --name "Your Name"
   ```
   It asks for a password (at least 12 characters, not common). On hosts without an interactive shell, set `ADMIN_PASSWORD` as a one-off environment variable, run the command, then delete the variable.
3. The seed scripts (`create_seed_users.py`, `manage.py seed_data`) **refuse to run in production** because their accounts have publicly known passwords. If you copied a local database, list and remove demo accounts:
   ```
   python manage.py remove_demo_accounts        # lists them
   python manage.py remove_demo_accounts --yes  # deletes them
   ```
4. Send yourself a password reset from the live site to confirm email delivery works.

### Sending email from Gmail (quick start)

Until a domain is verified with an email provider, UniPact can send through the project Gmail account:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=unipact.my@gmail.com
EMAIL_HOST_PASSWORD=<16-character Google app password>
DEFAULT_FROM_EMAIL=UniPact <unipact.my@gmail.com>
SUPPORT_EMAIL=unipact.my@gmail.com
```

Create the app password under the Google account's 2-Step Verification settings (a normal password will not work).
Gmail allows roughly 500 messages a day and always shows the gmail.com sender, so move to a provider with the
real domain (`no-reply@unipact.my`) before any serious volume.

## 2. Frontend (React)

On Vercel, set the project root to `unipact-frontend`:
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables (see `unipact-frontend/.env.example`):
  - `VITE_API_BASE_URL=https://api.unipact.my/api`
  - `VITE_SITE_URL=https://app.unipact.my`: makes WhatsApp/LinkedIn link previews, `sitemap.xml` and `robots.txt` use your real address
  - `VITE_LEGAL_ENTITY_NAME`, `VITE_LEGAL_REGISTRATION_NO`, `VITE_LEGAL_ADDRESS`, `VITE_CONTACT_EMAIL`: shown on the Privacy Policy, Terms pages and the footer (bracketed placeholders appear until set). Take them from the SSM registration certificate; the registered business name, registration number and registered address must match it exactly
  - `VITE_SENTRY_DSN` (optional): frontend error monitoring; use a separate Sentry project from the backend

Vite bakes these in at build time, so **redeploy after changing them**.

`vercel.json` makes deep links such as `/student/dashboard` work and adds security headers. `public/_redirects` does the same on Netlify.

After deploying, paste your site link into the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) or a WhatsApp chat to check the preview image.

## 3. What is protected now

- **Rate limits (per IP):** login 10/min, registration 20/hour, token refresh 60/min, general API 120/min anonymous and 600/min signed in. Tune with `THROTTLE_*` variables. If you run several server processes, set `REDIS_URL` so they share counters.
- **Passwords:** at least 8 characters, not common, not all numbers, not similar to the email. Applies to every sign-up form.
- **Uploads:** allow-listed file types only, executables/HTML/SVG blocked (including disguised files), and size limits of 10 MB for ID/SSM documents and 500 MB for project files (`MAX_*_UPLOAD_MB`). Also set the same limit on your host or proxy (e.g. Nginx `client_max_body_size 500m`).
- **Cookies:** HttpOnly, `Secure` and a controlled `SameSite`/domain in production.
- **Headers:** HTTPS redirect, HSTS (1 year), no-sniff, clickjacking protection, strict referrer policy. The browsable API is disabled in production.

- **Accounts:** forgot/reset password (links work once and expire after 1 hour, 5 requests per hour per IP), change password, and a confirmation email whenever a password changes.
- **Consent:** sign-up requires agreeing to the Terms and Privacy Policy; the time of agreement is stored on the user (`terms_accepted_at`).
- **Errors:** a friendly error screen instead of a blank page; with `SENTRY_DSN` / `VITE_SENTRY_DSN` set, crashes are reported to Sentry without personal data.

## 4. Legal pages: review before launch

`/privacy` and `/terms` are a **plain-language draft**, written for a Malaysian marketplace under the PDPA 2010. They are not legal advice. Before launch, have a lawyer review them and confirm these business decisions, which the draft assumes:

- **Ownership of deliverables** passes to the client once the project is completed and paid for, unless agreed otherwise in writing.
- **Fees**: UniPact keeps a service fee (currently 10%) from each project fee and holds the rest in escrow until milestones are approved. The service fee is non-refundable once the team is confirmed; money held for undelivered milestones is handled case by case. There is no Pro plan for student projects.
- **Minimum age** is 18, or younger with parent/guardian permission.
- **Business form**: the SSM certificate is a *Borang D* registration under the Registration of Businesses Act 1956 (a sole proprietorship/enterprise), not a Sdn. Bhd. The owner is personally liable, so ask the lawyer whether the liability cap and the payout arrangements still work, and whether incorporating is worth it before handling client money.
- **Liability** is capped at the fees paid to UniPact in the previous 12 months.
- **Holding client money:** UniPact now collects the full project fee and pays students by milestone. Ask the lawyer whether holding these funds needs a separate client account, or a licence under the Financial Services Act or Money Services Business Act, and how that fits a Borang D sole proprietorship.
- **Data outside Malaysia:** hosting, email and Sentry providers may store data abroad.
- **Language:** PDPA notices are expected in both Bahasa Malaysia and English; a Malay version is not included yet.

Set the business details with the `VITE_LEGAL_*` variables so the pages show your registered name, SSM number and address.

## 5. Still to do before real users

These need decisions or third-party accounts, so they are not built yet:
- Real payment provider (ToyyibPay). Until then clients pay by invoice and bank transfer, and admins record payments and payouts by hand.
- Database backups: turn on automatic daily backups in your PostgreSQL provider's dashboard.
- Accounts on an email provider (with your domain verified) and, optionally, Sentry.
- Legal review of the Privacy Policy and Terms (see above).
