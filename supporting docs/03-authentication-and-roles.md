# 03 — Authentication & Roles

**Version:** 1.0  
**Date:** 2026-05-13

---

## Overview

The platform has one login entry point serving all user types. A smart login form presents two authentication paths. After successful authentication, all users receive a JWT token with a role claim that determines which dashboard they are redirected to and what data they can access.

**Core principle:** Every user type, regardless of how they authenticate, ends up with a JWT. The frontend reads the role from the JWT and renders the appropriate interface. The backend validates the JWT and enforces role-based access on every API call.

---

## User Types

There are five distinct user types in the system. Two authenticate with employee number + ID number. Three authenticate with email + password.

| User Type | Auth Method | Module Access | Primary Purpose |
|-----------|------------|---------------|-----------------|
| **Employee** | Employee# + ID# (vs whitelist) | Module 1 only | Apply for a phone, view rental status |
| **Store Manager** | Employee# + ID# (vs store manager file) | Module 1 only | Confirm deliveries for their store |
| **M1 Admin** | Email + Password | Module 1 full | Manage whitelist, batches, stock, orders, reports |
| **M2 Admin** | Email + Password | Module 2 full | Manage bill processing, review queue, store accounts |
| **Super Admin** | Email + Password | Everything | Full access to both modules, system config, user management, all logs |

> **Note:** A single admin user account can hold only one role at a time. If the nominated person needs M1 and M2 access, they are assigned Super Admin or a combined admin role — not two accounts.

---

## Role Definitions

### Role: `employee`

Assigned dynamically at login. Not stored in a `users` table — employees are validated against the hashed `whitelist_records` table.

**Can:**
- View the phone application form (filtered to their eligible models)
- Submit an application
- View their current application status
- Cancel their application (before batch cut-off)
- View their active rental dashboard (payments made, remaining, status)
- View/update their contact number

**Cannot:**
- See any other employee's data
- Access any admin functions
- Access Module 2

**Session duration:** 4 hours, no refresh token

---

### Role: `store_manager`

Assigned dynamically at login. Validated against the hashed `store_managers` table (populated from the monthly Store Admin Manager file upload).

**Can:**
- View all pending and confirmed deliveries for their assigned store
- Confirm receipt of phone from courier (triggers delivery event)
- Confirm phone has been handed to employee (triggers final delivery event)
- View order history for their store

**Cannot:**
- See deliveries for other stores
- Access any application or whitelist data
- Access Module 2

**Session duration:** 8 hours (covers a full store shift), no refresh token

---

### Role: `m1_admin`

Stored in the `users` table with role `m1_admin`.

**Can:**
- Upload and manage the monthly whitelist file
- Upload the monthly leavers file
- Upload the monthly store manager details file
- Manage phone catalogue and stock levels
- View all applications (current batch and history)
- Review and approve the batch summary before orders are raised
- Generate and download the payroll deductions file
- View and manage all orders and their status
- View all active rentals
- View the leavers management dashboard
- Manage pay@ reconciliation
- Generate and download M1 reports
- View M1 audit logs

**Cannot:**
- Access Module 2
- Manage admin user accounts
- Access system configuration
- View authentication logs for admin users

---

### Role: `m2_admin`

Stored in the `users` table with role `m2_admin`.

**Can:**
- Manage the active store account list (add, edit, deactivate stores)
- View all bill processing status (received, parsing, review, submitted)
- Access the human review queue (review extracted fields, approve/reject)
- View the municipality format library
- Add or update municipality parsing rules
- View all Excel output files
- View submission status and logs
- Generate M2 reports
- View M2 audit logs

**Cannot:**
- Access Module 1
- Manage admin user accounts
- Access system configuration

---

### Role: `super_admin`

Stored in the `users` table with role `super_admin`.

**Can:** Everything. Full access to all features of both modules plus:
- Admin user management (create, edit, deactivate admin accounts)
- System configuration (batch cut-off time, OTP expiry, alert thresholds, etc.)
- Full audit log access across all modules
- Alert configuration (set thresholds, manage notification recipients)
- Report recipient management
- View infrastructure health indicators

**This role should be held by the project owner and/or the lead developer only.**

---

### Role: `m2_reviewer` (optional — Phase 1 consideration)

If the team wants to separate the bill review function from full M2 administration, a reviewer role can be added.

**Can:**
- Access the human review queue only
- Approve or reject extracted bill fields
- Add notes to extractions

**Cannot:**
- Manage stores, formats, or submission settings
- View admin dashboards beyond the review queue

> **Decision required:** Whether to implement `m2_reviewer` as a separate role or keep all Module 2 staff as `m2_admin`. Recommended for Phase 1: keep it simple — use `m2_admin` only and add `m2_reviewer` in Phase 2 if needed.

---

## Access Control Matrix

| Feature | employee | store_manager | m1_admin | m2_admin | super_admin |
|---------|----------|--------------|----------|----------|-------------|
| **Module 1** | | | | | |
| Phone application form | Own only | — | View all | — | View all |
| Application status | Own only | — | View all | — | View all |
| Cancel application | Own only (pre-cutoff) | — | Any | — | Any |
| Rental dashboard | Own only | — | View all | — | View all |
| Whitelist upload | — | — | Yes | — | Yes |
| Leavers file upload | — | — | Yes | — | Yes |
| Store manager file upload | — | — | Yes | — | Yes |
| Phone catalogue management | — | — | Yes | — | Yes |
| Stock management | — | — | Yes | — | Yes |
| Batch overview | — | — | Yes | — | Yes |
| Batch approval | — | — | Yes | — | Yes |
| Order management | — | — | Yes | — | Yes |
| Rental management | — | — | Yes | — | Yes |
| Leaver management | — | — | Yes | — | Yes |
| Delivery confirmation | — | Own store only | View all | — | View all |
| Pay@ reconciliation | — | — | Yes | — | Yes |
| M1 reports | — | — | Yes | — | Yes |
| **Module 2** | | | | | |
| Bill processing status | — | — | — | Yes | Yes |
| Bill review queue | — | — | — | Yes | Yes |
| Store account management | — | — | — | Yes | Yes |
| Municipality format library | — | — | — | Yes | Yes |
| Excel output files | — | — | — | Yes | Yes |
| Submission management | — | — | — | Yes | Yes |
| M2 reports | — | — | — | Yes | Yes |
| **Shared / System** | | | | | |
| Unified audit log | — | — | M1 only | M2 only | Full |
| Admin user management | — | — | — | — | Yes |
| System configuration | — | — | — | — | Yes |
| Alert configuration | — | — | — | — | Yes |
| Report recipient config | — | — | M1 only | M2 only | Full |
| Platform health dashboard | — | — | — | — | Yes |

---

## Login Flow — Detailed

### Path A: Employee / Store Manager Login

```
1. User navigates to /login
2. User selects "Employee / Store Manager" tab
3. User enters Employee Number and ID Number
4. Frontend sends POST /auth/employee
5. Backend:
   a. Hash employee number with bcrypt (cost 12)
   b. Hash ID number with bcrypt (cost 12)
   c. Query whitelist_records WHERE is_current = true
      AND employee_number_hash matches
      AND id_number_hash matches
   d. If match found in whitelist_records → role = 'employee'
   e. If no whitelist match, query store_managers WHERE is_current = true
      AND employee_number_hash matches
      AND id_number_hash matches
   f. If match found in store_managers → role = 'store_manager'
   g. If no match found → return 401 Unauthorized
6. On success:
   a. Create session record in sessions table
   b. Issue JWT: { role, employee_number_hash, display_name, store_code (if SM) }
   c. Return JWT + user profile (display name, place of work, store name)
7. Frontend:
   a. Store JWT in httpOnly cookie (not localStorage — POPIA/XSS protection)
   b. Redirect:
      - employee → /portal/apply (if no active application/rental)
                   /portal/dashboard (if active application or rental)
      - store_manager → /store/dashboard
```

> **bcrypt comparison note:** bcrypt comparison is computationally expensive by design. For two fields, expect ~300–500ms per login. This is acceptable — it is a security feature. Do not use a lower cost factor to speed this up.

### Path B: Admin Login

```
1. User navigates to /login
2. User selects "Administrator" tab
3. User enters Email and Password
4. Frontend sends POST /auth/admin
5. Backend:
   a. Query users WHERE email = input AND is_active = true
   b. Compare password using bcrypt.compare()
   c. If no match → return 401 Unauthorized
   d. If max failed attempts reached → return 429, lock account
6. On success:
   a. Create session record
   b. Issue JWT: { role, user_id, full_name, email }
   c. Issue refresh token (httpOnly cookie, 7 days)
   d. Return JWT + user profile
7. Frontend:
   a. Store JWT in httpOnly cookie
   b. Redirect based on role:
      - super_admin → /admin/dashboard
      - m1_admin → /admin/module1/dashboard
      - m2_admin → /admin/module2/dashboard
```

---

## JWT Structure

### Employee JWT Payload
```json
{
  "sub": "session_id",
  "type": "employee",
  "role": "employee",
  "employee_number_hash": "hashed_value",
  "display_name": "John Sithole",
  "place_of_work": "Boxer Superstore - Soweto",
  "store_code": "SOW001",
  "salary_band": "B3",
  "eligible_model_ids": ["uuid1", "uuid2"],
  "iat": 1715000000,
  "exp": 1715014400
}
```

### Store Manager JWT Payload
```json
{
  "sub": "session_id",
  "type": "store_manager",
  "role": "store_manager",
  "employee_number_hash": "hashed_value",
  "display_name": "Jane Mokoena",
  "store_code": "SOW001",
  "store_name": "Boxer Superstore - Soweto",
  "iat": 1715000000,
  "exp": 1715028800
}
```

### Admin JWT Payload
```json
{
  "sub": "session_id",
  "type": "admin",
  "role": "super_admin",
  "user_id": "uuid",
  "full_name": "Chris Lombard",
  "email": "chris@boxer.co.za",
  "iat": 1715000000,
  "exp": 1715000900
}
```

> **Security note:** JWT access tokens expire in 15 minutes for admins and 4–8 hours for employees/store managers. Admin sessions use refresh tokens. Employee/store manager sessions do not — they must re-authenticate after expiry. JWTs are stored in httpOnly, SameSite=Strict cookies. Never in localStorage.

---

## Password Policy (Admin Users Only)

- Minimum 12 characters
- Must contain: uppercase, lowercase, number, special character
- Enforced via Zod schema on the backend
- Passwords hashed with bcrypt (cost factor 12)
- Failed login attempts: locked after 5 consecutive failures (configurable via system_config)
- No password rotation requirement for Phase 1, but Super Admin can force a reset

---

## Session Management

| User Type | Access Token Expiry | Refresh Token | Idle Timeout |
|-----------|--------------------|--------------| -------------|
| Employee | 4 hours | No | 30 minutes (configurable) |
| Store Manager | 8 hours | No | 30 minutes (configurable) |
| M1 Admin | 15 minutes | 7 days | 60 minutes (configurable) |
| M2 Admin | 15 minutes | 7 days | 60 minutes (configurable) |
| Super Admin | 15 minutes | 7 days | 30 minutes (configurable) |

All session events (login, logout, expiry, refresh) are written to `audit_logs`.

---

## POPIA-Relevant Authentication Notes

1. **No raw PII in the database.** Employee numbers and ID numbers are bcrypt-hashed before storage and before any comparison. The hash is one-way and cannot be reversed.
2. **No raw PII in JWTs.** JWTs carry `employee_number_hash`, not the actual employee number or ID number.
3. **No raw PII in logs.** Audit log entries reference `employee_number_hash`, not plain text employee numbers or ID numbers.
4. **Display name is the only plaintext personal field.** First name + last name are stored as-is to allow the "confirm your identity" display on the application form. This is the minimum necessary for the confirmation UX.
5. **All authentication events are logged** with timestamp, session type, hash reference, and outcome.

---

## Admin Dashboard Navigation — Role-Aware Sidebar

The admin dashboard sidebar renders dynamically based on role:

```
Super Admin sidebar:
  ├── Overview (both modules)
  ├── Module 1
  │   ├── Applications
  │   ├── Batch Processing
  │   ├── Orders
  │   ├── Rentals
  │   ├── Stock
  │   ├── Leavers
  │   ├── Whitelist
  │   └── Reports
  ├── Module 2
  │   ├── Bills
  │   ├── Review Queue
  │   ├── Stores
  │   ├── Municipality Formats
  │   └── Reports
  ├── System
  │   ├── Audit Logs (all)
  │   ├── Users
  │   ├── Alerts
  │   └── Configuration

M1 Admin sidebar:
  ├── Overview (Module 1)
  ├── Module 1 (same as above)
  └── Audit Logs (M1 only)

M2 Admin sidebar:
  ├── Overview (Module 2)
  ├── Module 2 (same as above)
  └── Audit Logs (M2 only)
```

---

## Initial Admin User Setup

On first deployment, the Super Admin account is seeded via an environment variable or a one-time setup script. This account is created before any other user exists. All subsequent admin accounts are created via the Super Admin user management screen.

```bash
# Environment variable for seed
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=  # temporary, must be changed on first login
```

The seed script runs once (`npm run seed:admin`) and is idempotent — it does not overwrite an existing super admin account.
