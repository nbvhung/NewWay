-- ════════════════════════════════════════════════════════════════════
-- Fix: audit_logs.created_at → timestamptz (đang lưu UTC nhưng bị hiểu là giờ VN → lệch 7h)
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < migrate-audit-log-timestamptz.sql
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE audit_logs
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE audit_logs
  ALTER COLUMN created_at SET DEFAULT now();
