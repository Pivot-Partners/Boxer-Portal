# 09 — Deployment & Infrastructure

**Version:** 1.0  
**Date:** 2026-05-13

---

## Overview

Phase 1 runs entirely on free-tier infrastructure. There is no Boxer IT involvement and no integration with Boxer systems. The stack is self-contained, deployed from Git push, and requires no manual server management.

---

## Infrastructure Components

| Component | Service | Region | Tier |
|-----------|---------|--------|------|
| Frontend (Next.js) | Vercel | Auto (CDN) | Hobby (Free) |
| Backend API (Fastify) | Railway | Johannesburg (AF-SOUTH-1) or Singapore as fallback | Hobby (~$0–2/month) |
| Database (PostgreSQL) | Supabase | `af-south-1` (Cape Town) | Free |
| File Storage | Supabase Storage | Same project | Free |
| Email | Resend | (Managed, SA-compliant delivery) | Free |
| SMS | Panacea Mobile or BulkSMS | SA | Pay per use |
| AI Extraction | Anthropic Claude API | (API call, data not stored by Anthropic) | Pay per use |

> **Data residency note:** All primary data storage must be within South Africa. Railway's Johannesburg region satisfies this for the backend. Supabase's `af-south-1` (Cape Town) region satisfies this for the database and storage. Verify both at project setup.

---

## Repository Structure

Single Git repository containing both frontend and backend:

```
boxer-portal/
├── frontend/                   # Next.js app
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   └── vercel.json
├── backend/                    # Fastify API
│   ├── src/
│   ├── package.json
│   └── railway.json
├── shared/                     # Shared TypeScript types (optional)
│   └── types/
├── scripts/                    # Migration, seed, and utility scripts
│   ├── seed-admin.ts
│   ├── migrate-pilot-data.ts
│   └── db-setup.sql
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml
│       └── deploy-backend.yml
└── README.md
```

---

## Environment Variables

### Backend (Railway — set in Railway dashboard)

```env
# Database
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # Full access key — backend only, never expose to frontend
SUPABASE_ANON_KEY=          # For storage public access if needed

# Authentication
JWT_SECRET=                  # 64+ character random string
JWT_REFRESH_SECRET=          # Different 64+ character random string
BCRYPT_ROUNDS=12

# Email
RESEND_API_KEY=

# SMS
SMS_PROVIDER=panacea          # or 'bulksms'
PANACEA_API_KEY=
PANACEA_SENDER_ID=BOXER-HR
BULKSMS_USERNAME=
BULKSMS_PASSWORD=

# AI
ANTHROPIC_API_KEY=

# Scheduling
BATCH_CUTOFF_DAY=9            # Day of month — can also be set in system_config
BATCH_CUTOFF_HOUR=23

# Environment
NODE_ENV=production
API_BASE_URL=https://api.boxer-portal.co.za
FRONTEND_URL=https://boxer-portal.co.za

# First-run seed
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_INITIAL_PASSWORD=  # Delete after first login
```

### Frontend (Vercel — set in Vercel dashboard)

```env
# API
NEXT_PUBLIC_API_BASE_URL=https://api.boxer-portal.co.za/v1

# Supabase (read-only client — for direct storage signed URL generation only)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Environment
NEXT_PUBLIC_ENV=production
```

> **Security note:** The `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the frontend. It grants full database access bypassing RLS. It belongs only in the backend Railway environment.

---

## Deployment Workflow

### Initial Setup (One-time)

**1. Supabase:**
```bash
# Create project at supabase.com — select af-south-1 region
# Note: project URL and keys
# Run schema setup:
npx supabase db push   # or paste scripts/db-setup.sql in Supabase SQL editor
```

**2. Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
# Link to backend/ directory
# Set environment variables in Railway dashboard
# Deploy:
git push  # Railway auto-deploys on push to main
```

**3. Vercel:**
```bash
# Install Vercel CLI
npm install -g vercel
cd frontend/
vercel --prod
# Set environment variables in Vercel dashboard
# Future deploys via Git push (auto-deploy on main branch)
```

**4. Seed Super Admin:**
```bash
# From local machine or Railway shell:
cd backend/ && npm run seed:admin
```

### Ongoing Deployments

| Change | How to Deploy |
|--------|---------------|
| Frontend (Next.js) | Git push to `main` → Vercel auto-deploys |
| Backend (Fastify) | Git push to `main` → Railway auto-deploys |
| Database schema changes | Run migration script via `npm run migrate` from local or Railway shell |
| Environment variable change | Update in Railway or Vercel dashboard — backend auto-restarts |

### Deployment Environments

| Environment | Branch | Purpose |
|-------------|--------|---------|
| Production | `main` | Live system |
| Staging | `staging` | Pre-production testing with production-like data |
| Development | Local | Developer machines |

For Phase 1 (stealth build), staging and production can share the same infrastructure. A separate Supabase project is recommended for staging to avoid data contamination.

---

## CI/CD Pipeline (GitHub Actions)

### `.github/workflows/deploy-frontend.yml`
```yaml
name: Deploy Frontend
on:
  push:
    branches: [main]
    paths: ['frontend/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
```

### `.github/workflows/deploy-backend.yml`
```yaml
name: Deploy Backend
on:
  push:
    branches: [main]
    paths: ['backend/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: boxer-api
```

---

## Database Migration Strategy

### Schema Changes
All schema changes go through a numbered migration script:

```
backend/scripts/migrations/
├── 001_initial_schema.sql
├── 002_add_leavers_records.sql
├── 003_add_m2_stores.sql
└── ...
```

Apply via:
```bash
npm run migrate    # Runs pending migrations in order
npm run migrate:rollback  # Rolls back last migration
```

Migration state is tracked in a `schema_migrations` table.

### Data Migration (Pilot Data Import)
A separate one-time script handles the import of ~1,300 active rental records from the pilot system:

```bash
npm run migrate:pilot-data -- --source="path/to/source.xlsx"
```

This runs in a staging environment first, generates a reconciliation report, and only runs on production after the project owner signs off on the report.

---

## Backup Strategy

**Database:** Supabase provides daily automated backups on the free tier (7-day retention). For production, enable Point-in-Time Recovery (available on Pro tier — upgrade when Boxer signs off).

**File Storage:** Supabase Storage files are replicated within the region. No additional backup needed for Phase 1. Consider a weekly sync to an S3-compatible backup for critical files (HR uploads, Excel outputs) post-launch.

**Code:** Git repository is the source of truth. Push to GitHub.

---

## Monitoring and Uptime

For Phase 1, lightweight monitoring is sufficient:

- **UptimeRobot (free):** HTTP ping every 5 minutes to the `/health` endpoint. Alert via email if down.
- **Railway built-in metrics:** CPU/memory/request graphs available in the Railway dashboard.
- **Vercel Analytics:** Available on Hobby tier — page load times, error rates.
- **Supabase Dashboard:** Query performance, database size, connection count.

Formal APM (Datadog, New Relic) is not needed for Phase 1 volumes.

---

## Security Hardening

### HTTP Security Headers
Configured in `next.config.js` (frontend) and Fastify plugin (backend):
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `Referrer-Policy: strict-origin-when-cross-origin`

### CORS
Backend CORS configured to allow only:
- `https://boxer-portal.co.za` (production frontend)
- `http://localhost:3000` (development)

### Rate Limiting
Applied at the Fastify level (see API Design document). Prevents brute-force on authentication endpoints.

### Supabase Row-Level Security (RLS)
RLS policies are enabled on all tables as a defence-in-depth measure. The backend uses the `service_role_key` which bypasses RLS — this is intentional. RLS prevents direct database access via the `anon_key` if the `anon_key` were ever exposed.

### Input Validation
All API request bodies are validated against Zod schemas in the Fastify route handlers before any business logic runs. Invalid inputs return a 422 with field-level error detail.

### Secrets Management
All secrets stored in Railway environment variables (backend) and Vercel environment variables (frontend). Never committed to Git. `.env` files are in `.gitignore`.

---

## Scaling Considerations

Phase 1 infrastructure is sized for up to 9,000 concurrent applications (December peak).

| Metric | Phase 1 Capacity | Estimated Peak |
|--------|-----------------|----------------|
| Concurrent frontend users | Vercel CDN: effectively unlimited | ~1,000 |
| API requests/second | Railway: ~200 RPS on Hobby | ~50 RPS at peak |
| Database connections | Supabase: 60 direct + PgBouncer | < 20 concurrent |
| SMS throughput | Panacea/BulkSMS: batch capable | ~9,000 in 24-48 hours |
| Storage | 1GB free on Supabase | < 100MB for Phase 1 |

If Railway Hobby proves insufficient at December peak, upgrade to Railway Pro ($20/month) or implement a queue (BullMQ with Redis) to buffer application submissions. This is not expected to be needed for Phase 1.

---

## Domain and SSL

- Domain: `boxer-portal.co.za` (to be registered or provided by project owner).
- SSL: Automatic via Vercel (Let's Encrypt). Vercel handles certificate renewal.
- API subdomain: `api.boxer-portal.co.za` — pointed at Railway via CNAME.
- SSL for API: Railway provides automatic SSL on custom domains.

---

## Go-Live Checklist

- [ ] Supabase project created in `af-south-1` region
- [ ] Database schema applied (`001_initial_schema.sql`)
- [ ] Railway backend deployed and health check passing
- [ ] Vercel frontend deployed and accessible
- [ ] All environment variables set (no placeholder values)
- [ ] Super Admin account seeded and initial password changed
- [ ] SMS provider account active and sender ID approved
- [ ] Resend domain verified and email delivery tested
- [ ] Anthropic API key active and Module 2 AI extraction tested
- [ ] Pilot data migrated (~1,300 rentals) and reconciliation report signed off
- [ ] Whitelist file uploaded for the current month
- [ ] Store Manager details file uploaded for the current month
- [ ] Phone catalogue loaded with current pricing
- [ ] Stock levels uploaded
- [ ] Batch cut-off time configured correctly
- [ ] All alert recipient email addresses configured
- [ ] All report recipient email addresses configured
- [ ] T&Cs document URL linked correctly on the application form
- [ ] Privacy policy URL linked on all employee-facing pages
- [ ] POPIA impact assessment completed and signed off
- [ ] UptimeRobot monitoring active
- [ ] Load test run against peak load scenario (9,000 applications)
- [ ] Staging environment tested with real pilot data
- [ ] Project owner has signed off on staging test results
