-- Migration 008: Add configurable salary threshold for 25% rule
-- ============================================================
-- Adds m1_salary_threshold_pct to system_config so super admins
-- can adjust the upfront payment threshold without a code deploy.
-- Default 25 = 25% of monthly salary (upfront <= 25% of salary).

INSERT INTO system_config (module, config_key, config_value, description) VALUES
  ('m1', 'm1_salary_threshold_pct', '25', 'Max upfront payment as % of monthly salary bracket (default 25 = 25% rule)');
