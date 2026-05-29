-- Categories are now data-driven, not a hard-coded enum.
-- Admins can add/edit categories without a code deploy.

CREATE TABLE store_categories (
  key             varchar(50)  PRIMARY KEY,
  label           varchar(255) NOT NULL,
  is_single_store boolean      NOT NULL DEFAULT false,
  display_order   integer      NOT NULL DEFAULT 99,
  is_active       boolean      NOT NULL DEFAULT true,
  created_at      timestamptz  DEFAULT now()
);

INSERT INTO store_categories (key, label, is_single_store, display_order) VALUES
  ('supermarket_mini',    'Supermarket / Mini',    false, 1),
  ('liquor',              'Liquor',                false, 2),
  ('build',               'Build',                 false, 3),
  ('distribution_center', 'Distribution Center',   false, 4),
  ('meat_factory',        'Meat Factory',          true,  5),
  ('head_office',         'Head Office',           true,  6);

-- Drop the hard-coded CHECK constraint — app now validates against store_categories.
-- Postgres auto-names inline column checks as {table}_{column}_check.
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_category_check;

-- Grant access to Supabase API roles.
-- migration 001's GRANT ALL ON ALL TABLES only covered tables that existed at that time.
GRANT ALL ON TABLE store_categories TO anon, authenticated, service_role;
