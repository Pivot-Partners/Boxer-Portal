-- ============================================================
-- Boxer Operations Portal — Initial Schema
-- Apply via Supabase SQL editor or: npm run migrate
-- ============================================================

-- Roles
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) UNIQUE NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Full access to all modules, system config, and user management'),
  ('m1_admin', 'Module 1: phone rental management'),
  ('m2_admin', 'Module 2: utility bill processing'),
  ('m2_reviewer', 'Module 2: bill review queue only');

-- Admin users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  full_name varchar(255) NOT NULL,
  is_active boolean DEFAULT true,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  last_login_at timestamptz
);

-- Sessions (both employee and admin)
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type varchar(20) NOT NULL CHECK (session_type IN ('admin', 'employee', 'store_manager')),
  user_id uuid REFERENCES users(id),
  employee_number_hash varchar(255),
  role_name varchar(50) NOT NULL,
  store_code varchar(20),
  token_hash varchar(255) UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  ip_address inet,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_sessions_token_hash ON sessions(token_hash) WHERE revoked_at IS NULL;

-- Stores ("Where do you work")
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category varchar(30) NOT NULL CHECK (category IN ('supermarket_mini','liquor','build','distribution_center','meat_factory','head_office')),
  name varchar(255) NOT NULL,
  store_code varchar(20),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_stores_category ON stores(category) WHERE is_active = true;

-- Phone models
CREATE TABLE phone_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name varchar(100) NOT NULL,
  model_code varchar(50),
  retail_price decimal(10,2) NOT NULL,
  upfront_amount decimal(10,2) NOT NULL,
  rental_amount_7m decimal(10,2) NOT NULL,
  rental_amount_13m decimal(10,2) NOT NULL,
  min_salary_band varchar(10) NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Whitelist uploads
CREATE TABLE whitelist_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name varchar(255) NOT NULL,
  storage_path varchar(500) NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz DEFAULT now(),
  record_count integer,
  valid_count integer,
  error_count integer,
  status varchar(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','active','superseded','failed')),
  notes text
);

-- Whitelist records (hashed PII)
CREATE TABLE whitelist_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES whitelist_uploads(id),
  employee_number_hash varchar(255) NOT NULL,
  id_number_hash varchar(255) NOT NULL,
  display_name varchar(255) NOT NULL,
  place_of_work varchar(255),
  store_code varchar(20),
  employment_type varchar(20) CHECK (employment_type IN ('permanent','flexi')),
  salary_band varchar(10) NOT NULL,
  eligible_model_ids jsonb NOT NULL DEFAULT '[]',
  is_current boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_whitelist_records_hashes ON whitelist_records(employee_number_hash) WHERE is_current = true;

-- Store managers
CREATE TABLE store_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid,
  employee_number_hash varchar(255) NOT NULL,
  id_number_hash varchar(255) NOT NULL,
  display_name varchar(255) NOT NULL,
  store_code varchar(20) NOT NULL,
  store_name varchar(255) NOT NULL,
  email varchar(255),
  is_current boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_store_managers_hashes ON store_managers(employee_number_hash) WHERE is_current = true;

-- OTP events
CREATE TABLE otp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number_hash varchar(255) NOT NULL,
  phone_number varchar(20) NOT NULL,
  otp_hash varchar(255) NOT NULL,
  sent_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts integer DEFAULT 0,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending','verified','expired','failed'))
);

-- Batches
CREATE TABLE batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_month date NOT NULL,
  cutoff_at timestamptz NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','processing','awaiting_approval','approved','orders_submitted','completed')),
  total_applications integer DEFAULT 0,
  valid_applications integer DEFAULT 0,
  cancelled_applications integer DEFAULT 0,
  rejected_applications integer DEFAULT 0,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  payroll_file_generated_at timestamptz,
  orders_submitted_at timestamptz,
  processing_log jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Applications
CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number varchar(20) UNIQUE NOT NULL,
  employee_number_hash varchar(255) NOT NULL,
  id_number_hash varchar(255),
  display_name varchar(255) NOT NULL,
  place_of_work varchar(255),
  store_id uuid REFERENCES stores(id),
  contact_number varchar(20),
  contact_number_updated boolean DEFAULT false,
  phone_model_id uuid NOT NULL REFERENCES phone_models(id),
  rental_term integer NOT NULL, -- 0=cash, 7=7month, 13=13month
  terms_accepted boolean DEFAULT false,
  terms_accepted_at timestamptz,
  status varchar(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cancelled_by_employee','superseded','cancelled_no_whitelist','cancelled_no_stock','validated','converted_to_order','rejected')),
  batch_id uuid REFERENCES batches(id),
  superseded_by_id uuid REFERENCES applications(id),
  otp_event_id uuid REFERENCES otp_events(id),
  otp_verified boolean DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  ip_address inet
);

CREATE INDEX idx_applications_emp_hash ON applications(employee_number_hash) WHERE status NOT IN ('cancelled_by_employee','superseded');
CREATE INDEX idx_applications_batch ON applications(batch_id, status);

-- Orders
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(20) UNIQUE NOT NULL,
  application_id uuid NOT NULL REFERENCES applications(id),
  batch_id uuid NOT NULL REFERENCES batches(id),
  employee_number_hash varchar(255) NOT NULL,
  employee_name varchar(255),
  phone_model_id uuid NOT NULL REFERENCES phone_models(id),
  rental_term integer NOT NULL,
  delivery_store_id uuid REFERENCES stores(id),
  delivery_store_name varchar(255),
  store_manager_email varchar(255),
  status varchar(30) NOT NULL DEFAULT 'created' CHECK (status IN ('created','submitted_to_suppliers','acknowledged','dispatched','delivered_to_store','handed_to_employee')),
  teljoy_submitted_at timestamptz,
  teljoy_reference varchar(100),
  g3_submitted_at timestamptz,
  g3_reference varchar(100),
  wwas_submitted_at timestamptz,
  wwas_reference varchar(100),
  confirmation_sms_sent_at timestamptz,
  store_notification_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Rentals
CREATE TABLE rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid UNIQUE NOT NULL REFERENCES orders(id),
  employee_number_hash varchar(255) NOT NULL,
  phone_model_id uuid NOT NULL REFERENCES phone_models(id),
  start_date date NOT NULL,
  term_months integer NOT NULL,
  base_monthly_amount decimal(10,2) NOT NULL,
  current_monthly_amount decimal(10,2) NOT NULL,
  total_amount decimal(10,2),
  amount_paid decimal(10,2) DEFAULT 0,
  amount_remaining decimal(10,2),
  payments_made integer DEFAULT 0,
  payments_remaining integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','leaver','completed','cancelled','written_off')),
  leaver_flag boolean DEFAULT false,
  leaver_date date,
  leaver_notification_sent_at timestamptz,
  teljoy_leaver_notified_at timestamptz,
  end_of_term_purchase_eligible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_rentals_emp_hash ON rentals(employee_number_hash) WHERE status = 'active';

-- Audit logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module varchar(20) NOT NULL CHECK (module IN ('m1','m2','shared','auth')),
  action varchar(100) NOT NULL,
  entity_type varchar(50),
  entity_id uuid,
  actor_type varchar(20),
  actor_id varchar(255),
  ip_address inet,
  user_agent text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_logs_module_created ON audit_logs(module, created_at DESC);

-- System config
CREATE TABLE system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module varchar(20) NOT NULL,
  config_key varchar(100) UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO system_config (module, config_key, config_value, description) VALUES
  ('m1', 'batch_cutoff_day', '9', 'Day of month batch closes'),
  ('m1', 'batch_cutoff_hour', '23', 'Hour (0-23) batch trigger fires'),
  ('m1', 'otp_expiry_minutes', '10', 'OTP validity window in minutes'),
  ('m1', 'otp_max_attempts', '3', 'Failed OTP attempts before lock'),
  ('m1', 'employee_session_hours', '4', 'Employee JWT expiry in hours'),
  ('shared', 'admin_max_failed_logins', '5', 'Login attempts before account lock');

-- ============================================================
-- Seed data: Phone catalogue
-- ============================================================
INSERT INTO phone_models (model_name, model_code, retail_price, upfront_amount, rental_amount_7m, rental_amount_13m, min_salary_band, display_order, is_active) VALUES
  ('Samsung A05 (Green)',  'A05-GRN', 1649, 450,  320, 180, '>3600', 1, true),
  ('Samsung A07 (Black)',  'A07-BLK', 2199, 600,  410, 230, '>3600', 2, true),
  ('Samsung A17 (Black)',  'A17-BLK', 3299, 900,  610, 340, '>3600', 3, true),
  ('Samsung A26 5G (Green)','A26-GRN', 4299, 1100, 750, 410, '>4400', 4, true);

-- ============================================================
-- Seed data: Stores
-- Run seed-stores.ts script for full list — this is a sample
-- ============================================================
INSERT INTO stores (category, name, is_active) VALUES
  ('meat_factory', 'Ballito Meat Factory', true),
  ('head_office',  'Boxer Head Office',    true);

-- ============================================================
-- Row Level Security (defence in depth)
-- Primary access control is JWT enforcement in Fastify API
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by backend only)
-- Anon key has no policies = no access
