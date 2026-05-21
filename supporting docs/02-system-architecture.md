# 02 — System Architecture

**Version:** 1.0  
**Date:** 2026-05-13

---

## Overview

The Boxer Operations Portal is a single platform with two functional modules. It follows a conventional three-tier architecture: a Next.js frontend hosted on Vercel, a Fastify REST API hosted on Railway, and a PostgreSQL database on Supabase. All persistent files (PDFs, Excel outputs, HR upload files) live in Supabase Storage.

There is one codebase. One database. One backend. One authentication system. The two modules share all infrastructure and are differentiated by routes, roles, and business logic — not by separate deployments.

---

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USERS (Browser / Mobile PWA)                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │   Employee   │  │  Store Manager   │  │ Admin (M1 / M2 / Super)  │   │
│  └──────┬───────┘  └────────┬─────────┘  └────────────┬─────────────┘   │
└─────────┼───────────────────┼────────────────────────┼─────────────────┘
          │                   │                         │
          └───────────────────┴─────────────────────────┘
                                      │ HTTPS
┌─────────────────────────────────────▼───────────────────────────────────┐
│                          VERCEL — Next.js 14+                           │
│                                                                          │
│  /login              Unified login (smart form — detects role type)      │
│  /portal/apply       Employee: phone application (PWA)                   │
│  /portal/dashboard   Employee: rental status dashboard                   │
│  /store              Store Manager: delivery management                  │
│  /admin              Admin: role-aware dashboard (M1 / M2 / Super)      │
│                                                                          │
│  Middleware: JWT validation, role guard, redirect logic                  │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │ REST API (HTTPS)
┌─────────────────────────────────────▼───────────────────────────────────┐
│                         RAILWAY — Fastify API                            │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ Auth Service│  │  Module 1   │  │   Module 2    │  │   Shared    │  │
│  │             │  │  Phone      │  │   Utility     │  │   Services  │  │
│  │  /auth/*    │  │  Rental API │  │   Bills API   │  │             │  │
│  │             │  │  /m1/*      │  │   /m2/*       │  │  /admin/*   │  │
│  │  JWT issue  │  │             │  │               │  │  /files/*   │  │
│  │  JWT verify │  │  Whitelist  │  │  Bill ingest  │  │  /logs/*    │  │
│  │  bcrypt     │  │  App flow   │  │  PDF parse    │  │  /alerts/*  │  │
│  │  Session    │  │  Batch proc │  │  AI extract   │  │  /reports/* │  │
│  │  mgmt       │  │  Orders     │  │  Excel gen    │  │  /config/*  │  │
│  └─────────────┘  │  Rentals    │  │  Submission   │  └─────────────┘  │
│                   │  Leavers    │  │               │                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    node-cron Scheduler                           │   │
│  │  • M1 batch cutoff trigger  (23:00, 9th of month)               │   │
│  │  • M1 weekly summary report (Monday 07:00)                      │   │
│  │  • M2 missing bill check    (daily 08:00)                       │   │
│  │  • M2 submission status     (daily 09:00)                       │   │
│  │  • Supabase activity ping   (every 3 days)                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────┬─────────────────────────────────────────────────┬─────────────┘
         │ Supabase JS Client                              │ External APIs
┌────────▼────────────────────────┐  ┌────────────────────▼────────────────┐
│  SUPABASE                       │  │  EXTERNAL SERVICES                  │
│                                 │  │                                     │
│  PostgreSQL 15                  │  │  Panacea Mobile / BulkSMS           │
│  ├── Auth schema                │  │  → OTP SMS, confirmation SMS,       │
│  ├── Module 1 schema            │  │    leaver SMS                       │
│  ├── Module 2 schema            │  │                                     │
│  └── Shared schema              │  │  Resend                             │
│                                 │  │  → Transactional email, reports,    │
│  Supabase Storage               │  │    store manager notifications,     │
│  ├── whitelist-uploads/         │  │    Excel delivery (M2)              │
│  ├── leavers-uploads/           │  │                                     │
│  ├── stock-uploads/             │  │  Anthropic Claude API               │
│  ├── store-manager-uploads/     │  │  → AI field extraction for          │
│  ├── utility-bills/             │  │    unknown/changed bill formats     │
│  ├── excel-outputs/             │  │                                     │
│  └── file-archive/              │  │  Teljoy / 3G / WWAS (M1)           │
│                                 │  │  → Order file submission            │
│  Row-Level Security (RLS)       │  │                                     │
│  → Enforces module isolation    │  │  Pay@ Network (M1)                 │
│    at database layer            │  │  → Payment reconciliation data      │
└─────────────────────────────────┘  └─────────────────────────────────────┘
```

---

## Module Architecture

### Module 1 — Phone Rental: Request Flow

```
Employee                     Next.js                     Fastify API                  Supabase
   │                            │                              │                          │
   │── Scan QR / open URL ──────▶│                              │                          │
   │                            │── GET /m1/portal/landing ───▶│                          │
   │                            │                              │                          │
   │── Enter emp# + ID# ────────▶│                              │                          │
   │                            │── POST /auth/employee ───────▶│                          │
   │                            │                              │── Hash inputs            │
   │                            │                              │── Query whitelist ───────▶│
   │                            │                              │◀─ Record returned ────────│
   │                            │                              │── Issue JWT session       │
   │                            │◀─ JWT + employee profile ────│                          │
   │◀─ Show name/workplace ─────│                              │                          │
   │                            │                              │                          │
   │── Confirm/update phone# ───▶│                              │                          │
   │                            │── POST /m1/otp/send ─────────▶│                          │
   │                            │                              │── SMS via Panacea ──────────▶ SMS Provider
   │                            │                              │── Log OTP event ─────────▶│
   │◀─ OTP sent to phone ───────│                              │                          │
   │                            │                              │                          │
   │── Enter OTP ───────────────▶│                              │                          │
   │                            │── POST /m1/otp/verify ───────▶│                          │
   │                            │                              │── Hash OTP + compare     │
   │                            │                              │── Update session         │
   │◀─ Show eligible phones ────│                              │                          │
   │                            │                              │                          │
   │── Select phone + term ─────▶│                              │                          │
   │── Accept T&Cs ─────────────▶│                              │                          │
   │── Submit application ───────▶│                              │                          │
   │                            │── POST /m1/applications ─────▶│                          │
   │                            │                              │── Create application ────▶│
   │                            │                              │── Cancel prior apps ─────▶│
   │                            │◀─ Reference number ──────────│                          │
   │◀─ Confirmation screen ─────│                              │                          │
```

### Module 1 — Batch Processing Flow (runs night of 9th)

```
node-cron trigger (23:00, 9th of month)
         │
         ▼
Close current batch (status: 'closed')
         │
         ▼
Validate all open applications against current whitelist
(re-hash employee# + ID# and compare — catches leavers since last upload)
         │
         ▼
Check stock per phone model
  ├── Sufficient stock: all applications remain valid
  └── Insufficient stock: cancel most-recent applications by timestamp until covered
         │
         ▼
Generate batch summary report
  └── Email to nominated recipients
         │
         ▼
AWAIT ADMIN APPROVAL (dashboard action required)
         │
         ▼ (on approval)
Generate order records
Generate payroll deductions file (Excel)
Submit order files simultaneously to Teljoy, 3G, WWAS
Send confirmation SMS to each employee
Send store notification email to each Store Admin Manager
         │
         ▼
Mark batch: 'orders_submitted'
Log all actions to audit_logs
```

### Module 2 — Bill Processing Flow

```
Email arrives at central inbox
         │
         ▼
Scheduled job / webhook polls inbox
Identifies PDF attachment
         │
         ▼
Extract account number from sender/subject
Match against active store list (m2_stores)
  ├── No match: flag as 'unrecognised account', alert M2 Admin
  └── Match: create bill record (status: 'received')
         │
         ▼
Detect: digital PDF or scanned image?
  ├── Scanned: run Tesseract.js OCR → get text layer
  └── Digital: proceed directly
         │
         ▼
Match municipality format from format library
  ├── Known format: run PDF parser rules → extract fields
  └── Unknown/changed: send to Claude API → extract fields
         │
         ▼
Validate extracted fields
  ├── Complete + in range: status → 'awaiting_review' (initial period)
  │                         or 'auto_approved' (once team confident)
  └── Missing/out of range: status → 'flagged', alert M2 Admin
         │
         ▼
Human review (initial period — side-by-side PDF + fields UI)
Reviewer approves or corrects fields
  └── If new format confirmed: add to municipality_formats library
         │
         ▼
Generate Excel output via ExcelJS template
Store in Supabase Storage
         │
         ▼
Email Excel to nominated internal Boxer contact (Resend)
Log delivery
         │
         ▼
Phase 1: Internal contact submits to service provider portal manually
Phase 2: Browser agent submits automatically
```

---

## Data Flow — Authentication

```
                    ┌────────────────────────────────────────────┐
                    │           /login (Next.js page)            │
                    │                                            │
                    │  Tab A: Employee / Store Manager           │
                    │  ┌─────────────────────────────────────┐  │
                    │  │  Employee Number  [_______________]  │  │
                    │  │  ID Number        [_______________]  │  │
                    │  │                  [  Sign In  ]       │  │
                    │  └─────────────────────────────────────┘  │
                    │                                            │
                    │  Tab B: Administrator                      │
                    │  ┌─────────────────────────────────────┐  │
                    │  │  Email            [_______________]  │  │
                    │  │  Password         [_______________]  │  │
                    │  │                  [  Sign In  ]       │  │
                    │  └─────────────────────────────────────┘  │
                    └────────────────────────────────────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
               Employee/Store Mgr                        Admin
               POST /auth/employee                 POST /auth/admin
                        │                                   │
                        ▼                                   ▼
            Hash emp# + ID# (bcrypt)            Lookup email in users table
            Query whitelist_records             Verify password_hash (bcrypt)
                        │                                   │
                  ┌─────┴──────┐                           │
                  │            │                           │
              Whitelist    Store Mgr                       │
               match         match                    Lookup role
                  │            │                           │
                  ▼            ▼                           ▼
            role: employee  role: store_manager    role: super_admin /
                  │            │                    m1_admin / m2_admin
                  └────────────┴───────────────────────────┘
                                          │
                                   Issue JWT token
                              (role + store_code claims)
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                         employee /             store_manager /
                         /portal/dashboard      /store/dashboard
                              │                       │
                              └───────────┬───────────┘
                                          │
                                     admin role?
                              ┌───────────┴───────────┐
                              │           │           │
                         super_admin  m1_admin   m2_admin
                              │           │           │
                         /admin/     /admin/m1   /admin/m2
                         dashboard   dashboard   dashboard
```

---

## Frontend Route Structure

```
app/
├── (public)/
│   ├── login/
│   │   └── page.tsx              # Unified login — both auth types
│   └── page.tsx                  # Redirect to /login
│
├── (employee)/
│   ├── portal/
│   │   ├── apply/
│   │   │   └── page.tsx          # Phone application form (PWA)
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Rental status, history
│   │   └── layout.tsx            # Employee portal layout + auth guard
│   └── layout.tsx                # Employee layout
│
├── (store)/
│   ├── store/
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Pending deliveries for this store
│   │   └── layout.tsx            # Store manager layout + auth guard
│   └── layout.tsx
│
├── (admin)/
│   ├── admin/
│   │   ├── page.tsx              # Super admin home
│   │   ├── module1/
│   │   │   ├── dashboard/        # M1 overview
│   │   │   ├── whitelist/        # Upload and manage whitelist
│   │   │   ├── applications/     # View all applications
│   │   │   ├── batch/            # Batch processing + approval
│   │   │   ├── orders/           # Order management
│   │   │   ├── rentals/          # Active rental tracking
│   │   │   ├── stock/            # Stock management
│   │   │   ├── leavers/          # Leavers management
│   │   │   └── reports/          # M1 reports
│   │   ├── module2/
│   │   │   ├── dashboard/        # M2 overview
│   │   │   ├── bills/            # Bill processing status
│   │   │   ├── review/           # Human review queue
│   │   │   ├── stores/           # Active store list management
│   │   │   ├── formats/          # Municipality format library
│   │   │   └── reports/          # M2 reports
│   │   ├── logs/                 # Unified audit log (Super Admin only)
│   │   ├── users/                # Admin user management (Super Admin only)
│   │   ├── alerts/               # Alert configuration and history
│   │   └── config/               # System configuration
│   └── layout.tsx                # Admin layout + auth guard
│
└── api/                          # Next.js API routes (thin proxy or unused if all via Fastify)
```

---

## Backend API Structure (Fastify)

```
src/
├── server.ts                     # Fastify instance, plugin registration
├── plugins/
│   ├── auth.ts                   # JWT verification middleware
│   ├── database.ts               # Supabase client
│   └── rateLimit.ts
├── routes/
│   ├── auth/
│   │   ├── employee.ts           # POST /auth/employee
│   │   ├── admin.ts              # POST /auth/admin
│   │   ├── refresh.ts            # POST /auth/refresh
│   │   └── logout.ts             # POST /auth/logout
│   ├── m1/
│   │   ├── otp.ts                # OTP send/verify
│   │   ├── applications.ts       # Application CRUD
│   │   ├── batches.ts            # Batch management + approval
│   │   ├── orders.ts             # Order management
│   │   ├── rentals.ts            # Rental tracking
│   │   ├── stock.ts              # Stock management
│   │   ├── whitelist.ts          # Whitelist upload/management
│   │   ├── leavers.ts            # Leavers processing
│   │   ├── storeManagers.ts      # Store manager management
│   │   ├── delivery.ts           # Delivery confirmation
│   │   └── payat.ts              # Pay@ reconciliation
│   ├── m2/
│   │   ├── bills.ts              # Bill ingestion + status
│   │   ├── extraction.ts         # Extraction results + review
│   │   ├── excel.ts              # Excel generation
│   │   ├── submission.ts         # Submission tracking
│   │   ├── stores.ts             # M2 store management
│   │   └── formats.ts            # Municipality format library
│   └── shared/
│       ├── admin.ts              # Admin user management
│       ├── logs.ts               # Audit log queries
│       ├── alerts.ts             # Alert management
│       ├── reports.ts            # Report generation
│       ├── files.ts              # File upload management
│       └── config.ts             # System config
├── services/
│   ├── auth/
│   │   ├── hashService.ts        # bcryptjs wrappers
│   │   └── jwtService.ts
│   ├── m1/
│   │   ├── batchService.ts       # Batch processing logic
│   │   ├── orderService.ts       # Order submission to suppliers
│   │   ├── smsService.ts         # OTP + notification SMS
│   │   └── reportService.ts
│   ├── m2/
│   │   ├── emailIngestService.ts # Email polling / webhook
│   │   ├── pdfParserService.ts   # pdf-parse + rule matching
│   │   ├── ocrService.ts         # Tesseract.js OCR
│   │   ├── aiExtractionService.ts# Claude API calls
│   │   ├── excelService.ts       # ExcelJS output generation
│   │   └── emailDeliveryService.ts
│   └── shared/
│       ├── auditService.ts       # Structured audit log writes
│       ├── alertService.ts       # Alert triggering + notification
│       └── emailService.ts       # Resend transactional email
├── jobs/                         # node-cron job definitions
│   ├── batchCutoff.ts
│   ├── weeklyReport.ts
│   ├── missingBillCheck.ts
│   ├── payatReconciliation.ts
│   └── dbPing.ts
├── schemas/                      # Zod validation schemas
└── utils/
```

---

## Key Architectural Decisions

### Decision 1: Single Application, Multiple Portals
Rather than building separate apps for employees, store managers, and admins, all three are served by the same Next.js application at different routes. Route-based code splitting means employees only download the employee portal bundle. Authentication middleware enforces role separation at the route level.

**Benefit:** One deployment, one codebase, shared components (buttons, forms, notifications), reduced maintenance burden.

### Decision 2: Custom JWT vs Supabase Auth
Two fundamentally different authentication models (employee number + ID number vs email + password) prevent the use of Supabase Auth's standard flows. A custom JWT service using bcryptjs gives full control while remaining lightweight.

**Benefit:** Supports both auth models from one endpoint. POPIA-compliant — no raw PII in the database or in JWTs.

### Decision 3: Backend on Railway, Not Vercel Serverless
Module 1 batch processing and Module 2 scheduled jobs require a persistent, always-on process. Vercel serverless functions have a maximum execution time (10 seconds on the Hobby plan, 60 seconds on Pro) that is insufficient for batch processing thousands of applications or OCR processing large PDFs.

**Benefit:** node-cron runs reliably on Railway. Long-running processes are not constrained by serverless timeouts.

### Decision 4: Shared Audit Log
A single `audit_logs` table covers all actions across both modules. It is filterable by `module` ('m1', 'm2', 'shared', 'auth'). Super Admin sees all. M1 Admin sees only m1 and auth. M2 Admin sees only m2 and auth.

**Benefit:** One place to understand everything that has happened in the system. POPIA audit trail covered.

### Decision 5: Supabase Storage for All Files
All uploaded files (HR files, PDFs, Excel outputs) are stored in Supabase Storage rather than the local filesystem. This means the Railway backend is stateless and can be redeployed without losing data.

**Benefit:** Data persists independently of the backend process lifecycle. File access is gated by Supabase storage policies.
