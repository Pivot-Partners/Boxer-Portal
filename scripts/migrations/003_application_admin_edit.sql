-- ============================================================
-- Migration 003: Admin edit tracking on applications
-- Apply via Supabase SQL editor before deploying backend changes
-- ============================================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS admin_edited_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_edit_notes text,
  ADD COLUMN IF NOT EXISTS admin_editor_name varchar(255);
