# Boxer Operations Portal — Deployment Guide

This guide covers **Staging** end-to-end, step by step. Production is identical — repeat every step using production names. Never share credentials between environments.

---

## A note on data residency

Supabase's hosted platform does not offer a South Africa region. The closest available options are:
- **Frankfurt, Germany** (`eu-central-1`) — recommended for staging
- **Singapore** (`ap-southeast-1`)

For POPIA purposes, the formal data residency position must be resolved by the POPIA impact assessment (which is a go-live blocker). Use Frankfurt for staging and development. Do not go live on production until the POPIA consultant has signed off on the hosting arrangement.

If the POPIA assessment requires in-country hosting, the alternative is a self-hosted Supabase instance on a South African VPS (Hetzner has a Johannesburg datacentre). This guide covers the hosted Supabase path.

---

## Part 1 — Supabase (Database + Storage)

### 1.1 Create a Supabase account

1. Open [supabase.com](https://supabase.com) in your browser
2. Click **Start your project** (top right)
3. Click **Continue with GitHub** — sign in with your GitHub account (or create a GitHub account first if you don't have one)
4. Supabase will ask you to authorise the GitHub OAuth app — click **Authorize supabase**
5. You land on the Supabase dashboard

### 1.2 Create the staging organisation

1. On the dashboard, click **New organization**
2. **Name:** `Boxer Portal`
3. **Plan:** Free — click **Create organization**

### 1.3 Create the staging project

1. Click **New project**
2. **Organization:** Boxer Portal (the one you just created)
3. **Project name:** `boxer-portal-staging`
4. **Database password:** click **Generate a password** — copy and save this immediately in a password manager (you will not see it again)
5. **Region:** select **Frankfurt, Germany (eu-central-1)**
6. Click **Create new project**
7. Wait approximately 2 minutes — you will see a progress bar. Do not close the tab.

### 1.4 Apply the database schema

Apply all migrations **in order**, one at a time. Each migration must succeed before running the next.

**Migration 001 — Initial schema**
1. In the left sidebar, click **SQL Editor** → **New query**
2. Open `scripts/migrations/001_initial_schema.sql`, copy the entire contents, paste into the editor
3. Click **Run** — you should see `Success. No rows returned`
4. Verify: click **Table Editor** — you should see these tables:
   `applications, audit_logs, batch_phone_catalogue (missing until 002), batches, otp_events, orders, phone_models, rentals, roles, sessions, store_managers, stores, system_config, users, whitelist_records, whitelist_uploads`

**Migration 002 — Batch phone catalogue + encrypted PII columns**
1. Click **New query**, paste `scripts/migrations/002_batch_catalogue_and_pii.sql`, click **Run**
2. Adds the `batch_phone_catalogue` table and encrypted PII columns on `applications`

**Migration 003 — Admin edit tracking on applications**
1. Click **New query**, paste `scripts/migrations/003_application_admin_edit.sql`, click **Run**
2. Adds `admin_edited_by`, `admin_edited_at`, `admin_edit_notes`, `admin_editor_name` to `applications`

**Migration 004 — Allow null salary band**
1. Click **New query**, paste `scripts/migrations/004_whitelist_salary_band_nullable.sql`, click **Run**
2. Makes `whitelist_records.salary_band` nullable so employees with no eligible bracket can still log in

**Migration 005 — Enable RLS on all remaining tables**
1. Click **New query**, paste `scripts/migrations/005_enable_rls_all_tables.sql`, click **Run**
2. Enables Row Level Security on the 11 tables that migration 001 missed — **required before going live**
3. The backend uses `service_role` which bypasses RLS, so nothing breaks

> **If you see a `permission denied` error** from the API after applying migrations, paste and run just the three `GRANT` lines from the bottom of `001_initial_schema.sql`.

> **If a migration fails partway through**, click **Table Editor**, check what was and wasn't created, fix the cause (usually a typo or partial paste), and re-run only that migration.

### 1.5 Create the storage bucket

1. In the left sidebar, click **Storage**
2. Click **New bucket**
3. **Name:** `whitelist-uploads` — type this exactly, it must match the code
4. Leave **Public bucket** toggled OFF
5. Click **Save**
6. The bucket appears in the list

### 1.6 Copy your API credentials

1. In the left sidebar, click **Project Settings** (gear icon at the bottom)
2. Click **API** in the settings submenu
3. You will see two sections — copy and save these values:

| What to copy | Where it is |
|---|---|
| **Project URL** | Under "Project URL" — looks like `https://abcdefghijkl.supabase.co` |
| **service_role** key | Under "Project API keys" → the second key labelled `service_role` — click the eye icon to reveal it |

> **Important:** Do NOT copy the `anon` key. The backend uses the `service_role` key which bypasses Row Level Security. Keep this secret — never commit it to git or paste it anywhere public.

---

## Part 2 — Backend Environment

### 2.1 Generate JWT secrets and encryption key

You need three random secrets. Open a terminal in the `backend/` folder and run this command three times, saving each output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it once → copy the output → save as JWT_SECRET  
Run it again → copy the output → save as JWT_REFRESH_SECRET  
Run it a third time → copy the output → save as ENCRYPTION_KEY  
All three must be different from each other.

> **ENCRYPTION_KEY** must be exactly 64 hex characters (32 bytes). The command above always produces this. It is used for AES-256-GCM encryption of employee numbers and ID numbers stored in the applications table — required for the HR Excel export to work. Without it the backend will refuse to start.

### 2.2 Create the backend .env file

In the `backend/` folder, create a file called `.env` (no extension). Copy the contents below and fill in every value:

```env
# ── Database ──────────────────────────────────────────────────────────────────
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=paste-first-generated-secret-here
JWT_REFRESH_SECRET=paste-second-generated-secret-here
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=paste-third-generated-secret-here

# ── Email ─────────────────────────────────────────────────────────────────────
RESEND_API_KEY=re_leave_blank_for_now

# ── SMS ───────────────────────────────────────────────────────────────────────
SMS_PROVIDER=panacea
PANACEA_API_KEY=leave_blank_for_now
PANACEA_SENDER_ID=BOXER-HR

# ── AI (Module 2 only — leave blank for now) ──────────────────────────────────
ANTHROPIC_API_KEY=

# ── App ───────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# ── Seed (only used when running seed scripts) ────────────────────────────────
SUPER_ADMIN_EMAIL=admin@yourcompany.co.za
SUPER_ADMIN_INITIAL_PASSWORD=ChangeMe#2026!
```

Replace:
- `SUPABASE_URL` → the Project URL from step 1.6
- `SUPABASE_SERVICE_ROLE_KEY` → the service_role key from step 1.6
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` → the three values you generated in step 2.1
- `SUPER_ADMIN_EMAIL` → the email address the admin will log in with
- `SUPER_ADMIN_INITIAL_PASSWORD` → a temporary strong password (you will change this after first login)

### 2.3 Start the backend

```bash
cd backend
npm run dev
```

You should see something like:
```
{"level":"info","msg":"Server listening at http://0.0.0.0:3001"}
```

If you see a `JWT_SECRET is required` error — the `.env` file is not being read. Make sure the file is named `.env` (not `.env.txt` or `env`) and is inside the `backend/` folder.

### 2.4 Seed the super admin

Open a **second terminal** (keep the first one running the server), navigate to `backend/`:

```bash
cd backend
npx tsx ../scripts/seed-admin.ts
```

Expected output:
```
Super admin created: admin@yourcompany.co.za
Change the password on first login.
```

### 2.5 Seed the store list

```bash
npx tsx ../scripts/seed-stores.ts
```

Expected output:
```
Seeding stores...
Inserted 100 / 584
Inserted 200 / 584
...
Done — 584 stores seeded.
```

If you see a file-not-found error, the CSV files in `E:\Work\boxer\docs\` are missing. The seed script reads from that path. Confirm the four CSV files are there:
- `Boxer store list 2 Dec 2025 - Supermarkets and Minis.csv`
- `Boxer store list 2 Dec 2025 - Liquor.csv`
- `Boxer store list 2 Dec 2025 - Build.csv`
- `Boxer store list 2 Dec 2025 - DCs.csv`

---

## Part 3 — Frontend Environment

### 3.1 Create the frontend .env.local file

In the `frontend/` folder, create a file called `.env.local`. Add:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
NEXT_PUBLIC_ENV=development
```

### 3.2 Start the frontend

Open a **third terminal**:

```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

Open `http://localhost:3000` in your browser. You should be redirected to the login page.

---

## Part 4 — First-Run Test (Local)

Work through this checklist in order before doing anything else. Each step confirms a different piece is wired up correctly.

### 4.1 Admin login
1. Go to `http://localhost:3000/login`
2. Click the **Admin** tab
3. Enter the email and password you put in `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_INITIAL_PASSWORD`
4. Click **Sign In**
5. You should land on `http://localhost:3000/admin` — the admin dashboard

If you get "Invalid email or password": double-check that seed-admin ran successfully and that the email you're typing matches exactly (including case — it's stored lowercase).

### 4.2 Upload a whitelist
1. Click **Whitelist** in the top navigation
2. Click the upload area to open a file picker
3. Select one of the HR CSV files (e.g. the Flexi CSV)
4. Wait for the upload to complete — you will see a green success message showing how many valid records were processed
5. A row appears in the upload history table below

If you get a file parsing error: make sure the CSV has the expected column headers (EmployeeNo, Identity Number, First names, Last name, etc.)

### 4.3 Open a batch
1. Click **Batches** in the top navigation
2. Click **Open new batch**
3. **Batch month:** select the current month (e.g. 2026-05)
4. **Cut-off date & time:** pick a date at least 30 minutes in the future (so you have time to test employee login)
5. Click **Open batch**
6. A new batch card appears with status **open**

### 4.4 Employee login
1. Open a **private/incognito browser window** (this keeps the admin session separate)
2. Go to `http://localhost:3000/login`
3. The **Employee / Store Manager** tab is selected by default
4. Enter an employee number and ID number from the whitelist CSV you uploaded
5. Click **Sign In**
6. You should land on `http://localhost:3000/portal`
7. You should see the green "Applications are open" banner

If you get "Employee number or ID number not recognised": the whitelist upload may not have processed that record. Go back to the admin whitelist page and check the error count. Try a different employee from the CSV.

### 4.5 Submit an application
1. Click **Apply Now**
2. **Step 1 — Contact:** enter a mobile number, click Continue
3. **Step 2 — Place of work:** select a store type, then select a store from the dropdown. Try selecting "Meat Factory" — it should auto-select "Ballito Meat Factory" with no dropdown shown
4. **Step 3 — Phone:** select a phone and a payment option (cash / 7-month / 13-month)
5. **Step 4 — Review:** check the details, tick the terms checkbox, click **Submit Application**
6. You should see a confirmation screen with a reference number (e.g. `APP-202605-123456`)

### 4.6 Confirm admin sees the application
1. Switch back to your admin browser window
2. Click **Batches** → click the open batch card
3. The applications table on the right should show the submission you just made
4. Status should be **pending**

### 4.7 Test cancel
1. In the employee window, click **← Back to dashboard**
2. On the dashboard, click **Cancel application**
3. The application card should disappear and the **Apply Now** button should reappear

---

## Part 5 — Deploy Backend to Railway

### 5.1 Create a Railway account

1. Go to [railway.app](https://railway.app)
2. Click **Login** → **Login with GitHub**
3. Authorise Railway to access your GitHub account

### 5.2 Create a new project

1. On the Railway dashboard, click **New Project**
2. Click **Deploy from GitHub repo**
3. If prompted, click **Configure GitHub App** and grant Railway access to the `boxer-portal` repository
4. Select the `boxer-portal` repository from the list
5. Railway will show a service being created — click on it to configure it

### 5.3 Configure the service

1. Click the service card → click **Settings**
2. Under **Source**, find **Root directory** → set it to `backend`
3. Railway will now only deploy from the `backend/` folder
4. Under **Deploy**, find **Start command** → set it to `node dist/server.js`
5. Under **Build**, find **Build command** → set it to `npm run build`

### 5.4 Add environment variables

1. Click the **Variables** tab on the service
2. Click **Raw Editor** (easier for pasting many variables at once)
3. Paste all variables from your `backend/.env` file, but change these three:

```
NODE_ENV=staging
FRONTEND_URL=https://boxer-portal-staging.vercel.app
API_BASE_URL=https://your-railway-url.up.railway.app
```

(You won't know the Railway URL until the first deploy — set it after the first deploy succeeds)

4. Click **Update Variables**

### 5.5 Add a domain

1. Click the **Settings** tab → scroll to **Networking**
2. Click **Generate Domain** — Railway assigns a URL like `boxer-portal-backend-staging.up.railway.app`
3. Copy this URL — you will need it for the frontend env var and for the `API_BASE_URL` variable

### 5.6 Deploy

1. Railway triggers a deploy automatically when you save settings
2. Click the **Deployments** tab to watch the build log
3. A successful deploy ends with your server-listening log message
4. If the build fails, the log will show the error — most common issues are missing env vars or a TypeScript compile error

### 5.7 Run seeds on Railway

After the first successful deploy, run the seed scripts against the deployed backend:

```bash
# Install the Railway CLI
npm install -g @railway/cli

# Log in
railway login

# Link to your project (run from the boxer-portal root directory)
railway link

# Run seeds
railway run -s backend npx tsx scripts/seed-admin.ts
railway run -s backend npx tsx scripts/seed-stores.ts
```

---

## Part 6 — Deploy Frontend to Vercel

### 6.1 Create a Vercel account

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** → **Continue with GitHub**
3. Authorise Vercel

### 6.2 Import the project

1. On the Vercel dashboard, click **Add New** → **Project**
2. Find the `boxer-portal` repository and click **Import**
3. On the configuration screen:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root directory:** click **Edit** → type `frontend` → click **Continue**
   - Leave Build Command and Output Directory as defaults

### 6.3 Add environment variables

Before clicking Deploy, expand **Environment Variables** and add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-railway-url.up.railway.app/v1` |
| `NEXT_PUBLIC_ENV` | `staging` |

Replace `your-railway-url` with the actual Railway domain from step 5.5.

### 6.4 Deploy

1. Click **Deploy**
2. Vercel builds and deploys — takes about 1 minute
3. You get a URL like `https://boxer-portal-staging.vercel.app`

### 6.5 Update Railway CORS

1. Go back to Railway → your backend service → **Variables**
2. Update `FRONTEND_URL` to your actual Vercel URL (e.g. `https://boxer-portal-staging.vercel.app`)
3. Railway redeploys automatically

### 6.6 Staging smoke test

Repeat the checklist from Part 4 using the Vercel URL instead of localhost. Additionally check:

- [ ] Admin login works on the live URL
- [ ] In the browser, open DevTools → Application → Cookies → confirm `token` cookie has `HttpOnly` and `Secure` flags checked
- [ ] Employee login works (expect it to be slow on first attempt — up to 30 seconds on a cold Railway instance)
- [ ] No CORS errors in the browser Console tab during any API call

---

## Part 7 — Production

Repeat Parts 1–6 with these changes:

| Setting | Staging value | Production value |
|---------|--------------|-----------------|
| Supabase project name | `boxer-portal-staging` | `boxer-portal-production` |
| Supabase region | Frankfurt | Frankfurt (same until POPIA sign-off) |
| Railway service name | `backend-staging` | `backend-production` |
| `NODE_ENV` | `staging` | `production` |
| `SUPER_ADMIN_EMAIL` | test email | real operations email |
| `SUPER_ADMIN_INITIAL_PASSWORD` | any strong password | strong password (change on first login) |
| Vercel environment | Preview | Production |

Use completely separate Supabase projects with different passwords and service role keys. Use different JWT secrets. Never copy credentials from staging to production.

---

## Reference — All environment variables

### backend/.env

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
JWT_REFRESH_SECRET=
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=
RESEND_API_KEY=
SMS_PROVIDER=panacea
PANACEA_API_KEY=
PANACEA_SENDER_ID=BOXER-HR
ANTHROPIC_API_KEY=
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_INITIAL_PASSWORD=
```

### frontend/.env.local

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
NEXT_PUBLIC_ENV=development
```
