# Boxer Operations Portal — CLAUDE.md

## Project Overview

Monorepo SaaS platform for Boxer Stores. Two modules:
- **Module 1** — Staff Phone Rental Scheme (~18,000 eligible employees, ~9,000 peak in December)
- **Module 2** — Utility Bill Automation (~550 stores/month)

Spec documents live in `E:\Work\boxer\`. Always consult them before making architectural decisions.

---

## Repo Structure

```
boxer-portal/
├── frontend/        # Next.js 14 — Vercel
├── backend/         # Fastify 4 — Railway
├── shared/          # Shared TypeScript types
├── scripts/         # DB migrations, seed, data import
└── CLAUDE.md
```

---

## Stack — LOCKED, no deviations without agreement

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Backend | Fastify 4, TypeScript, Node.js |
| Database | Supabase PostgreSQL 15 (`af-south-1`) |
| Storage | Supabase Storage |
| Auth | Custom JWT + bcryptjs (cost 12) — NOT Supabase Auth |
| Email | Resend |
| SMS | Panacea Mobile (primary), BulkSMS (fallback) |
| AI | Anthropic Claude API (M2 fallback extraction only) |
| File gen | ExcelJS |
| PDF | pdf-parse + Tesseract.js (OCR) |
| Scheduling | node-cron (runs in Fastify process on Railway) |
| Hosting | Vercel (frontend) + Railway (backend) |

---

## Code Style

- **TypeScript throughout** — no `any` unless absolutely necessary, comment why
- **Tabs, semicolons** (Prettier)
- **No comments** unless the WHY is non-obvious
- **No unused imports, variables, or dead code**
- Zod for all API request validation
- All DB access goes through the Supabase client in `backend/src/plugins/database.ts`

---

## POPIA Compliance — Non-Negotiable

- **No raw PII in the database.** Whitelist lookups use HMAC-SHA256 (deterministic, indexed). Applications store employee number and ID number as AES-256-GCM ciphertext (reversible for HR export only).
- **No raw PII in JWTs.** Tokens carry `employee_number_hash`, never the actual number.
- **No raw PII in logs.** Audit entries use hashes only.
- `display_name` (first + last name) is the ONLY plaintext personal field stored.
- Data residency: Supabase Frankfurt (`eu-central-1`) for staging. POPIA sign-off required before production go-live (see DEPLOYMENT.md).

---

## Auth — Two Models

**Employees & Store Managers:** Employee number → HMAC-SHA256 → indexed lookup in whitelist_records; ID number → HMAC compare against stored hash
**Admins:** Email + password → bcrypt compare (cost 12) against users table; 15-minute JWT + 7-day httpOnly refresh token

JWTs stored in **httpOnly, SameSite=Strict cookies** — never localStorage.

---

## Key Business Rules

### Module 1 Phone Rental

- Eligibility driven by salary bracket flags in HR whitelist (`>3600`, `>4400`, etc.)
- 25% rule: upfront payment ≤ 25% of monthly salary bracket
- Active contract in DB = ineligible to apply (HR whitelist is NOT enough alone)
- Application supersedes previous pending application from same employee in same period
- Batch cut-off: midnight on the 9th of each month (configurable via `system_config`)
- Post-deadline cancellations: admin-only
- Stock: on/off switch per model (not unit count)
- Phone catalogue is time-bound per period — prices/models can change between periods

### Place of Work
- Employee selects: category first → store dropdown filtered to that category
- 6 categories: Boxer Supermarket or Boxer Mini, Boxer Liquor, Boxer Build, Distribution Center, Meat Factory, Head Office
- Meat Factory (single: "Ballito Meat Factory") and Head Office (single: "Boxer Head Office") auto-select
- Store names kept verbatim including suffixes (e.g. "Baden (Liquor)")

### HR Output File (Excel, password-protected)
Columns: `Date of application, Full name, Surname, Employee number, ID Number, Phone number, Email, Place of Work, Location, Which Phone, Buy for Cash, Rent 7 Months, Rent 13 Months, Cancellation Request, First deduction, Deductions after first deduction, Number of subsequent deductions, Term`

---

## Environment Variables

### Backend (`backend/.env`)
```
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
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_INITIAL_PASSWORD=
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
NEXT_PUBLIC_ENV=development
```

---

## Running Locally

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev   # runs on :3001

# Terminal 2 — frontend
cd frontend && npm install && npm run dev  # runs on :3000
```

SMS and email calls fail gracefully in dev (logged, not thrown). AI calls require a valid `ANTHROPIC_API_KEY`.

---

## Database

Apply all migrations in order via the Supabase SQL editor:

| File | What it does |
|------|-------------|
| `001_initial_schema.sql` | All tables, indexes, RLS on 5 core tables, grants, seed data |
| `002_batch_catalogue_and_pii.sql` | `batch_phone_catalogue` table, encrypted PII columns on applications |
| `003_application_admin_edit.sql` | Admin edit tracking columns on applications |
| `004_whitelist_salary_band_nullable.sql` | Allow null salary_band on whitelist_records |
| `005_enable_rls_all_tables.sql` | RLS on the 11 tables migration 001 missed — required before go-live |

Seed super admin after schema is applied:
```bash
cd backend && npm run seed:admin
```

---

## Deployment

- Frontend: Vercel — auto-deploys on push to `main` (paths: `frontend/**`)
- Backend: Railway — auto-deploys on push to `main` (paths: `backend/**`)
- DB changes: run migration script manually before deploying backend

---

## Module 1 Build Priority

Build in this order:
1. DB schema + seed data (stores, phone catalogue)
2. Auth (employee login, admin login)
3. Employee application flow
4. Admin: whitelist upload + management
5. Admin: batch processing + approval
6. Admin: Excel output generation
7. Store manager: delivery confirmation
8. Migration script (import ~1,327 pilot records)
