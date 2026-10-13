-- ════════════════════════════════════════════════════════════════════
-- Migration: Nhật ký thao tác (audit_logs) — ghi ai bấm nút gì, lúc nào.
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < migrate-add-audit-log.sql
-- An toàn chạy lại nhiều lần (IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT,
  username   VARCHAR(100) NOT NULL DEFAULT '',
  full_name  VARCHAR(255) NOT NULL DEFAULT '',
  role       VARCHAR(20)  NOT NULL DEFAULT '',
  method     VARCHAR(10)  NOT NULL DEFAULT '',
  path       VARCHAR(500) NOT NULL DEFAULT '',
  action     VARCHAR(255) NOT NULL DEFAULT '',
  status     INT          NOT NULL DEFAULT 0,
  ip         VARCHAR(60)  NOT NULL DEFAULT '',
  user_agent VARCHAR(500) NOT NULL DEFAULT '',
  body       TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status);
