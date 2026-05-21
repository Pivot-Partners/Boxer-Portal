# 07 — Shared Platform

**Version:** 1.0  
**Date:** 2026-05-13

---

## Overview

The shared platform covers all components that are used by both modules: authentication (already covered in detail in [Document 03](03-authentication-and-roles.md)), the unified admin dashboard, audit logging, notifications, POPIA compliance, file upload management, and the Progressive Web App setup for the employee-facing portal.

---

## 7.1 Unified Admin Dashboard

### Design Philosophy
The admin dashboard is one application with role-aware rendering. A Super Admin sees everything. An M1 Admin sees only Module 1 and their own activity. An M2 Admin sees only Module 2 and their own activity.

The dashboard does not require separate deployments or separate URLs for different admin roles. Role-based routing is handled at the Next.js middleware layer.

### Navigation Structure

The sidebar renders conditionally based on the JWT role claim:

```
Super Admin
├── Dashboard (combined overview)
├── Module 1
│   ├── Overview
│   ├── Applications
│   ├── Batch Processing
│   ├── Orders
│   ├── Rentals
│   ├── Stock Management
│   ├── Leavers
│   ├── Whitelist
│   ├── Store Managers
│   └── Reports
├── Module 2
│   ├── Overview
│   ├── Bills
│   ├── Review Queue
│   ├── Stores
│   ├── Municipality Formats
│   └── Reports
└── System
    ├── Audit Logs
    ├── Users
    ├── Alerts
    └── Configuration

M1 Admin
├── Dashboard (Module 1 overview)
├── Module 1 (all sections above)
└── Audit Logs (M1 events only)

M2 Admin
├── Dashboard (Module 2 overview)
├── Module 2 (all sections above)
└── Audit Logs (M2 events only)
```

### Combined Overview (Super Admin)
The Super Admin dashboard home shows a single page with:

**Module 1 widgets:**
- Applications received this cycle (vs last cycle)
- Applications pending / validated / cancelled
- Stock status by model (on hand vs reserved)
- Orders raised this cycle
- Active rentals total
- Leavers this month
- Pay@ reconciliation status

**Module 2 widgets:**
- Bills received this month (vs total expected)
- Bills in review queue
- Bills processed and emailed today
- Municipality format coverage (% of 550 stores covered)
- Unresolved alerts

**System widgets (Super Admin only):**
- Active admin user sessions
- Platform health (Railway API status, Supabase status)
- Recent audit log entries (last 10)
- Unacknowledged alerts (all modules)

---

## 7.2 Unified Audit Log

### Purpose
Every action taken in the system — by an employee, a store manager, an admin, or the system itself — is recorded in the `audit_logs` table. This is the single source of truth for what happened, when, who did it, and what changed.

### Log Entry Structure
Every log entry captures:
- `module`: 'm1', 'm2', 'shared', or 'auth'
- `action`: dot-notation string (e.g. `application.submitted`, `batch.approved`, `bill.extraction_approved`)
- `entity_type` + `entity_id`: what record was affected
- `actor_type` + `actor_id`: who did it (user_id, employee_number_hash, or 'system' for cron jobs)
- `ip_address`: client IP
- `details`: jsonb with action-specific context (e.g. previous status, new status, field values changed)
- `created_at`: timestamp

### Standard Actions Logged

**Authentication:**
- `auth.login_success` — employee, store_manager, admin
- `auth.login_failure` — invalid credentials
- `auth.logout`
- `auth.otp_sent`, `auth.otp_verified`, `auth.otp_failed`, `auth.otp_expired`
- `auth.account_locked`
- `auth.password_changed`

**Module 1:**
- `application.submitted`
- `application.superseded`
- `application.cancelled_by_employee`
- `application.cancelled_no_whitelist`
- `application.cancelled_no_stock`
- `application.validated`
- `application.converted_to_order`
- `batch.closed`
- `batch.processing_started`
- `batch.summary_generated`
- `batch.approved`
- `order.created`
- `order.submitted_to_teljoy`
- `order.submitted_to_3g`
- `order.submitted_to_wwas`
- `order.sms_sent`
- `order.store_notification_sent`
- `delivery.received_from_courier`
- `delivery.handed_to_employee`
- `rental.created`
- `rental.leaver_flagged`
- `rental.leaver_notified`
- `rental.teljoy_notified`
- `rental.payment_received`
- `rental.completed`
- `whitelist.uploaded`
- `leavers.uploaded`
- `stock.updated`

**Module 2:**
- `bill.received`
- `bill.flagged_unrecognised`
- `bill.parsing_started`
- `bill.parsed_success`
- `bill.parsed_failed`
- `bill.ocr_applied`
- `bill.ai_extraction_requested`
- `bill.ai_extraction_completed`
- `bill.review_approved`
- `bill.review_rejected`
- `bill.excel_generated`
- `bill.emailed`
- `bill.submitted`
- `bill.submission_failed`
- `store.added`
- `store.deactivated`
- `format.added`
- `format.updated`

**Shared:**
- `file.uploaded`
- `file.processing_started`
- `file.processing_completed`
- `file.processing_failed`
- `user.created`
- `user.updated`
- `user.deactivated`
- `config.updated`
- `alert.triggered`
- `alert.acknowledged`
- `alert.resolved`
- `report.generated`

### Audit Log UI
Available to all admin roles (filtered by module for M1/M2 admins, full view for Super Admin):

- Table view with columns: timestamp, module, action, entity, actor, IP address
- Filters: module, action type, date range, actor, entity ID
- Click any row to see full `details` jsonb in a readable panel
- Export to CSV (for compliance/audit purposes)
- Non-editable. Logs cannot be modified or deleted via the UI.

---

## 7.3 Notifications and Alerts System

### Two-Layer System
1. **Notifications:** Outbound communications to end users (employees, store managers) via SMS and email. These are business-process communications (OTP, confirmation, leaver notice, store delivery notice).
2. **System Alerts:** Internal operational alerts to admin users when something needs attention or has gone wrong.

### System Alerts

**Alert Types and Defaults:**

| alert_type | module | severity | Default Trigger | Notify |
|------------ |--------|----------|----------------|--------|
| `stock_low` | m1 | warning | Stock available ≤ 20% of on_hand for any model | M1 Admin |
| `stock_exhausted` | m1 | critical | Stock available = 0 for any model with open applications | M1 Admin |
| `batch_processing_failed` | m1 | critical | Batch cron job errors | Super Admin |
| `order_submission_failed` | m1 | critical | Failed to submit to Teljoy/3G/WWAS | M1 Admin |
| `payroll_file_not_generated` | m1 | critical | Payroll file not generated by 08:00 on the 10th | M1 Admin, Super Admin |
| `leaver_in_arrears` | m1 | warning | Leaver with no Pay@ payment within expected window | M1 Admin |
| `payat_data_not_received` | m1 | warning | Pay@ data not received within expected window | M1 Admin |
| `bill_missing` | m2 | warning | No bill received for an active store within N days | M2 Admin |
| `bill_unrecognised_account` | m2 | info | Bill from account not in store list | M2 Admin |
| `bill_extraction_failed` | m2 | warning | Bill could not be parsed | M2 Admin |
| `bill_low_ocr_confidence` | m2 | warning | OCR confidence below threshold | M2 Admin |
| `submission_failed` | m2 | critical | Submission to service provider failed after retry | M2 Admin |
| `review_queue_large` | m2 | info | More than N bills in review queue | M2 Admin |
| `ai_cost_threshold` | m2 | warning | Monthly AI cost exceeds configured threshold | Super Admin |
| `admin_login_failed_max` | auth | critical | Admin account locked after max attempts | Super Admin |
| `file_upload_failed` | shared | warning | Any file upload fails processing | M1/M2 Admin |
| `expected_file_not_uploaded` | shared | warning | Monthly file not uploaded by deadline | M1/M2 Admin |

### Alert Delivery
- Alerts are created in `system_alerts` table immediately when triggered.
- Admin dashboard shows unacknowledged alerts with count badge in the navigation.
- Email notification sent to configured recipients for warning and critical alerts.
- Alert email recipients are configured per alert type in the system config screen.

### Alert Lifecycle
1. `triggered_at`: alert created.
2. Admin acknowledges: `acknowledged_at`, `acknowledged_by` set. Alert moves from "active" to "acknowledged" state.
3. Admin resolves: `resolved_at`, `resolved_by` set. Or `auto_resolved = true` if the system detects the condition has cleared.

### Notification Templates
All outbound SMS and email notifications use predefined templates. Template content is managed via the system config (or a simple templates table). Templates are approved by the project owner before go-live.

**Module 1 SMS templates:**
- OTP: "Your Boxer Staff Phone Rental verification code is [OTP]. Valid for [N] minutes."
- Application confirmed: "Hi [NAME], your phone rental application (Ref: [REF]) for a [PHONE_MODEL] has been received. We will confirm your order on the 10th."
- Order confirmed: "Hi [NAME], your [PHONE_MODEL] order has been placed. Your phone will be delivered to [STORE_NAME] by the 25th."
- Leaver notification: "Hi [NAME], your Boxer phone rental continues after leaving Boxer. Monthly payment has increased to R[AMOUNT]. Please pay via Pay@ at any till. Contact Teljoy on [NUMBER] for help."

**Module 1 Email templates:**
- Store manager order notification (HTML email listing all phones for their store + steps to take on receipt)
- Leaver email (full details, Pay@ instructions, Teljoy contact)
- Batch summary (to M1 Admin recipients)
- Weekly report (to configured recipients)

**Module 2 Email templates:**
- Excel delivery (to internal Boxer contact with attachment)
- Missing bill alert (to M2 Admin)
- Monthly checklist report (to configured recipients)

---

## 7.4 File Upload Management

### Supported Upload Types

| Module | Upload Type | Source | Frequency | Format |
|--------|------------|--------|-----------|--------|
| M1 | Whitelist | HR | Monthly | Excel (.xlsx) |
| M1 | Leavers | HR | Monthly | Excel (.xlsx) |
| M1 | Store Managers | Business | Monthly | Excel (.xlsx) |
| M1 | Stock Update | Project owner | Monthly / ad-hoc | Excel (.xlsx) or CSV |
| M1 | Phone Catalogue | Project owner | As needed | Excel (.xlsx) |
| M2 | None (bills arrive via email) | — | — | — |

### Upload Process
1. Admin navigates to the relevant upload screen.
2. Admin selects or drags a file.
3. Frontend sends file to `POST /files/upload` (multipart form).
4. Backend validates:
   - File format (MIME type must match expected type)
   - File size (max 10MB for Excel files)
   - Required column headers present
5. If validation fails: return error immediately (do not store file).
6. If validation passes:
   - Upload file to Supabase Storage.
   - Create `file_uploads` record with `status = 'uploaded'`.
   - Begin async processing (whitelist parsing, hashing, record insertion).
   - Return to admin with a "processing" status indicator.
7. When processing completes: update `file_uploads` record with counts and status.
8. Notify admin via UI update (polling or WebSocket) and email if processing fails.

### Upload History
Every upload type has a history screen showing:
- File name, upload date, uploaded by, record counts, status
- Downloadable copy of the original file
- Error summary if processing failed

### Expected File Deadlines (Configurable)
Alerts fire if these files have not been uploaded by the configured deadline:

| Upload Type | Expected By | Alert Days Before Cutoff |
|------------|------------|--------------------------|
| Whitelist | 1st of month | Alert on 5th if not uploaded |
| Leavers | 1st of month | Alert on 5th if not uploaded |
| Store Managers | 1st of month | Alert on 5th if not uploaded |
| Stock Update | 5th of month | Alert on 8th if not uploaded |

---

## 7.5 POPIA Compliance

### Data Handling Principles

1. **Hash-first:** Employee number and ID number are hashed with bcryptjs (cost factor 12) before any database write. The raw values exist only in memory during the validation step and are immediately discarded.

2. **Minimum necessary data:** Only data required for the system to function is stored. The system does not store raw salary information, bank account numbers, or any financial data beyond rental amounts.

3. **Display name only:** The employee's display name (first + last name) is stored in plaintext because the application form requires it for identity confirmation. This is the minimum necessary for that purpose.

4. **Data residency:** All data is stored within South Africa. Railway (Johannesburg region) and Supabase (whichever South African region is available, or nearest — confirm at setup) are required. Do not use US or EU data centres.

5. **Retention:** Personal data is retained for a configurable period (default: 5 years = 1,825 days, per `data_retention_days` config key). A scheduled job flags records for review or deletion when retention period expires.

6. **Deletion on request:** Super Admin can delete a specific employee's personal data via the admin dashboard. This sets `display_name = '[DELETED]'` and replaces `employee_number_hash` and `id_number_hash` with a deletion marker. Rental financial records are retained (stripped of personal identifiers) for financial audit purposes.

7. **Privacy policy reference:** The Boxer privacy policy URL is displayed on all employee-facing pages (landing page, application form, dashboard).

8. **No third-party sharing of raw PII:** Order files sent to Teljoy, 3G, and WWAS contain the employee name and store details (required for fulfilment) but do not include ID numbers. The minimum information needed for order fulfilment.

### POPIA Impact Assessment
A formal POPIA impact assessment must be completed before go-live. This is a business-level requirement, not a development task. The development team provides documentation of data flows and storage methods. The project owner is responsible for commissioning and signing off the assessment.

### Audit Log Retention for POPIA
The `audit_logs` table records every personal data access event including who accessed it. This satisfies the requirement to maintain an audit trail of personal data processing.

---

## 7.6 Progressive Web App (PWA)

The employee-facing portal is built as a Progressive Web App to meet the following requirements:

- Installable on any Android device without the Google Play Store.
- Works on low-end Android devices (targeting Android 8+, 1GB RAM).
- Responsive layout optimised for screens as small as 320px wide.
- Works offline for page display (shows cached content). Active form submission requires connectivity.
- Accessible from a store computer desktop browser without installation.

### PWA Implementation
Using `next-pwa` with Next.js:
- `manifest.json`: app name, icons (Boxer branding), theme colour, display mode (standalone).
- Service worker: caches key assets (fonts, images, CSS). Network-first strategy for API calls.
- Install prompt: shown on the landing page for mobile users who have not installed.
- Offline page: shown when network is unavailable, with a message to retry when connected.

### Performance Targets
- First Contentful Paint < 3 seconds on a 3G connection.
- Application form fully interactive within 5 seconds on a mid-range Android device.
- Total page weight (compressed): < 200KB for the application form route.

---

## 7.7 System Configuration Screen (Super Admin)

All configurable system parameters are managed via the System Configuration screen. Values are stored in `system_config` and read by the backend at runtime (cached in memory, refreshed every 5 minutes).

**Sections:**
1. **Batch Settings** — Cut-off day/hour, batch approval timeout.
2. **OTP Settings** — Expiry minutes, max attempts, max resend.
3. **Session Settings** — Token expiry by role.
4. **Stock Alerts** — Warning threshold percentage.
5. **Bill Processing** — Missing bill days, processing SLA hours, OCR confidence threshold, AI auto-approve toggle.
6. **Report Recipients** — Email addresses for each report type (per module).
7. **Alert Recipients** — Email addresses for each alert type.
8. **Notification Templates** — Preview and edit SMS and email template content.
9. **Data Retention** — Retention days setting.
10. **Monthly Deadlines** — Expected upload dates for each HR file type.

All config changes are logged in `audit_logs` with the previous and new value.

---

## 7.8 Admin User Management (Super Admin Only)

### Create Admin User
- Super Admin enters: full name, email, role (m1_admin / m2_admin / super_admin).
- System generates a temporary password and emails the new user a setup link.
- New user must change their password on first login.
- Event logged: `user.created`.

### Edit Admin User
- Update name, email, or role.
- Cannot self-edit role (to prevent accidental self-demotion).
- Event logged: `user.updated`.

### Deactivate Admin User
- Sets `users.is_active = false`.
- All active sessions for that user are revoked immediately.
- Account cannot be used to log in until reactivated.
- Event logged: `user.deactivated`.

### Password Reset
- Super Admin can trigger a password reset email for any admin user.
- User receives a time-limited reset link (1 hour expiry).

---

## 7.9 Infrastructure Health (Super Admin Only)

A simple health monitoring panel on the Super Admin dashboard:

- **Railway API:** Status indicator (online / degraded / offline) — checked via a `/health` endpoint ping.
- **Supabase:** Database connection status.
- **Resend:** Last email delivery status.
- **SMS Provider:** Last SMS delivery status.
- **Anthropic API:** Last AI extraction status and monthly token usage.
- **Scheduled Jobs:** Last run time and status for each cron job.

This is a lightweight status board, not a full monitoring system. It relies on the most recent records in the relevant log tables to determine status.
