-- ============================================================
-- Migration 005: Enable RLS on all remaining public tables
--
-- Migration 001 enabled RLS on users, whitelist_records,
-- applications, rentals, and sessions. The 11 tables below
-- were missed and are directly accessible via the anon key
-- through PostgREST.
--
-- All backend access uses the service_role key, which bypasses
-- RLS entirely — no policies are needed. Enabling RLS with no
-- policies means anon/authenticated have zero access while the
-- backend is completely unaffected.
-- ============================================================

ALTER TABLE roles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist_uploads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_managers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores                ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_models          ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_phone_catalogue ENABLE ROW LEVEL SECURITY;
