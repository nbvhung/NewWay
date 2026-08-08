-- Migration: thêm cột bundle_id cho tính năng "Bó container"
-- Chạy trên DB production (server công ty) bằng user newway_migrate:
--   psql "postgres://newway_migrate:...@.../newway" -f migrate-add-bundle-id.sql

ALTER TABLE container_imports ADD COLUMN IF NOT EXISTS bundle_id VARCHAR(50) NULL;

CREATE INDEX IF NOT EXISTS idx_container_imports_bundle
  ON container_imports (bundle_id, shipping_line_id);
