# 01 — Tech Stack

**Version:** 1.0  
**Date:** 2026-05-13

---

## Guiding Principles

1. **JavaScript end-to-end.** Frontend and backend share one language and one team. No context switching.
2. **Free tier first.** Every component must have a viable free tier that covers Phase 1 volumes comfortably.
3. **Open source throughout.** Boxer owns the code and is not locked into any paid vendor. AI/SMS costs are the only variable running cost.
4. **Familiarity over novelty.** The team knows this stack. No new technology is introduced without a clear reason.
5. **Modular from day one.** The architecture must allow new modules to be added without rebuilding shared components.

---

## Stack Summary

| Layer | Technology | Hosting | Cost |
|-------|-----------|---------|------|
| Frontend | Next.js 14+ (App Router) | Vercel Hobby | Free |
| Backend API | Node.js 20+ / Fastify 4+ | Railway Hobby | ~$0–2/month |
| Database | Supabase (PostgreSQL 15) | Supabase Free Tier | Free |
| File Storage | Supabase Storage | Supabase Free Tier | Free |
| Authentication | Custom JWT + bcryptjs | (within backend) | Free |
| SMS | Panacea Mobile or BulkSMS | External | ~R0.20/SMS |
| Email (transactional) | Resend | Resend Free Tier | Free |
| PDF Parsing | pdf-parse | (npm package) | Free |
| OCR | Tesseract.js | (npm package) | Free |
| AI Extraction | Anthropic Claude API | Anthropic | ~R15/month |
| Excel Generation | ExcelJS | (npm package) | Free |
| Job Scheduling | node-cron | (within backend) | Free |
| Hashing | bcryptjs | (npm package) | Free |
| WhatsApp (Phase 2) | Twilio or Clickatell | External | TBD |

---

## Component Detail

### Frontend — Next.js 14+

**Why:** React framework with App Router, server-side rendering, and static generation. One codebase serves the employee portal (PWA), the store manager portal, and the full admin dashboard. Vercel is the natural deployment target and the free tier comfortably handles all Phase 1 volumes.

**Key capabilities used:**
- App Router with server and client components
- Progressive Web App (PWA) support via `next-pwa` — installable on Android without an app store
- Server Actions for secure form submissions
- Middleware for JWT validation and role-based route protection
- Responsive layout targeting low-end Android phones (320px minimum)

**Vercel Free Tier limits:**
- 100 GB bandwidth/month
- Unlimited deployments
- Serverless function execution: 100 GB-hours/month
- All limits are well above Phase 1 requirements

**Version target:** Next.js 14.2+, React 18+

---

### Backend API — Node.js + Fastify

**Why Fastify over Express:** Faster request throughput, built-in schema validation (via JSON Schema / Zod), better TypeScript support, and cleaner plugin architecture. For a system that processes batch jobs, scheduled tasks, and file uploads, Fastify's performance and structure are a better fit than Express.

**Why Railway over Render:** Railway has a more predictable free credit model and does not sleep instances after inactivity (critical for scheduled cron jobs). The Hobby plan provides $5/month in credits — at Phase 1 volumes the backend will comfortably stay within that.

**Key responsibilities:**
- REST API serving the Next.js frontend
- JWT authentication middleware
- File upload processing (whitelist, leavers, stock, store managers)
- PDF parsing pipeline (Module 2)
- AI extraction calls (Module 2)
- Scheduled batch jobs (node-cron)
- SMS and email dispatch
- Audit logging

**Railway Hobby Tier:**
- $5 USD/month credit included
- Always-on (no sleep) — essential for cron jobs
- Deploys from Git push
- Estimated Phase 1 cost: $0–2/month within credit

**Version target:** Node.js 20 LTS, Fastify 4.x

---

### Database — Supabase (PostgreSQL 15)

**Why Supabase over a bare PostgreSQL host:** Supabase provides PostgreSQL with row-level security (RLS), a management dashboard, built-in connection pooling (PgBouncer), storage (for PDFs and Excel files), and a generous free tier. When Boxer eventually migrates to their AWS environment, the underlying PostgreSQL database exports cleanly — no rebuild required.

**Why Supabase over Neon:** Both are viable. Supabase is preferred because it bundles Storage (eliminating the need for a separate S3 bucket), has a better dashboard for non-developer administrators, and provides RLS policies that can enforce POPIA access controls at the database layer.

**Supabase Free Tier limits:**
- 500 MB database storage
- 1 GB file storage
- Unlimited API requests
- 2 projects
- Paused after 1 week of inactivity on free tier — **mitigation:** keep a lightweight scheduled ping from the Railway backend to prevent pausing, or upgrade to the $25/month Pro tier once revenue is confirmed

**Version target:** Supabase JS client v2, PostgreSQL 15

**Storage buckets:**
- `whitelist-uploads` — monthly HR whitelist files
- `leavers-uploads` — monthly HR leavers files
- `stock-uploads` — stock update files
- `store-manager-uploads` — monthly store manager files
- `utility-bills` — raw PDF utility bills (private)
- `excel-outputs` — generated Excel output files (private)
- `file-archive` — all uploaded source files for audit

---

### Authentication — Custom JWT + bcryptjs

**Why not Supabase Auth:** Supabase Auth is designed for standard email/password or OAuth flows. The Boxer system has two fundamentally different authentication models:

1. **Admin users** (Super Admin, M1 Admin, M2 Admin, M2 Reviewer): email + password
2. **Employees and Store Managers**: employee number + ID number validated against hashed whitelist records

Supabase Auth cannot handle the second model. A custom JWT implementation gives full control over both flows from one place.

**bcryptjs:** All employee numbers and ID numbers are hashed with bcryptjs (cost factor 12) before being written to the database. Login/application validation works by hashing the input and comparing against stored hashes — the database never holds raw PII. This is a POPIA compliance requirement.

**JWT strategy:** Short-lived access tokens (15 minutes) + refresh tokens (7 days) for admin users. Shorter sessions (4 hours, no refresh) for employees and store managers given the transactional nature of their interactions.

---

### SMS — Panacea Mobile / BulkSMS

**Why:** Both providers are widely used in South Africa, support branded sender IDs (e.g. `BOXER-HR`), offer pay-per-SMS pricing with no monthly fee, and have reliable delivery to South African mobile networks. No monthly commitment — ideal for the risk build phase.

**Usage in Module 1:**
- OTP verification at application time
- Application confirmation SMS
- Leaver notification SMS

**OTP recommendation:** Use a dedicated SMS provider (Panacea Mobile or BulkSMS) for OTP delivery rather than the Boxer marketing team's bulk provider. OTPs require low latency and delivery receipts that a bulk marketing system may not provide.

**Estimated cost:**
- OTP + confirmation: ~2 SMS per application
- At 2,000 applications/month: ~4,000 SMS = ~R800/month
- At 9,000 applications/month (December): ~18,000 SMS = ~R3,600/month

---

### Email — Resend

**Why:** Purpose-built for transactional email. Simple REST API, React Email template support (matches the Next.js stack), reliable delivery, and a free tier of 3,000 emails/month.

**Free Tier limit:** 3,000 emails/month
**Estimated usage:**
- Store manager order notifications: ~550/month
- Leaver notifications: variable
- Admin reports: ~8/month (weekly × 2 modules)
- Module 2 Excel output emails: ~550/month
- Total: well within 3,000/month for Phase 1

**Upgrade path:** $20/month for 50,000 emails if volumes grow post-Boxer sign-off.

---

### PDF Parsing — pdf-parse + Tesseract.js

**pdf-parse:** Node.js library for extracting text from true digital PDFs. Used for all known municipality bill formats. Fast, zero running cost, no API dependency.

**Tesseract.js:** JavaScript port of the Tesseract OCR engine. Applied as a preprocessing step when an incoming utility bill is detected as a scanned image rather than a digital PDF. Adds latency but handles the edge case without external API cost.

**Detection logic:** Attempt text extraction with pdf-parse. If the character count returned is below a threshold (e.g. fewer than 50 characters for a multi-page bill), classify as scanned and route through Tesseract.js before parsing.

---

### AI Extraction — Anthropic Claude API

**Why Claude over GPT-4o:** The project owner has already tested Claude on utility bill extraction with positive results. Claude's long context window and strong instruction-following make it well-suited for structured field extraction from varied document layouts.

**Usage:** AI extraction only fires when the PDF parser cannot match a known municipality format or detects a layout change in a known format. At 10% of 550 bills/month = 55 bills/month.

**Estimated cost at Phase 1 volumes:**
- ~55 bills/month × ~2,000 tokens/bill = ~110,000 tokens/month
- At current Claude pricing: approximately R10–R20/month
- Tracked and reported in the admin dashboard monthly

**Model target:** `claude-haiku-4-5-20251001` for cost efficiency on structured extraction tasks. Fallback to `claude-sonnet-4-6` if extraction quality is insufficient.

---

### Excel Generation — ExcelJS

**Why:** Mature, widely-used Node.js library for creating and modifying Excel files. Supports complex templates, cell styling, multiple sheets, and formula injection. Open source, no running cost.

**Usage:** Module 2 — generates the required Excel output file from extracted utility bill data, applying the Boxer submission template format.

---

### Job Scheduling — node-cron

**Why:** Lightweight, runs inside the existing Fastify process on Railway. No separate service or infrastructure needed. Sufficient for Phase 1 scheduled tasks.

**Scheduled jobs:**
- Module 1 batch processing trigger (configurable — default: 23:00 on the 9th of each month)
- Module 1 weekly summary report (default: Monday 07:00)
- Module 1 pay@ reconciliation run (configurable frequency)
- Module 2 missing bill alert check (daily)
- Module 2 submission status check (daily)
- Database activity ping to prevent Supabase free tier pause (every 3 days)

---

## Cost Summary

### Phase 1 Monthly Running Costs

| Item | Cost |
|------|------|
| Vercel (frontend) | Free |
| Railway (backend) | $0–2 USD |
| Supabase (database + storage) | Free |
| Resend (email) | Free |
| Claude API (Module 2 AI extraction) | ~R15–20/month |
| SMS (Module 1 OTP + confirmations) | ~R800–3,600/month (volume-dependent) |
| **Total infrastructure** | **~$0–2 USD + SMS + AI** |

The only meaningful variable cost is SMS. At 2,000 applications/month the SMS cost is approximately R800. This is factored into the commercial proposal to Boxer.

### Upgrade Triggers

| Event | Action |
|-------|--------|
| Supabase pausing due to inactivity | Add ping job (already planned) or upgrade to Pro ($25/month) |
| Railway exceeding $5 credit | Upgrade to Pro (~$20/month) or optimise job scheduling |
| Resend exceeding 3,000/month | Upgrade to $20/month plan |
| Supabase exceeding 500MB storage | Archive old files to cold storage or upgrade |

---

## Package Dependencies (Key)

### Backend (`package.json`)
```json
{
  "fastify": "^4.x",
  "@fastify/multipart": "^8.x",
  "@fastify/jwt": "^8.x",
  "@fastify/cors": "^9.x",
  "@fastify/rate-limit": "^9.x",
  "@supabase/supabase-js": "^2.x",
  "bcryptjs": "^2.4.x",
  "node-cron": "^3.x",
  "pdf-parse": "^1.1.x",
  "tesseract.js": "^5.x",
  "@anthropic-ai/sdk": "^0.x",
  "exceljs": "^4.x",
  "resend": "^3.x",
  "zod": "^3.x",
  "dotenv": "^16.x"
}
```

### Frontend (`package.json`)
```json
{
  "next": "^14.x",
  "react": "^18.x",
  "react-dom": "^18.x",
  "@supabase/supabase-js": "^2.x",
  "next-pwa": "^5.x",
  "zod": "^3.x",
  "react-hook-form": "^7.x",
  "@hookform/resolvers": "^3.x",
  "tailwindcss": "^3.x"
}
```

---

## Technology Decisions Not in Scope (Phase 1)

| Technology | Decision | Reason |
|-----------|----------|--------|
| WhatsApp Business API | Phase 2 | Cost concern (R1.40/message vs R0.20 SMS). Core system must be stable first. |
| Boxer SAP integration | Phase 2+ | Requires Altron involvement and IT security review. Light-touch file upload is sufficient for Phase 1. |
| Browser automation agent (M2 submission) | Phase 2 | Service provider portal complexity unknown. Phase 1 emails Excel to internal contact. |
| Separate secrets manager | Not required | Railway environment variables are sufficient for Phase 1. |
| Redis / queue system | Not required | Job volumes do not require a dedicated queue. node-cron within Railway is sufficient. |
| TypeScript | Recommended | Strongly recommended for maintainability. Treat as a requirement, not an option. |
