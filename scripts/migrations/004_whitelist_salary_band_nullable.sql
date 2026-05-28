-- ============================================================
-- Migration 004: Allow null salary_band on whitelist_records
-- Employees with all salary band flags FALSE are still stored
-- so they can log in and see "not eligible" rather than being
-- rejected at the auth step.
-- ============================================================

ALTER TABLE whitelist_records
  ALTER COLUMN salary_band DROP NOT NULL;
