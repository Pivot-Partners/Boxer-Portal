# 08 — API Design

**Version:** 1.0  
**Date:** 2026-05-13

---

## Conventions

- All endpoints use JSON request/response bodies unless handling file uploads (multipart/form-data).
- Authentication: Bearer token in `Authorization` header for all protected routes.
- Dates: ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`).
- IDs: UUID v4.
- Error responses follow a consistent shape: `{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }`.
- Pagination: cursor-based for large datasets. Query params: `limit` (default 50, max 200), `cursor` (opaque string).
- All mutating operations are logged to `audit_logs` by the backend.

---

## Base URL

```
Production:  https://api.boxer-portal.co.za/v1
Development: http://localhost:3001/v1
```

---

## Authentication Endpoints

### `POST /auth/employee`
Authenticate an employee or store manager using employee number + ID number.

**Request:**
```json
{
  "employee_number": "12345678",
  "id_number": "9001015009087"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "expires_at": "2026-05-13T20:00:00Z",
  "user": {
    "type": "employee",
    "role": "employee",
    "display_name": "John Sithole",
    "place_of_work": "Boxer Superstore - Soweto",
    "store_code": "SOW001",
    "salary_band": "B3",
    "eligible_model_ids": ["uuid1", "uuid2"],
    "has_active_application": false,
    "has_active_rental": false
  }
}
```

**Response 401:** Invalid credentials  
**Response 403:** Employee has active rental (includes rental details in error body)

---

### `POST /auth/admin`
Authenticate an admin user using email + password.

**Request:**
```json
{
  "email": "admin@boxer.co.za",
  "password": "securepassword"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "expires_at": "2026-05-13T14:15:00Z",
  "refresh_token": "opaque_refresh_token",
  "user": {
    "type": "admin",
    "role": "super_admin",
    "user_id": "uuid",
    "full_name": "Chris Lombard",
    "email": "admin@boxer.co.za"
  }
}
```

**Response 401:** Invalid credentials  
**Response 429:** Account locked

---

### `POST /auth/refresh`
Refresh an admin access token using a refresh token.

**Request:**
```json
{ "refresh_token": "opaque_refresh_token" }
```

**Response 200:** New token + refresh_token  
**Response 401:** Invalid or expired refresh token

---

### `POST /auth/logout`
Revoke the current session.

**Auth required:** Yes  
**Response 204:** No content

---

## Module 1 — OTP

### `POST /m1/otp/send`
Send an OTP to the employee's confirmed contact number.

**Auth required:** Yes (employee token)  
**Request:**
```json
{ "contact_number": "0821234567" }
```

**Response 200:**
```json
{
  "otp_event_id": "uuid",
  "masked_number": "082***4567",
  "expires_at": "2026-05-13T14:25:00Z"
}
```

---

### `POST /m1/otp/verify`
Verify the OTP entered by the employee.

**Auth required:** Yes (employee token)  
**Request:**
```json
{
  "otp_event_id": "uuid",
  "otp": "123456"
}
```

**Response 200:** `{ "verified": true }`  
**Response 400:** Invalid OTP  
**Response 410:** OTP expired  
**Response 429:** Max attempts reached

---

## Module 1 — Applications

### `GET /m1/applications/current`
Get the employee's current application in the open batch.

**Auth required:** Yes (employee token)  
**Response 200:**
```json
{
  "application": {
    "id": "uuid",
    "reference_number": "APP-202605-001234",
    "phone_model": { "id": "uuid", "model_name": "Samsung A17", "rental_amount_7m": 350.00 },
    "rental_term": 7,
    "status": "pending",
    "submitted_at": "2026-05-05T10:30:00Z",
    "cancellable": true
  }
}
```

**Response 404:** No current application

---

### `POST /m1/applications`
Submit a new phone rental application.

**Auth required:** Yes (employee token, OTP verified)  
**Request:**
```json
{
  "phone_model_id": "uuid",
  "rental_term": 7,
  "contact_number": "0821234567",
  "terms_accepted": true,
  "otp_event_id": "uuid"
}
```

**Response 201:**
```json
{
  "application": {
    "id": "uuid",
    "reference_number": "APP-202605-001234",
    "status": "pending",
    "superseded_previous": true,
    "previous_reference": "APP-202605-001100"
  }
}
```

**Response 400:** Validation error (terms not accepted, invalid model, etc.)  
**Response 403:** Batch closed, or employee already has active rental  
**Response 409:** Stock unavailable

---

### `DELETE /m1/applications/:id`
Cancel an application (employee self-service).

**Auth required:** Yes (employee token — can only cancel own application)  
**Response 204:** Cancelled  
**Response 403:** Application not cancellable (post cut-off, or not owned by this employee)

---

### `GET /m1/applications` *(Admin only)*
List all applications with filters.

**Auth required:** Yes (m1_admin or super_admin)  
**Query params:** `batch_id`, `status`, `phone_model_id`, `store_code`, `limit`, `cursor`  
**Response 200:** Paginated list of applications

---

## Module 1 — Batch

### `GET /m1/batches/current`
Get the current open or most recent batch.

**Auth required:** Yes (m1_admin or super_admin)  
**Response 200:**
```json
{
  "batch": {
    "id": "uuid",
    "batch_month": "2026-05-01",
    "status": "awaiting_approval",
    "cutoff_at": "2026-05-09T23:00:00Z",
    "total_applications": 1847,
    "valid_applications": 1721,
    "cancelled_applications": 126,
    "summary": { ... }
  }
}
```

---

### `POST /m1/batches/:id/approve`
Approve a batch to trigger order generation and submission.

**Auth required:** Yes (m1_admin or super_admin)  
**Request:** `{}` (confirmation action, no body required)  
**Response 202:** Batch approval queued — order generation begins asynchronously

---

## Module 1 — Stock

### `GET /m1/stock`
Get current stock levels for all models.

**Auth required:** Yes (m1_admin or super_admin)  
**Response 200:**
```json
{
  "stock": [
    {
      "phone_model_id": "uuid",
      "model_name": "Samsung A17",
      "quantity_on_hand": 500,
      "quantity_reserved": 342,
      "quantity_available": 158,
      "current_applications": 342,
      "stock_status": "adequate"
    }
  ]
}
```

---

### `GET /m1/phone-models`
Get available phone models (filtered to employee's eligibility if called with employee token).

**Auth required:** Yes (any)  
**Response 200:** Array of phone models (filtered by salary band if employee token)

---

## Module 1 — Rentals

### `GET /m1/rentals/my`
Get the authenticated employee's active rental.

**Auth required:** Yes (employee token)  
**Response 200:**
```json
{
  "rental": {
    "id": "uuid",
    "phone_model": { "model_name": "Samsung A17" },
    "start_date": "2025-11-01",
    "term_months": 7,
    "current_monthly_amount": 350.00,
    "payments_made": 6,
    "payments_remaining": 1,
    "amount_paid": 2100.00,
    "amount_remaining": 350.00,
    "status": "active",
    "leaver_flag": false,
    "end_of_term_purchase_eligible": false
  }
}
```

---

## Module 1 — Delivery

### `GET /m1/store/orders`
Get all orders for the logged-in store manager's store.

**Auth required:** Yes (store_manager token)  
**Response 200:** Array of orders grouped by status

---

### `POST /m1/store/orders/:id/received`
Confirm phone received from courier.

**Auth required:** Yes (store_manager token)  
**Response 200:** Updated order

---

### `POST /m1/store/orders/:id/handed-over`
Confirm phone handed to employee.

**Auth required:** Yes (store_manager token)  
**Response 200:** Updated order

---

## Module 2 — Bills

### `GET /m2/bills`
List bills with filters.

**Auth required:** Yes (m2_admin or super_admin)  
**Query params:** `store_id`, `status`, `billing_period`, `extraction_method`, `limit`, `cursor`  
**Response 200:** Paginated bill list

---

### `GET /m2/bills/:id`
Get full detail for a single bill including extraction results.

**Auth required:** Yes (m2_admin or super_admin)  
**Response 200:**
```json
{
  "bill": {
    "id": "uuid",
    "store": { "store_name": "Boxer Soweto", "store_number": "SOW001" },
    "status": "awaiting_review",
    "email_received_at": "2026-05-02T09:15:00Z",
    "utility_type": "electricity",
    "extraction_method": "ai",
    "extraction": {
      "id": "uuid",
      "review_status": "pending",
      "total_due": 12450.00,
      "billing_period_start": "2026-04-01",
      "billing_period_end": "2026-04-30"
    },
    "pdf_url": "signed_url_to_supabase_storage"
  }
}
```

---

### `GET /m2/bills/review-queue`
Get bills awaiting human review.

**Auth required:** Yes (m2_admin or super_admin)  
**Response 200:** Array of bills, oldest first

---

### `POST /m2/bills/:id/extraction/:extraction_id/approve`
Approve an extraction (optionally with corrections).

**Auth required:** Yes (m2_admin or super_admin)  
**Request:**
```json
{
  "corrections": {
    "total_due": 12500.00
  }
}
```

**Response 200:** Updated extraction + triggers Excel generation

---

### `POST /m2/bills/:id/extraction/:extraction_id/reject`
Reject an extraction and queue for manual capture.

**Auth required:** Yes (m2_admin or super_admin)  
**Request:** `{ "reason": "OCR quality too poor to trust" }`  
**Response 200:** Bill status updated to flagged

---

## Module 2 — Stores

### `GET /m2/stores`
List all active stores.

**Auth required:** Yes (m2_admin or super_admin)  
**Response 200:** Array of stores with bill processing status for current month

---

### `POST /m2/stores`
Add a new store to the active list.

**Auth required:** Yes (m2_admin or super_admin)  
**Request:**
```json
{
  "store_name": "Boxer Soweto",
  "store_number": "SOW001",
  "account_number": "ACC-12345-ZA",
  "municipality": "City of Johannesburg",
  "region": "Gauteng",
  "email_pattern": "@citypower.co.za"
}
```

**Response 201:** Created store

---

### `PATCH /m2/stores/:id`
Update or deactivate a store.

**Auth required:** Yes (m2_admin or super_admin)  
**Request:** Any subset of store fields + `is_active: false` to deactivate  
**Response 200:** Updated store

---

## Shared — File Uploads

### `POST /files/upload`
Upload a file for processing (whitelist, leavers, stock, store managers, catalogue).

**Auth required:** Yes (m1_admin or super_admin for M1 files; m2_admin or super_admin for M2 files)  
**Content-Type:** multipart/form-data  
**Form fields:**
- `file`: binary file
- `upload_type`: 'whitelist' | 'leavers' | 'stock' | 'store_managers' | 'phone_catalogue'
- `module`: 'm1' | 'm2'

**Response 202:**
```json
{
  "upload_id": "uuid",
  "status": "processing",
  "message": "File received. Processing in background."
}
```

---

### `GET /files/uploads/:id`
Get the processing status of a file upload.

**Auth required:** Yes (m1_admin, m2_admin, or super_admin)  
**Response 200:**
```json
{
  "upload": {
    "id": "uuid",
    "upload_type": "whitelist",
    "original_filename": "hr_whitelist_may2026.xlsx",
    "status": "processed",
    "record_count": 18247,
    "processed_count": 18231,
    "error_count": 16,
    "processing_completed_at": "2026-05-01T08:12:34Z",
    "error_summary": [
      { "row": 47, "reason": "Missing ID number" }
    ]
  }
}
```

---

## Shared — Audit Logs

### `GET /logs`
Query audit logs.

**Auth required:** Yes (any admin — filtered by module based on role)  
**Query params:** `module`, `action`, `entity_type`, `entity_id`, `actor_id`, `from`, `to`, `limit`, `cursor`  
**Response 200:** Paginated audit log entries

---

## Shared — Alerts

### `GET /alerts`
List unresolved alerts.

**Auth required:** Yes (any admin — filtered by module)  
**Query params:** `module`, `severity`, `status` ('active'|'acknowledged'|'resolved')  
**Response 200:** Array of alerts

---

### `PATCH /alerts/:id`
Acknowledge or resolve an alert.

**Auth required:** Yes (any admin)  
**Request:** `{ "action": "acknowledge" | "resolve", "notes": "optional" }`  
**Response 200:** Updated alert

---

## Shared — System Configuration

### `GET /config`
Get all system configuration values.

**Auth required:** Yes (super_admin only)  
**Response 200:** Array of config entries grouped by module

---

### `PATCH /config/:key`
Update a configuration value.

**Auth required:** Yes (super_admin only)  
**Request:** `{ "value": "new_value" }`  
**Response 200:** Updated config entry + audit log entry created

---

## Shared — Admin Users

### `GET /admin/users`
List all admin users.

**Auth required:** Yes (super_admin only)  
**Response 200:** Array of admin users (no password hashes)

---

### `POST /admin/users`
Create a new admin user.

**Auth required:** Yes (super_admin only)  
**Request:**
```json
{
  "email": "new.admin@boxer.co.za",
  "full_name": "Jane Admin",
  "role": "m1_admin"
}
```

**Response 201:** Created user (setup email sent automatically)

---

### `PATCH /admin/users/:id`
Update or deactivate an admin user.

**Auth required:** Yes (super_admin only)  
**Request:** Subset of user fields  
**Response 200:** Updated user

---

## API Error Codes Reference

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Login failed — employee number/ID or email/password mismatch |
| `ACCOUNT_LOCKED` | 429 | Account locked after max failed login attempts |
| `TOKEN_EXPIRED` | 401 | JWT has expired |
| `TOKEN_INVALID` | 401 | JWT cannot be verified |
| `INSUFFICIENT_PERMISSIONS` | 403 | Role does not permit this action |
| `ACTIVE_RENTAL_EXISTS` | 403 | Employee already has an active rental |
| `BATCH_CLOSED` | 403 | Batch cut-off has passed; no new applications accepted |
| `EMPLOYEE_NOT_ELIGIBLE` | 403 | Employee not on current whitelist |
| `OTP_INVALID` | 400 | OTP value does not match |
| `OTP_EXPIRED` | 410 | OTP has expired |
| `OTP_MAX_ATTEMPTS` | 429 | Max OTP attempts exceeded for this event |
| `STOCK_UNAVAILABLE` | 409 | Phone model out of stock |
| `TERMS_NOT_ACCEPTED` | 400 | Application submitted without T&C acceptance |
| `VALIDATION_ERROR` | 422 | Request body failed schema validation (details included) |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `FILE_FORMAT_INVALID` | 400 | Uploaded file is not the expected format |
| `FILE_MISSING_COLUMNS` | 400 | Required columns absent from uploaded file |
| `SERVER_ERROR` | 500 | Unexpected server error (logged, alert triggered) |

---

## Rate Limiting

Applied per IP address. Limits are configurable.

| Endpoint group | Limit | Window |
|---------------|-------|--------|
| `POST /auth/*` | 10 requests | 15 minutes |
| `POST /m1/otp/*` | 5 requests | 10 minutes |
| General API | 200 requests | 1 minute |
| File upload | 5 requests | 1 hour |
