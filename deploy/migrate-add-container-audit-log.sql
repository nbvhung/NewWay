-- Lịch sử XOÁ container (container_audit_logs)
--
-- Vì sao cần: xoá container_imports làm mất dòng trên bảng kê Excel
-- "Container - Người chạy", mà trước đây không lưu lại dấu vết nào
-- (không audit, backend không log request) nên không truy được ai xoá.
--
-- Chạy trên DB production (container VPS):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway \
--     < deploy/migrate-add-container-audit-log.sql
--
-- An toàn để chạy lại nhiều lần (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS container_audit_logs (
  id SERIAL PRIMARY KEY,
  container_import_id INT NULL,
  container_code VARCHAR(20) NOT NULL DEFAULT '',
  container_type VARCHAR(20) NOT NULL DEFAULT '',
  shipping_line_id INT NULL,
  shipping_line_name VARCHAR(255) NOT NULL DEFAULT '',
  submission_id INT NULL,
  bundle_id VARCHAR(50) NULL,
  claim_count INT NOT NULL DEFAULT 0,
  claim_types VARCHAR(255) NOT NULL DEFAULT '',
  action VARCHAR(30) NOT NULL DEFAULT 'DELETE',
  performed_by_id INT NULL,
  performed_by_name VARCHAR(255) NOT NULL DEFAULT '',
  changes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_container_audit_container
  ON container_audit_logs (container_import_id);

CREATE INDEX IF NOT EXISTS idx_container_audit_code
  ON container_audit_logs (container_code);

CREATE INDEX IF NOT EXISTS idx_container_audit_action
  ON container_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_container_audit_created
  ON container_audit_logs (created_at);
