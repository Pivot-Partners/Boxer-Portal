# 10 — Open Items & Risk Register

**Version:** 1.0  
**Date:** 2026-05-13

---

## How to Use This Document

This document tracks all outstanding decisions, unknowns, and risks that must be resolved before the affected components can be built or deployed. It is a living document — items should be updated with their resolution as they are confirmed.

**Priority definitions:**
- **BLOCKER:** Cannot begin building the affected component until resolved.
- **HIGH:** Affects a core workflow. Should be resolved in pre-build scoping.
- **MEDIUM:** Affects secondary functionality. Can be resolved during the build.
- **LOW:** Enhancement or edge case. Can be resolved before go-live.

---

## Module 1 — Open Items

### M1-001 — Order Submission Formats (Teljoy, 3G, WWAS)

| Field | Detail |
|-------|--------|
| Priority | ~~BLOCKER~~ DEFERRED |
| Component | Phase 2 — automated supplier submission |
| Description | Automated order file submission to Teljoy, 3G, and WWAS is out of scope for Phase 1. Phase 1 produces a downloadable approved applications list only. Admin actions submission manually. Supplier formats need to be confirmed before Phase 2 automated submission is built. |
| Action required | Confirm supplier file formats before Phase 2 begins. No action required for Phase 1. |
| Owner | Project owner |
| Status | DEFERRED (Phase 2) |

---

### M1-002 — Pay@ Reconciliation Data Format

| Field | Detail |
|-------|--------|
| Priority | ~~BLOCKER~~ DEFERRED |
| Component | Phase 2 — leavers and Pay@ reconciliation |
| Description | Pay@ reconciliation is out of scope for Phase 1. The system does not track ongoing rental contracts in Phase 1. Leavers workflow and payment reconciliation will be scoped for Phase 2 after stakeholder confirmation of rental tracking requirements. |
| Action required | Scoping session with Pay@ before Phase 2 begins. No action required for Phase 1. |
| Owner | Project owner |
| Status | DEFERRED (Phase 2) |

---

### M1-003 — Google Form Field List

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | Application form (section 1.4) |
| Description | The current Google Form fields need to be confirmed so the application form in the new system replicates them accurately. The form also serves as the contract record alongside the T&Cs. |
| Action required | Project owner to share the current Google Form or a screenshot of its fields. |
| Owner | Project owner |
| Status | OPEN |

---

### M1-004 — T&Cs Document

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | Application form, rental dashboard |
| Description | The legally vetted T&Cs document needs to be provided so it can be linked from the application form and employee dashboard. This document forms part of the digital contract record. |
| Action required | Project owner to provide the T&Cs document (or its final URL). |
| Owner | Project owner |
| Status | OPEN |

---

### M1-005 — WWAS Insurance Claim Process

| Field | Detail |
|-------|--------|
| Priority | MEDIUM |
| Component | Employee landing page, insurance claims section |
| Description | The steps an employee must follow to lodge a claim with WWAS, the contact details required, and whether the system needs to log claims or whether WWAS handles that entirely are not yet documented. |
| Action required | Project owner to obtain WWAS claim process documentation and confirm the scope of system involvement. |
| Owner | Project owner |
| Status | OPEN |

---

### M1-006 — Leavers Communication Process

| Field | Detail |
|-------|--------|
| Priority | MEDIUM |
| Component | Leavers workflow (section 1.8) |
| Description | The exact communication templates and process for employees who leave mid-rental are still being finalised. This includes the exact wording for the SMS/email, the Teljoy notification format, and any conditions around what happens to the rental if a phone is not returned or is written off. |
| Action required | Project owner to provide final communication templates and leavers process documentation. |
| Owner | Project owner |
| Status | OPEN |

---

### M1-007 — Teljoy R14 Monthly Fee Assessment

| Field | Detail |
|-------|--------|
| Priority | LOW |
| Component | Order management, commercial model |
| Description | Teljoy charges a R14/month administration fee per active phone. At 1,300 active rentals this is R18,200/month. The project owner noted this should be reviewed to assess whether automation can reduce or eliminate it. |
| Action required | Project owner to raise with Teljoy/DNI Group. Development team to assess what submission format changes would be needed to reduce admin overhead. |
| Owner | Project owner |
| Status | OPEN |

---

### M1-008 — Contract Cancellation Option Placement

| Field | Detail |
|-------|--------|
| Priority | LOW |
| Component | Employee landing page |
| Description | Final decision needed on whether the contract cancellation option appears as a primary option on the landing page or as a secondary/less prominent link. The project owner suggested it may be better placed less prominently. |
| Action required | Project owner to make a final decision on UX placement. |
| Owner | Project owner |
| Status | OPEN |

---

### M1-009 — Pilot Data for Migration

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | Data migration (section 1.13) |
| Description | The existing Google Form responses and Excel processing file need to be provided for the development team to map fields and build the migration script. |
| Action required | Project owner to share the existing Google Form response export and Excel processing file. |
| Owner | Project owner |
| Status | OPEN |

---

### M1-010 — Salary Band Mapping to Phone Models

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | Phone catalogue, application form eligibility |
| Description | The exact mapping between salary bands and eligible phone models (from the existing Excel sheet) needs to be confirmed so it can be seeded into the phone_models table. |
| Action required | Project owner to provide the Excel sheet containing salary band → phone entitlement mapping and full pricing (retail price, 7-month rental, 13-month rental per model). |
| Owner | Project owner |
| Status | OPEN |

---

### M1-011 — Store Manager Monthly File Format

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | Store manager authentication, upload processing |
| Description | The format of the monthly Store Admin Manager details file needs to be confirmed. Required fields: employee number, ID number, store code, store name, email address. |
| Action required | Project owner to provide a sample file (anonymised). |
| Owner | Project owner |
| Status | OPEN |

---

### M1-012 — WhatsApp Staff Support Group

| Field | Detail |
|-------|--------|
| Priority | LOW |
| Component | Phase 2 planning |
| Description | The informal staff WhatsApp support group may benefit from AI automation. Whether to apply AI to it, and in what phase, is a decision that has not been made. |
| Action required | Decision to be made once Phase 1 is stable. |
| Owner | Project owner |
| Status | DEFERRED (Phase 2) |

---

## Module 2 — Open Items

### M2-001 — Bill Ingestion Method (Central Inbox vs Per-Store)

| Field | Detail |
|-------|--------|
| Priority | ~~BLOCKER~~ DEFERRED |
| Component | Phase 2 — automated email ingestion |
| Description | Phase 1 uses manual PDF uploads — no inbox monitoring required. The central vs per-store inbox question only matters when automated ingestion is built in Phase 2. |
| Action required | Confirm inbox method before Phase 2 ingestion is built. No action required for Phase 1. |
| Owner | Project owner |
| Status | DEFERRED (Phase 2) |

---

### M2-002 — Sample Utility Bills

| Field | Detail |
|-------|--------|
| Priority | BLOCKER |
| Component | PDF parser, municipality format library |
| Description | Sample bills covering as many municipality formats as possible are required before the parser can be built. Without samples, no parsing rules can be written. Aim for 2–3 months of history per format where available. |
| Action required | Project owner to gather sample bills from Boxer or the service provider. |
| Owner | Project owner |
| Status | OPEN |

---

### M2-003 — Excel Submission Template

| Field | Detail |
|-------|--------|
| Priority | BLOCKER |
| Component | Excel output generation (section 2.6) |
| Description | The Excel template used for submission to the service provider must be provided before the Excel generation logic can be built. Also requires confirmation of the file naming convention and whether output is per store or consolidated. |
| Action required | Project owner to obtain the Excel template and a video/recording of the current manual submission process from the internal Boxer contact. |
| Owner | Project owner |
| Status | OPEN |

---

### M2-004 — Number of Distinct Municipality Formats

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | Municipality format library, build estimation |
| Description | The number of distinct municipality bill formats across 550 stores determines the build effort for the parser. 10 formats is a very different build to 200. Even a rough estimate is useful for scoping. |
| Action required | Project owner to ask Boxer or the service provider for an estimate of the number of distinct municipality billing formats. |
| Owner | Project owner |
| Status | OPEN |

---

### M2-005 — Service Provider Portal Review

| Field | Detail |
|-------|--------|
| Priority | HIGH (Phase 2 scope) |
| Component | Browser agent submission (Phase 2) |
| Description | The service provider portal must be reviewed before Phase 2 browser agent submission can be scoped. Key unknowns: CAPTCHA, two-factor authentication, session timeouts, field validation behaviour. |
| Action required | Project owner to request portal access or a screen recording of the submission process from the internal Boxer contact. |
| Owner | Project owner |
| Status | DEFERRED (Phase 2 pre-build) |

---

### M2-006 — Scanned vs Digital Bills

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | OCR preprocessing, pipeline design |
| Description | Whether any utility bills arrive as scanned images rather than digital PDFs affects whether Tesseract.js OCR is a core path or a rare edge case. |
| Action required | Project owner to confirm with Boxer or the service provider. |
| Owner | Project owner |
| Status | OPEN |

---

### M2-007 — Field List — Electricity vs Water

| Field | Detail |
|-------|--------|
| Priority | MEDIUM |
| Component | bill_extractions table, Excel template mapping |
| Description | Whether the required field list differs between electricity and water bills needs to be confirmed. If different, separate extraction schemas and possibly separate Excel templates are needed. |
| Action required | Project owner to confirm scope (electricity only? water also? combined?) with Boxer. |
| Owner | Project owner |
| Status | OPEN |

---

### M2-008 — Excel per Store or Consolidated

| Field | Detail |
|-------|--------|
| Priority | MEDIUM |
| Component | Excel generation, email delivery |
| Description | Whether each store's bill produces a separate Excel file or whether bills are consolidated into a single file is a business decision that affects the Excel generation and email delivery logic. |
| Action required | Project owner to confirm once the current output format is shared. |
| Owner | Project owner |
| Status | OPEN |

---

### M2-009 — Existing Document Management System

| Field | Detail |
|-------|--------|
| Priority | LOW |
| Component | File storage, audit trail |
| Description | Whether an existing document management system is in place for processed bills affects whether Supabase Storage is sufficient or whether an integration is needed. |
| Action required | Project owner to confirm with Boxer. |
| Owner | Project owner |
| Status | OPEN |

---

## Shared Platform — Open Items

### SP-001 — POPIA Impact Assessment

| Field | Detail |
|-------|--------|
| Priority | BLOCKER (for go-live) |
| Component | Go-live approval |
| Description | A formal POPIA impact assessment must be completed before go-live. This is a legal requirement given the personal data being stored. The development team provides documentation of data flows. The project owner is responsible for commissioning and signing off the assessment. |
| Action required | Project owner to identify who is responsible for commissioning the assessment and initiate it. Recommend starting early — it takes time to complete formally. |
| Owner | Project owner |
| Status | OPEN |

---

### SP-002 — Nominated VAS/HR Data Owner

| Field | Detail |
|-------|--------|
| Priority | HIGH |
| Component | Ongoing operations — file uploads, whitelist management |
| Description | The person in VAS or HR who will be responsible for uploading the monthly files (whitelist, leavers, store managers) on an ongoing basis after go-live has not been named. |
| Action required | Project owner to confirm the nominated person. They will be set up as an M1 Admin user. |
| Owner | Project owner |
| Status | OPEN |

---

### SP-003 — Phase 1 vs Phase 2 Boundary for Employee Support

| Field | Detail |
|-------|--------|
| Priority | MEDIUM |
| Component | Employee self-service, support |
| Description | Whether any employee self-service or support capability is included in Phase 1 (to strengthen the Boxer presentation) or entirely deferred to Phase 2 has not been agreed. |
| Action required | Decision to be made by the team before Phase 1 feature freeze. |
| Owner | Project owner + development team |
| Status | OPEN |

---

### SP-004 — Formal Boxer Presentation Timeline

| Field | Detail |
|-------|--------|
| Priority | MEDIUM |
| Component | Project planning |
| Description | The timeline for completing Phase 1 testing and moving to a formal presentation to Boxer has not been agreed. |
| Action required | Project owner and development team to agree on a target test-completion date and presentation date. |
| Owner | Project owner |
| Status | OPEN |

---

### SP-005 — Domain Registration

| Field | Detail |
|-------|--------|
| Priority | MEDIUM |
| Component | Deployment |
| Description | The domain for the platform (`boxer-portal.co.za` or similar) needs to be registered or provided. |
| Action required | Project owner to confirm the intended domain. Development team can register it if needed. |
| Owner | Project owner / development team |
| Status | OPEN |

---

## Risk Register

### RISK-001 — Supabase Free Tier Pause

| Field | Detail |
|-------|--------|
| Likelihood | Medium |
| Impact | Critical — database becomes unavailable |
| Description | Supabase free tier projects are paused after 1 week of inactivity. During the stealth build phase (low traffic), this could cause unexpected downtime. |
| Mitigation | Backend includes a scheduled `dbPing` job that queries the database every 3 days, preventing the inactivity pause. If this proves unreliable, upgrade to Supabase Pro ($25/month) once revenue is confirmed. |

---

### RISK-002 — Railway Cost Overrun

| Field | Detail |
|-------|--------|
| Likelihood | Low |
| Impact | Low — ~$10–20/month if Hobby credit exceeded |
| Description | Railway Hobby provides $5/month in credits. If December peak traffic causes the backend to exceed this, the cost increases. |
| Mitigation | Monitor Railway usage metrics. Optimise scheduled jobs to not run during low-value periods. Upgrade to Railway Pro ($20/month) if consistently exceeded. |

---

### RISK-003 — bcrypt Login Latency

| Field | Detail |
|-------|--------|
| Likelihood | High (by design) |
| Impact | Medium — 300–500ms login time |
| Description | bcrypt comparison is computationally expensive. With two fields being compared, login takes 300–500ms per attempt. At peak (December), many simultaneous logins could create queue pressure on the Railway backend. |
| Mitigation | This is a security feature, not a bug. Acceptable for the use case. If Railway shows CPU pressure, increase Railway plan resources or implement a connection queue. Do not reduce bcrypt cost factor below 12. |

---

### RISK-004 — Whitelist Quality Issues

| Field | Detail |
|-------|--------|
| Likelihood | Low (data confirmed as complete and reliable) |
| Impact | High — employees incorrectly blocked or allowed |
| Description | The data is described as "complete and reliable" but discrepancies (e.g. ID number format inconsistencies, duplicate records) in the source data could cause valid employees to fail validation. |
| Mitigation | Implement detailed error reporting on whitelist upload that flags any records with unexpected patterns. Build a manual override mechanism that allows M1 Admin to validate an employee case-by-case if they contact HR. |

---

### RISK-005 — Municipality Bill Format Changes

| Field | Detail |
|-------|--------|
| Likelihood | Medium — municipalities periodically update their billing systems |
| Impact | Medium — extraction fails for affected municipality until format is updated |
| Description | A municipality changes their bill layout, breaking the existing parsing rules for that format. |
| Mitigation | The AI fallback layer handles this automatically — when the parser fails on a known format, Claude extracts the fields and flags for human review. M2 Admin is alerted and can update the parsing rules. The system never blocks entirely due to a format change — it degrades gracefully to AI-assisted extraction. |

---

### RISK-006 — Boxer Refuses to Buy Post-Build

| Field | Detail |
|-------|--------|
| Likelihood | Medium |
| Impact | High — significant development investment at risk |
| Description | The build is on risk. Boxer may not accept the platform or may request changes that significantly increase scope before agreeing to a commercial arrangement. |
| Mitigation | The platform is designed to be sellable to other large South African retailers and employers beyond Boxer. If Boxer declines, the same system can be offered to Pick n Pay, Shoprite, or other large employers facing the same operational challenges. Track all development time and costs from day one so the minimum viable commercial proposal is understood. |

---

### RISK-007 — POPIA Compliance Gap

| Field | Detail |
|-------|--------|
| Likelihood | Low (mitigations are well-designed) |
| Impact | Critical — regulatory and reputational risk |
| Description | The system stores Boxer employee personal data. Any breach, non-compliance, or inadequate impact assessment could expose the project owner and Boxer to regulatory action under POPIA. |
| Mitigation | bcrypt hashing of all PII before database writes is a strong technical control. POPIA impact assessment before go-live is a non-negotiable requirement. Do not go live without it. Follow the data residency requirement strictly (South Africa only). |

---

### RISK-008 — SMS Provider Reliability

| Field | Detail |
|-------|--------|
| Likelihood | Low |
| Impact | High for OTP flow — employee cannot complete application |
| Description | If the SMS provider is unavailable during peak application periods, OTP delivery fails and employees cannot complete their application. |
| Mitigation | Implement retry logic on OTP send (retry after 30 seconds if no delivery confirmation). Configure a secondary SMS provider as a fallback. Log all SMS delivery failures as critical alerts. |

---

### RISK-009 — Data Migration Errors

| Field | Detail |
|-------|--------|
| Likelihood | Medium — depends on pilot data quality |
| Impact | High — incorrect rental records could cause incorrect payroll deductions |
| Description | Migrating 1,300 active rental records from Google Sheets to the new system carries risk of incorrect field mapping, duplicate records, or missing records. |
| Mitigation | Run migration in staging first. Generate a full reconciliation report showing every migrated record against the source. Project owner must sign off on the report before production migration runs. Double-check payment counts (payments_made + payments_remaining = term_months). |
