-- ============================================================
-- Migration 002: Batch phone catalogue + encrypted PII
-- Apply via Supabase SQL editor before deploying backend changes
-- ============================================================

-- ── phone_models: rename retail_price → cash_price if migration 001 was applied as-is ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phone_models' AND column_name = 'retail_price'
  ) THEN
    ALTER TABLE phone_models RENAME COLUMN retail_price TO cash_price;
  END IF;
END $$;

-- ── batches: pending_applications counter ─────────────────────────────────────
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS pending_applications integer DEFAULT 0;

-- ── batch_phone_catalogue ─────────────────────────────────────────────────────
-- Snapshot of phone_models taken when a batch is opened.
-- Prices are locked here for the batch lifetime — applications reference this
-- so deduction amounts never change after submission, even if phone_models is updated.
CREATE TABLE IF NOT EXISTS batch_phone_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id),
  source_model_id uuid REFERENCES phone_models(id),
  model_name varchar(100) NOT NULL,
  model_code varchar(50),
  cash_price decimal(10,2) NOT NULL,
  upfront_amount decimal(10,2) NOT NULL,
  rental_amount_7m decimal(10,2) NOT NULL,
  rental_amount_13m decimal(10,2) NOT NULL,
  display_order integer DEFAULT 0,
  is_available boolean DEFAULT true,
  UNIQUE(batch_id, source_model_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_catalogue_batch ON batch_phone_catalogue(batch_id);

-- Drop min_salary_band if it was added by an earlier partial run (column is unused)
ALTER TABLE batch_phone_catalogue DROP COLUMN IF EXISTS min_salary_band;

-- Grant service_role access (SQL-editor-created tables don't inherit automatic grants)
GRANT ALL ON public.batch_phone_catalogue TO service_role;

-- ── applications: new columns ─────────────────────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS batch_catalogue_id uuid REFERENCES batch_phone_catalogue(id),
  ADD COLUMN IF NOT EXISTS employee_number_encrypted text,
  ADD COLUMN IF NOT EXISTS id_number_encrypted text,
  ADD COLUMN IF NOT EXISTS first_name varchar(255),
  ADD COLUMN IF NOT EXISTS last_name varchar(255),
  ADD COLUMN IF NOT EXISTS email varchar(255);

-- ── whitelist_records: split display_name ────────────────────────────────────
ALTER TABLE whitelist_records
  ADD COLUMN IF NOT EXISTS first_name varchar(255),
  ADD COLUMN IF NOT EXISTS last_name varchar(255);

-- ── system_config: HR export Excel password ───────────────────────────────────
INSERT INTO system_config (module, config_key, config_value, description)
VALUES (
  'm1',
  'hr_export_password',
  'Boxer2026!',
  'Password for the HR export Excel file. Change this before go-live.'
)
ON CONFLICT (config_key) DO NOTHING;
