# 06 — Module 2: Utility Bill Automation

**Version:** 1.1  
**Date:** 2026-05-13  
**Updated:** 2026-05-13 — Bill ingestion changed to manual PDF upload for Phase 1

---

## Purpose

Module 2 replaces a manual data capture and spreadsheet submission process with an automated extraction pipeline. In Phase 1, M2 Admins upload utility bill PDFs manually via the admin dashboard. The system extracts the required data using a PDF parser or AI fallback, generates the required Excel output, and emails it to the nominated Boxer contact. Phase 2 adds automated email ingestion and browser submission to the service provider portal.

---

## Business Context

- Boxer operates ~550 stores, each receiving a utility bill from their local municipality every month.
- Currently, a team of clerks manually reads each bill, enters the figures into a spreadsheet, and submits it to a third-party utility management company who audits the charges.
- This is 550 bills × 12 months = 6,600 manual data captures per year.
- The same pipeline, once built, can be extended to other document types (rates bills, refuse invoices) and to other companies — the commercial opportunity is significant.

---

## Architecture Principle — Modularity

The processing pipeline is designed as three independent layers:

```
LAYER 1: Extraction     →    LAYER 2: Output    →    LAYER 3: Submission
(PDF parse / OCR / AI)       (Excel generation)       (Email / Portal agent / API)

Each layer is a separate service module. Layer 3 can be swapped (Phase 1: email → 
Phase 2: browser agent → Phase 3: API) without touching Layers 1 or 2.
```

---

## 2.1 Bill Ingestion

### Phase 1 — Manual PDF Upload
In Phase 1, M2 Admins upload utility bill PDFs directly via the admin dashboard. There is no email monitoring or inbox polling. This simplifies the architecture significantly and allows the extraction pipeline to be proven before adding automated ingestion.

### Upload Process
1. M2 Admin navigates to Bills → Upload Bill in the admin dashboard.
2. Admin selects a store from the active store list.
3. Admin uploads the PDF file (drag-and-drop or file picker).
4. System validates: file must be PDF, max 20MB.
5. File uploaded to Supabase Storage (`utility-bills/YYYY-MM/store_code/filename.pdf`).
6. `bills` record created with `status = 'received'`.
7. Extraction pipeline begins automatically (section 2.2 onwards).
8. Event logged in `audit_logs`.

### Bulk Upload
For months where many bills need to be loaded at once, the admin can upload multiple PDFs in a single session. Each file triggers an independent extraction pipeline run.

### Phase 2 — Automated Email Ingestion
Phase 2 will add automated ingestion from the central Boxer email inbox (polling or webhook). The ingestion method and inbox details are to be confirmed with Boxer. The extraction pipeline (sections 2.2 onwards) is unchanged — only the trigger changes from manual upload to automated inbox monitoring.

### Missing Bill Tracking
- The admin dashboard shows a monthly bill status grid: all active stores vs bills received/processed/outstanding.
- M2 Admin can see at a glance which stores have not yet had a bill uploaded for the current month.
- No automated missing-bill alert in Phase 1 (manual upload means the admin controls when bills are uploaded). This alert will be added in Phase 2 when ingestion is automated.

---

## 2.2 Bill Classification — Digital or Scanned

After a bill is received and stored, the pipeline attempts to determine whether it is a true digital PDF or a scanned image.

### Detection Method
1. Run `pdf-parse` on the stored PDF.
2. If the extracted character count is below a threshold (configurable — default: 100 characters for a multi-page bill), classify as **scanned**.
3. If above threshold, classify as **digital**.
4. Update `bills.is_digital_pdf` accordingly.

### Scanned Bill Handling
If classified as scanned:
1. Update `bills.status = 'ocr_processing'` and `ocr_applied = true`.
2. Run Tesseract.js on the PDF pages.
3. Record `ocr_confidence` score.
4. If confidence is below threshold (configurable — default: 70%):
   - Set `bills.status = 'flagged'`, `flagged_reason = 'low_ocr_confidence'`.
   - Create alert for M2 Admin review.
   - Do not proceed to parsing.
5. If confidence acceptable: proceed to parsing with the OCR text layer.

---

## 2.3 PDF Parsing — Known Formats

### Format Library
Each municipality's billing format is represented as a record in `municipality_formats`. The `parsing_rules` field (jsonb) stores field extraction rules for that format.

**Parsing rules structure:**
```json
{
  "format_id": "ct_city_of_cape_town_v1",
  "detection_keywords": ["City of Cape Town", "CoCT"],
  "fields": {
    "account_number": { "method": "regex", "pattern": "Account No[:.\\s]+([\\d-]+)" },
    "billing_period": { "method": "text_position", "page": 1, "x": 450, "y": 120, "width": 150 },
    "total_due": { "method": "regex", "pattern": "TOTAL DUE[:\\s]+R?([\\d,]+\\.\\d{2})" }
  }
}
```

### Matching Process
1. Extract text from bill (digital or OCR pre-processed).
2. Check extracted text against `detection_keywords` for each active `municipality_formats` record.
3. **First match wins.** Apply that format's parsing rules.
4. If no format matches: route to AI fallback (section 2.4).

### Field Extraction
- Apply each rule in the format's field definitions.
- For each field: attempt extraction using the specified method (regex, text position, table extraction, etc.).
- Validate extracted values:
  - Numeric fields: check they are within expected range (e.g. `total_due > 0`).
  - Date fields: check they parse as valid dates.
  - Required fields: check they are not empty.
- If all required fields extracted and valid: proceed to review/output.
- If any required field missing or invalid: set `bills.status = 'flagged'`, alert M2 Admin.

### Coverage Tracking
- The admin dashboard shows a Municipality Format Coverage view:
  - Active stores: 550
  - Formats mapped: N
  - Stores covered: N
  - Stores without a matched format: N (listed by store/municipality)
- This gives a clear view of build progress and deployment readiness.

---

## 2.4 AI Fallback Extraction

### Trigger
The AI layer fires when:
1. No matching municipality format exists for the bill (unknown format).
2. A known format produces incomplete extraction (possible layout change).

### Claude API Call
The bill text (from pdf-parse or Tesseract.js) is sent to the Claude API with a structured prompt:

```
You are extracting data from a South African municipality utility bill.
Extract the following fields and return them as JSON:
- store_name, store_number, municipality_name, account_number,
  billing_period_start (YYYY-MM-DD), billing_period_end (YYYY-MM-DD),
  meter_number, previous_reading, current_reading, units_consumed,
  tariff_rate, amount_charged, vat_amount, total_due, due_date (YYYY-MM-DD)

If a field is not found, return null for that field.
Return only the JSON object, no other text.

Bill text:
[BILL_TEXT]
```

### Response Handling
1. Parse the JSON response.
2. Map fields to `bill_extractions` record.
3. Log AI model used, token counts, and estimated cost.
4. Set `review_status = 'pending'` (AI extractions always go to human review in Phase 1).
5. Create alert for M2 Admin: "AI extraction completed — requires review."

### Learning Loop
When a reviewer confirms an AI extraction is correct:
- If this is a format the system has not seen before, M2 Admin is prompted to add it to the format library.
- Over time, the parser handles the majority of bills and the AI handles genuine edge cases only.

### Cost Tracking
- `bill_extractions.ai_cost_usd` is populated for every AI extraction.
- Monthly AI cost report is available on the M2 dashboard.
- Alert if monthly AI cost exceeds a configurable threshold (default: $5 USD).

---

## 2.5 Human Review Interface

### When Triggered
- All AI-extracted bills (always, in Phase 1).
- Bills flagged due to missing fields or failed parsing.
- Bills with low OCR confidence.

### Review UI
The review interface is a side-by-side view:
- **Left panel:** The original PDF bill rendered in the browser.
- **Right panel:** The extracted fields in an editable form.
- Each extracted field has a source indicator (parser / AI / manual).
- **Field highlighting:** Where field positions have been recorded (`field_positions` jsonb), the corresponding area on the PDF is highlighted when the reviewer focuses that field. This allows the reviewer to visually verify the extracted value against the source document.

### Review Actions
1. **Approve:** Mark extraction as `review_status = 'approved'`. Proceed to Excel generation.
2. **Correct and Approve:** Edit any field values, then approve. The corrected values are saved.
3. **Reject:** Mark as `review_status = 'rejected'`. Flag for manual capture. Alert M2 Admin.

### Human Capture (Failed Extraction)
For bills where extraction failed entirely:
- Reviewer opens the PDF and manually enters all field values into the review form.
- Mark extraction as `extraction_method = 'manual'`, `review_status = 'approved'`.
- Proceed to Excel generation.

### Auto-Approval (Future Configuration)
Once the team has sufficient confidence in the parser's accuracy for known formats:
- Enable `ai_auto_approve_enabled = false` (only parser results auto-approve).
- Parser-extracted results for known formats skip the review queue.
- AI-extracted and manually flagged bills still go to review.
- Configurable per municipality format (some may require ongoing review).

---

## 2.6 Excel Output Generation

### Process
1. Load the Boxer submission Excel template (stored in Supabase Storage).
2. Map approved `bill_extractions` fields to template columns.
3. Populate the template using ExcelJS.
4. Apply any required cell formatting (dates, currency, number formats).
5. Save generated file to Supabase Storage (`excel-outputs/YYYY-MM/store_code/filename.xlsx`).
6. Create `excel_outputs` record.
7. Update `bills.status = 'excel_generated'`.

### File Naming Convention
To be confirmed once the Boxer Excel template is provided. Suggested: `BOXER_[STORE_NUMBER]_[BILLING_PERIOD_YYYYMM]_[GENERATED_DATE_YYYYMMDD].xlsx`

### Per Store or Consolidated
To be confirmed. Phase 1 assumption: one Excel file per bill (per store per month). If the requirement is a consolidated file, this section will be updated.

### Template Notes
- The Excel template is provided by Boxer/the service provider.
- The template is stored in Supabase Storage as a versioned file.
- Template version is recorded in `excel_outputs.template_version`.
- No calculated fields — raw data only. All analysis is performed by the service provider.

---

## 2.7 Email Delivery

### Phase 1 Delivery
The generated Excel file is emailed to the nominated internal Boxer contact immediately after generation (per bill, not batched).

### Email Content
- **To:** Nominated Boxer internal contact (email address configured in system_config)
- **Subject:** "Utility Bill Processed — [Store Name] — [Billing Period]"
- **Body:** Store name, store number, municipality, billing period, processing date, extraction method used.
- **Attachment:** Generated Excel file.

### Delivery Logging
- Create `email_deliveries` record for every email sent.
- Record delivery status from Resend API response.
- If delivery fails: retry once after 30 minutes. If retry also fails: create `system_alerts` entry and notify M2 Admin.

---

## 2.8 Store and Account Management

### Active Store List
The active store list (`m2_stores`) is maintained manually via the M2 Admin dashboard. Phase 1 does not integrate with a Boxer store database.

### Adding a Store
- M2 Admin enters: store name, store number, account number, municipality, region, expected sender email pattern.
- Account number is the key — used to match incoming bills to stores.

### Deactivating a Store
- M2 Admin marks a store as inactive.
- System stops expecting bills from that account.
- Suppresses missing-bill alerts for that account.

### New/Unrecognised Account Handling
When a bill arrives from an account number not in `m2_stores`:
1. System creates a bill record with `status = 'flagged'`.
2. System alert: "Bill received from unrecognised account: [account_number]. Sender: [sender_email]. Filename: [filename]."
3. M2 Admin reviews and either adds the store or marks as spam/error.

### Monthly Checklist
- A scheduled report (configurable — monthly, on the 15th) generates a checklist:
  - Stores with bills received and processed: ✓
  - Stores with bills received but pending review: ⏳
  - Stores with bills not yet received: ✗
- Emailed to M2 Admin and nominated recipients.

---

## 2.9 Submission Tracking (Phase 1)

In Phase 1, the Excel file is emailed to an internal Boxer contact who submits it to the service provider portal manually. The system tracks the status:

- `submissions.status = 'pending'` — Excel generated, emailed, awaiting manual submission.
- M2 Admin can mark a bill as `submitted` once the manual submission is confirmed.
- `reference_number` can be recorded if the portal provides one.

### Phase 2 — Browser Agent Submission
Phase 2 adds automated portal submission. The browser agent:
- Logs into the service provider portal using stored credentials (managed via environment variables or a secrets store).
- Navigates to the submission form.
- Enters each field from the `bill_extractions` record.
- Captures any confirmation or reference number returned.
- Records the outcome in `submissions`.
- If submission fails: retries once. If retry fails: creates `system_alerts` entry and notifies M2 Admin.

**Phase 2 cannot be fully scoped until the service provider portal has been reviewed.** Key unknowns: CAPTCHA, 2FA, session timeouts, field validation behaviour.

---

## 2.10 Reporting and Monitoring

### Processing Dashboard (Real-time)
Available on the M2 Admin dashboard:
- Bills received this month: N
- Bills processing / in review: N
- Bills successfully processed and emailed: N
- Bills awaiting manual review: N
- Bills failed / flagged: N
- Municipality format coverage: N formats / N stores covered

### Monthly Coverage Report
Generated on the 15th of each month. Shows all 550 stores with bill status for the current month.

### Exception Report
Generated weekly and on demand:
- Bills not received within expected window
- Bills stuck in processing (over `bill_processing_sla_hours`)
- AI extractions awaiting review
- Submission failures
- Unrecognised account numbers
- Monthly AI cost

### AI Cost Report
Monthly. Shows:
- Total bills processed via AI
- Total AI cost (USD and ZAR equivalent)
- Cost per bill
- Trend vs prior month

---

## User Interface — Key Screens (Module 2)

### M2 Admin Dashboard
1. **Overview** — Stats widgets (received, processing, processed, flagged, coverage %).
2. **Bill Processing Status** — Full list of bills with filters (store, municipality, status, billing period, date range).
3. **Review Queue** — List of bills awaiting human review. Click to open the side-by-side review UI.
4. **Review UI** — PDF on left, extracted fields on right, approve/reject/correct actions.
5. **Store Management** — Active store list, add/edit/deactivate stores.
6. **Municipality Formats** — Format library, add/edit formats, coverage dashboard.
7. **Excel Outputs** — Downloadable generated files, email delivery status.
8. **Submissions** — Submission status per bill, mark as submitted (Phase 1 manual confirmation).
9. **Reports** — Monthly checklist, exception report, AI cost report.
10. **Alerts** — Active alerts, alert history, resolution log.
