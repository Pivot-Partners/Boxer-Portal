# Boxer Operations Portal — Project Documentation

**Version:** 1.0  
**Date:** 2026-05-13  
**Status:** Pre-build — Documentation & Planning Phase  
**Project Type:** Stealth build on risk, targeting Boxer Stores (Pty) Ltd

---

## What This Is

The Boxer Operations Portal is a modular, owned platform that automates two high-volume manual operational processes at Boxer Stores. Phase 1 launches with two independent modules sharing one codebase, one authentication system, one database, and one admin dashboard.

- **Module 1 — Staff Phone Rental Scheme:** Replaces a Google Form and spreadsheet with a fully automated application, fulfilment, and rental tracking system for ~18,000 eligible Boxer employees.
- **Module 2 — Utility Bill Automation:** Replaces manual data capture across 550 stores with a hybrid PDF parser and AI extraction engine that processes, formats, and submits utility bills automatically.

The longer-term vision is to extend this platform to other large South African retailers and employers as a managed service, replacing manual document processing headcount at a cost demonstrably lower than the people it replaces.

---

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 01 | [Tech Stack](01-tech-stack.md) | Full technology choices, version targets, cost analysis, and free-tier limits |
| 02 | [System Architecture](02-system-architecture.md) | High-level architecture, component diagrams, data flow, and deployment topology |
| 03 | [Authentication & Roles](03-authentication-and-roles.md) | Unified auth design, user types, role definitions, access matrix, and login flows |
| 04 | [Data Model & ERD](04-data-model.md) | Complete entity relationship diagrams, table definitions, and field-level notes |
| 05 | [Module 1 — Phone Rental Spec](05-module1-phone-rental.md) | Full functional specification for the staff phone rental scheme |
| 06 | [Module 2 — Utility Bills Spec](06-module2-utility-bills.md) | Full functional specification for the utility bill automation pipeline |
| 07 | [Shared Platform Spec](07-shared-platform.md) | Authentication, admin dashboard, notifications, POPIA compliance, file uploads |
| 08 | [API Design](08-api-design.md) | REST API endpoint catalogue for all modules and shared services |
| 09 | [Deployment & Infrastructure](09-deployment.md) | Hosting setup, CI/CD pipeline, environment configuration, and scaling notes |
| 10 | [Open Items & Risk Register](10-open-items-risk-register.md) | Outstanding decisions, assumptions, blockers, and risk log |

---

## Key Facts at a Glance

| Item | Detail |
|------|--------|
| Total Boxer stores | ~550 |
| Total Boxer employees | ~34,000 |
| Module 1 eligible employees | ~18,000 |
| Module 1 active rentals to migrate | ~1,300 |
| Module 1 peak applications (December) | ~9,000 |
| Module 2 bills per month | 550 |
| Module 1 payroll cut-off | Night before the 10th of each month |
| Module 1 delivery target | 25th of each month |
| Phone catalogue | Samsung A05, A07, A17, A26 |
| Rental terms | 7 months or 13 months |
| Supplier chain | DNI Group → Teljoy → 3G → RAM (delivery) → WWAS (insurance) |
| Data residency | South Africa only (POPIA requirement) |

---

## Project Constraints

- **Budget:** Build on risk. All costs tracked for later commercial proposal. Infrastructure must be free or near-free.
- **Integration:** Standalone application with manual file imports. No live SAP/ERP integration in Phase 1.
- **Security:** All PII (employee number, ID number) hashed with bcryptjs before writing to database. No raw PI stored at any point.
- **Compliance:** POPIA impact assessment required before go-live. Data residency within South Africa is non-negotiable.
- **Team familiarity:** Stack is locked to the documented choices (Next.js, Fastify, Railway, Supabase). No deviations without agreement.
- **WhatsApp:** Phase 2 only.
- **Automated portal submission (M2):** Phase 2 only. Phase 1 emails output to internal Boxer contact.

---

## Project Owner

Single point of contact with final sign-off authority on scope, design decisions, and go-live.

---

## Build Phases

### Phase 1 (current scope)
- Module 1: Employee application flow → batch processing → downloadable approved applications list. Admin actions downstream manually.
- Module 2: Manual PDF upload → parsing → AI fallback → human review → Excel output → email to internal Boxer contact
- Shared: Unified auth, admin dashboard, audit logs, notifications, POPIA-compliant data handling
- Hosting: Development team infrastructure (Railway + Vercel + Supabase free tiers)

### Phase 2 (post-Boxer approval)
- Module 1: Automated supplier submission (Teljoy, 3G, WWAS order files)
- Module 1: Leavers workflow and Pay@ reconciliation
- Module 1: WhatsApp application channel
- Module 2: Automated email ingestion from central inbox
- Module 2: Browser agent submits directly to service provider portal
- Possible: Migration to Boxer AWS infrastructure
- Possible: Extension to other document types (rates bills, refuse invoices)

---

## Confirmed Build Decisions

| Decision | Confirmed |
|----------|-----------|
| Repository structure | Monorepo (frontend/ + backend/ in one repo) |
| Language | TypeScript throughout |
| Code style | Tabs + semicolons, enforced with Prettier |
| Testing approach | Manual testing for Phase 1 |
| Supabase region | af-south-1 (Cape Town) — must be selected at project creation |
| Module 2 ingestion (Phase 1) | Manual PDF upload via admin dashboard |
| Module 1 output | Downloadable approved applications list (Excel). No automated supplier submission in Phase 1. |
| Whitelist ownership | HR provides pre-filtered list (eligible employees without active contracts). System trusts list completely. |
| T&Cs content | Dummy content for Phase 1, updated before go-live |
| CLAUDE.md | To be created as first file when build starts |

---

## How to Use This Documentation

These documents are designed to serve two purposes simultaneously:

1. **Stakeholder presentation material** — each document stands alone as a professional deliverable that explains the what, why, and how.
2. **Developer reference** — every decision, constraint, data structure, and workflow is captured here so development can begin directly from these specs without re-reading the source documents.

When in doubt about intent or scope, the source documents in `/docs` are the authoritative business source. This documentation layer is the technical translation of those requirements.
