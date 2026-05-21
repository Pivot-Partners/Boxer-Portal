# 05 — Module 1: Staff Phone Rental Scheme

**Version:** 1.1  
**Date:** 2026-05-13  
**Updated:** 2026-05-13 — Simplified Phase 1 output model; whitelist pre-filtering clarification

---

## Purpose

Module 1 replaces a manual Google Form and spreadsheet process with a fully automated application and batch processing system for Boxer's staff phone rental scheme. It covers the employee application journey, batch validation, and produces a downloadable approved applications list for admin to action downstream.

> **Phase 1 scope note:** The system produces a downloadable approved applications list. Admin takes this list and actions it manually — submitting to suppliers (Teljoy, 3G, WWAS), sending to HR for payroll, etc. Automated order file submission and payroll deductions file generation are out of scope for Phase 1.

---

## Business Rules

These rules are non-negotiable and must be enforced by the system at every relevant point:

1. An employee must appear on the current whitelist to proceed with any application.
2. Employees are validated by employee number + ID number combination only. Name is not used as a validation check.
3. The whitelist is pre-filtered by HR — it contains only employees who are eligible AND do not have an active contract. The system trusts the whitelist completely and does not perform a secondary active-contract check.
4. An employee can submit multiple applications in a single batch cycle. Only the most recent (by timestamp) is retained; all prior applications are automatically superseded.
5. Only phones within the employee's salary band entitlement are displayed. All others are hidden.
6. Applications are accepted until the batch cut-off: 23:00 on the 9th of each month (configurable).
7. Post cut-off cancellations are subject to T&C conditions and are not self-service.
8. The approved applications list is only generated after an admin has reviewed and approved the batch summary.
9. Stock is managed internally. If stock is insufficient, the most recently submitted applications are cancelled first (by submitted_at timestamp, oldest retained).
10. Eligibility rules (salary band, active contract exclusion, 25% payroll cap) are owned and enforced by HR in the whitelist. The system does not re-enforce them independently.
11. Contact details captured at application time supersede the contact number held in the HR system.
12. If no whitelist is uploaded by the configured deadline, admin is notified via alert and the dashboard shows a clear missing-whitelist indicator.

---

## 1.1 Whitelist Management

### Purpose
The whitelist is the single source of truth for employee eligibility. It is provided by HR monthly and replaces the previous version entirely on each upload. The whitelist is pre-filtered by HR — it contains only employees who are currently eligible and do not have an active contract. The system trusts this list completely.

### Whitelist Retention
Previous whitelist records are never deleted. When a new whitelist is uploaded, existing records are marked `is_current = false` and the new records are inserted as `is_current = true`. This provides a full historical record of who was eligible in each cycle.

### Missing Whitelist Alert
If no whitelist has been uploaded by the configured monthly deadline (default: 5th of the month), the system:
- Triggers a `expected_file_not_uploaded` alert to M1 Admin.
- Displays a prominent warning indicator on the M1 Admin dashboard (e.g. red status banner: "No whitelist uploaded for [Month]").
- Blocks the batch processing trigger until a whitelist is present for the current cycle.

### Upload Process
1. Admin uploads the Excel file via the admin dashboard (File Upload screen).
2. System validates the file format and required columns before processing.
3. System parses each row, hashing employee number and ID number with bcryptjs.
4. Records with missing required fields are flagged and listed in an error report.
5. If validation passes, all existing `whitelist_records` records with `is_current = true` are set to `is_current = false`.
6. New records are inserted with `is_current = true`.
7. Admin is shown a summary: records processed, records flagged, errors.
8. The source file is stored in Supabase Storage (`whitelist-uploads/`).
9. Missing whitelist alert is automatically cleared if one was active.

### Required Columns (HR must provide)
- Employee name
- Employee number
- ID number
- Place of work
- Salary band
- Eligible phone models (mapped to system phone_models records)
- Employment type (permanent / flexi)

### Data Governance
- Employee number and ID number are hashed immediately on parse, before any database write.
- The original uploaded file is retained in Supabase Storage for audit purposes.
- No raw employee number or ID number exists anywhere in the system after the parse step.

---

## 1.2 Employee Validation and Eligibility

### Entry Points
- Direct URL
- QR code (printed in-store or shared via WhatsApp — links to direct URL)
- Store computer browser

### Validation Flow
1. Employee navigates to the portal landing page.
2. Employee enters their employee number and ID number.
3. System hashes both inputs.
4. System queries `whitelist_records` WHERE `is_current = true` for a matching hash combination.
5. **No match:** Application declined immediately. Displayed message: "We could not find your details on our employee records. Please contact your HR representative."
6. **Match found:** Retrieve `display_name`, `place_of_work`, `salary_band`, `eligible_model_ids`, `store_code`, `employment_type`.
7. Display name and place of work shown to employee for confirmation.
8. Check for active rental: query `rentals` WHERE `employee_number_hash` matches AND `status = 'active'`. If found, block application and display current rental details.
9. Proceed to contact number confirmation.

---

## 1.3 OTP Verification

### Purpose
Verify that the employee has access to the contact number on record, and capture an updated number if theirs has changed.

### Flow
1. Display the contact number held in the whitelist record (or most recent application if employee has applied before in the current cycle).
2. Employee confirms the number or updates it.
3. If updated, flag `contact_number_updated = true` for HR feedback reporting.
4. Send OTP via SMS to the confirmed/updated number.
5. Employee enters OTP.
6. System hashes input OTP and compares to stored `otp_hash` in `otp_events`.
7. If correct and not expired: mark session as OTP-verified and proceed.
8. If expired: offer to resend. Log the event.
9. If max attempts reached: lock OTP, log event, display error.

### OTP Configuration (via system_config)
- Expiry: 10 minutes (configurable)
- Max attempts: 3 (configurable)
- Max resend requests: 3 (configurable)

### Security
- OTP is a 6-digit numeric code.
- OTP is hashed with bcryptjs before storage. Never stored in plaintext.
- SMS delivery is logged in `sms_deliveries`.

---

## 1.4 Application Form

### Display Rules
- Only phones the employee is entitled to (based on `eligible_model_ids` from whitelist) are displayed.
- Each phone shows: model name, image (optional), retail price, rental amount for 7 months, rental amount for 13 months.
- Out of stock models are shown as unavailable (not hidden) so the employee is aware they exist but cannot be selected.

### Form Fields
The exact field list will be confirmed once the current Google Form is shared. The following fields are expected:
- Contact number (pre-filled, editable)
- Email address (optional — captured for future use)
- Selected phone model
- Selected rental term (7 months or 13 months)
- T&Cs acceptance checkbox (link must be opened before checkbox becomes active)

### T&Cs
- Displayed as a hyperlink to the legally vetted T&Cs document.
- The acceptance checkbox is disabled until the T&Cs link has been opened.
- `terms_accepted_at` is recorded as part of the application record — this serves as the digital contract record.

### Duplicate Application Handling
- Before showing the form, check if the employee has an existing `pending` application in the current batch cycle.
- If yes: display a notice — "You have an existing application for [Phone Model]. Submitting this new application will cancel your previous one."
- Show the details of the previous application.
- Employee can proceed (new application supersedes old) or return to their existing application.

### Submission
- On submit: create new `application` record with `status = 'pending'`.
- Increment `stock_records.quantity_reserved` for the selected model.
- If a previous application existed in this batch cycle: set it to `status = 'superseded'`, decrement `quantity_reserved` for that model.
- Display reference number and confirmation message.
- Log event in `audit_logs`.

---

## 1.5 Application Management (Employee Self-Service)

### Employee Dashboard
After successful login, an employee with an active application sees:

**If application pending:**
- Application reference number
- Phone model applied for
- Rental term
- Submission date
- Current status
- Cancel button (enabled before cut-off, disabled after with T&C message)

### Cancel Application (Pre Cut-off)
- Employee can cancel their own application before the batch cut-off.
- On cancellation: set `status = 'cancelled_by_employee'`, record `cancelled_at` and `cancellation_reason = 'employee_requested'`.
- Decrement `stock_records.quantity_reserved`.
- No SMS confirmation of cancellation required (to keep costs down).

---

## 1.6 Batch Processing

Batch processing runs on a scheduled cron job (configurable — default 23:00 on the 9th of each month). The process runs automatically. Admin review and approval is required before the output list is generated.

> **Phase 1 output:** The batch produces a downloadable approved applications list (Excel). Admin downloads this and actions downstream manually — forwarding to HR, Teljoy, 3G, WWAS, etc. No automated supplier submission or payroll file generation in Phase 1.

### Step 1 — Close Batch
- Set current batch `status = 'closed'` with `cutoff_at = now()`.
- Prevent new applications from being accepted (application endpoint checks batch status).

### Step 2 — Whitelist Validation
- For every application with `status = 'pending'`:
  - Re-hash employee number and ID number and compare against current whitelist (`is_current = true`).
  - If no match: set `status = 'cancelled_no_whitelist'`. Decrement `quantity_reserved`.
  - Log reason.

### Step 3 — Stock Validation
- For each phone model, count valid applications remaining after Step 2.
- Compare against `stock_records.quantity_on_hand`.
- If applications > stock:
  - Sort valid applications for that model by `submitted_at` descending (newest first).
  - Cancel applications from the top (newest) until count ≤ stock.
  - Set cancelled applications to `status = 'cancelled_no_stock'`. Decrement `quantity_reserved`.
  - Log which applications were cancelled and why.

### Step 4 — Mark Valid Applications
- All remaining `pending` applications → `status = 'approved'`.

### Step 5 — Generate Batch Summary
- Summary includes:
  - Total approved applications
  - Breakdown by phone model
  - Breakdown by rental term (7 months vs 13 months)
  - Breakdown by location type (superstore, liquor, DC, meat factory, head office, build store)
  - Breakdown by employment type (permanent vs flexi)
  - Stock status per model
  - Applications cancelled (whitelist removed) with count
  - Applications cancelled (stock exhausted) with count
- Store in `batches.processing_log`.
- Email summary to nominated M1 Admin recipients.
- Update batch `status = 'awaiting_approval'`.

### Step 6 — Admin Review and Approval (Manual)
- M1 Admin or Super Admin reviews the batch summary on the admin dashboard.
- Admin can drill into individual cancelled applications if needed.
- Admin approves via a confirmation action on the dashboard.
- Batch `status → 'approved'`, `approved_by`, `approved_at` recorded.

### Step 7 — Generate Approved Applications List
Immediately after approval:
- Generate an Excel file listing all approved applications.
- Columns: Employee Name, Employee Number (reference only), Place of Work, Store Code, Phone Model, Rental Term, Monthly Amount, Application Reference, Submitted At.
- Store file in Supabase Storage.
- Make available for download on the admin dashboard.
- Set `applications.status = 'approved'` for each included record.
- Set batch `status = 'list_generated'`.

### Step 8 — Confirmation SMS
- Send confirmation SMS to each approved employee:
  "Hi [NAME], your application (Ref: [REF]) for a [PHONE_MODEL] has been approved. Your phone will be delivered to [STORE_NAME] by the 25th."

### Step 9 — Completion
- Set batch `status = 'completed'`.
- Log all steps in `batches.processing_log`.

---

## 1.7 Store Manager Portal

### Access
Store managers log in via the unified login with employee number + ID number. Validated against the current `store_managers` table.

### Dashboard
- Displays all orders with `delivery_store_code` matching the manager's `store_code`.
- Grouped by status: Pending, Received from Courier, Handed to Employee.
- Each order shows: employee name, phone model, order reference, order date.

### Delivery Confirmation — Step 1: Received from Courier
- Manager selects an order and confirms the phone has been received from RAM.
- System creates a `delivery_events` record with `event_type = 'received_from_courier'`.
- Updates `orders.status = 'delivered_to_store'`.
- Logs event in `audit_logs`.

### Delivery Confirmation — Step 2: Handed to Employee
- Manager confirms the phone has been handed to the employee.
- System creates a `delivery_events` record with `event_type = 'handed_to_employee'`.
- Updates `orders.status = 'handed_to_employee'`.
- Logs event.

### Device Support
- Primary: store computer (desktop browser).
- Secondary: personal mobile phone (responsive, no app install required).

---

## 1.8 Leavers Workflow

> **Phase 1 scope:** The leavers workflow is deferred to Phase 2. The whitelist is pre-filtered by HR (employees with active contracts are excluded from the whitelist). Since the system does not track ongoing rental contracts in Phase 1, there is no rental record to update when an employee leaves. The leaver process (payment increase, Teljoy notification, Pay@ reconciliation) will be scoped once the broader rental tracking requirements are confirmed with stakeholders.

---

## 1.9 Pay@ Reconciliation

> **Phase 1 scope:** Deferred. No rental tracking in Phase 1 means no ongoing payment reconciliation is required. This will be revisited in Phase 2 alongside the leavers workflow.

---

## 1.10 Stock Management

### Stock Updates
- Stock levels are maintained via monthly file upload (Excel or CSV).
- Upload screen shows: model name, current stock on hand, open applications count, available balance.
- Admin can update stock via file upload or manual override (with audit trail).

### Forecasting and Alerts
- Dashboard widget shows: stock on hand vs current open applications per model.
- When `quantity_on_hand - quantity_reserved ≤ stock_warning_threshold` (default 20% of on_hand): trigger alert to M1 Admin.
- Forecast: based on current application rate and days remaining until cut-off, project whether additional stock needs to be ordered.

---

## 1.11 Reporting

### Weekly Summary Report
- Runs every Monday at 07:00 (configurable).
- Sent by email to nominated recipients.
- Content: applications received to date in current cycle, breakdown by phone model, rental term, location type, employment type, stock status.

### Cut-Off Date Report
- Generated at batch approval (Step 6 of batch processing).
- Full batch summary as described in section 1.6 Step 5.

### Exception Report
- Runs in parallel with the weekly report.
- Flags: stock at or below threshold, applications in error state, leavers in arrears, pay@ payments overdue.

### Migration Report (one-time)
- Generated after the 1,300 active rentals are migrated into the system.
- Confirms all records have been imported and validates against the source data.

---

## 1.12 Insurance and Claims (WWAS)

### Phase 1 Scope
- Display WWAS contact details and claim process steps on the employee landing page.
- Provide a step-by-step guide for lodging a claim (content to be provided by project owner once WWAS process is documented).
- Log any claim event recorded in the system against the relevant order record.

### Open Items
- Steps an employee must follow to lodge a claim (awaiting WWAS documentation).
- What happens to the rental agreement if a phone is written off under insurance.
- Whether the system logs claims or WWAS handles that entirely.

---

## 1.13 Data Migration (Pre Go-Live)

### Scope
Approximately 1,300 active rentals currently managed in Google Sheets / Excel must be fully imported into the new system before go-live.

### Migration Process
1. Project owner provides the current Google Form response data and Excel processing file.
2. Development team maps source fields to `applications`, `orders`, and `rentals` table structure.
3. Migration script imports records, hashing all PII fields.
4. For each migrated rental:
   - Create a synthetic `application` record (status: `converted_to_order`).
   - Create a synthetic `order` record.
   - Create a `rental` record with accurate start_date, payments_made, payments_remaining.
5. Generate migration report for project owner to verify against source.
6. Project owner signs off before go-live.

### Key Migration Rules
- All existing rental agreements must be honoured from day one.
- Rental terms and monthly amounts must match existing agreements exactly.
- No data from the pilot should be lost or altered.
- Migration runs in a staging environment first before production.

---

## User Interface — Key Screens

### Employee Portal
1. **Landing / Login** — Employee number + ID number entry (Tab A of unified login).
2. **Identity Confirmation** — Show name and place of work. Confirm or update contact number.
3. **OTP Verification** — Enter OTP sent by SMS.
4. **Phone Selection** — Show eligible models with pricing. Select model and term.
5. **T&Cs and Submit** — T&Cs link + acceptance checkbox + submit button.
6. **Confirmation** — Reference number, summary of application, success message.
7. **Dashboard** — Active application or rental status.

### Store Manager Portal
1. **Login** — Employee number + ID number (Tab A of unified login, detected as store manager).
2. **Delivery Dashboard** — Pending deliveries grouped by status.
3. **Delivery Confirmation** — Confirm receipt from courier / handover to employee.

### Admin (M1)
1. **Overview Dashboard** — Key metrics: applications this cycle, stock status, recent orders, alerts.
2. **Whitelist Management** — Upload, history, error log.
3. **Applications** — Full list with filters (status, batch, phone model, store).
4. **Batch Processing** — Current batch status, step-by-step progress, approval action.
5. **Orders** — Order list with supplier submission status and delivery status.
6. **Rentals** — Active rentals, leaver rentals, completed rentals.
7. **Stock** — Current levels, upload, forecast widget.
8. **Leavers** — Leaver file upload, matched records, notification status.
9. **Pay@ Reconciliation** — Payment matching, arrears report.
10. **Reports** — Generate and download weekly and monthly reports.
