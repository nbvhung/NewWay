-- Migration: thêm cột bundle_id cho tính năng "Bó container"
-- Chạy trên VPS (container newway-postgres-1, user `postgres`):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < migrate-add-bundle-id.sql

ALTER TABLE container_imports ADD COLUMN IF NOT EXISTS bundle_id VARCHAR(50) NULL;

CREATE INDEX IF NOT EXISTS idx_container_imports_bundle
  ON container_imports (bundle_id, shipping_line_id);
