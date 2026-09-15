-- ════════════════════════════════════════════════════════════════════
-- Migration: Khách hàng & Doanh thu + Zalo Group (2026-09)
-- An toàn chạy lại nhiều lần (IF NOT EXISTS / DROP NOT NULL).
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -f /tmp/migrate.sql
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Khách hàng ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  phone          VARCHAR(50)  DEFAULT '',
  email          VARCHAR(255) DEFAULT '',
  address        VARCHAR(500) DEFAULT '',
  contact_name   VARCHAR(255) DEFAULT '',
  mst            VARCHAR(50)  DEFAULT '',
  bank_name      VARCHAR(255) DEFAULT '',
  bank_account   VARCHAR(100) DEFAULT '',
  status         VARCHAR(20)  DEFAULT 'active',
  type           VARCHAR(20)  DEFAULT 'customer',
  note           TEXT         DEFAULT '',
  created_at     TIMESTAMP    DEFAULT now(),
  updated_at     TIMESTAMP    DEFAULT now()
);

-- ─── 2. Hồ sơ thanh toán (hoá đơn) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_dossiers (
  id                SERIAL PRIMARY KEY,
  customer_id       INT NOT NULL,
  month             INT NOT NULL,
  year              INT NOT NULL,
  invoice_file_name VARCHAR(255) DEFAULT '',
  invoice_data      BYTEA,
  created_at        TIMESTAMP DEFAULT now(),
  updated_at        TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_dossiers_customer_month_year
  ON payment_dossiers (customer_id, month, year);

-- ─── 3. Đơn giá theo khách hàng + khoảng thời gian ─────────────────
CREATE TABLE IF NOT EXISTS customer_prices (
  id             SERIAL PRIMARY KEY,
  customer_id    INT NOT NULL,
  month          INT NOT NULL,
  year           INT NOT NULL,
  from_day       INT NOT NULL,
  to_day         INT NOT NULL,
  container_type VARCHAR(20) NOT NULL,
  unit_price     NUMERIC(15,2) DEFAULT 0,
  created_at     TIMESTAMP DEFAULT now(),
  updated_at     TIMESTAMP DEFAULT now()
);

-- ─── 4. Phụ phí theo khách hàng + khoảng thời gian ─────────────────
CREATE TABLE IF NOT EXISTS customer_surcharges (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  calc_type   VARCHAR(20) DEFAULT 'add',
  value       NUMERIC(15,2) DEFAULT 0,
  month       INT NOT NULL,
  year        INT NOT NULL,
  from_day    INT NOT NULL,
  to_day      INT NOT NULL,
  active      BOOLEAN DEFAULT true,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMP DEFAULT now(),
  updated_at  TIMESTAMP DEFAULT now()
);

-- ─── 5. Lịch sử thêm/sửa (audit) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_audit_logs (
  id                SERIAL PRIMARY KEY,
  customer_id       INT NOT NULL,
  entity            VARCHAR(20) NOT NULL,
  entity_id         INT,
  action            VARCHAR(20) NOT NULL,
  performed_by_id   INT,
  performed_by_name VARCHAR(255) DEFAULT '',
  changes           TEXT DEFAULT '',
  created_at        TIMESTAMP DEFAULT now()
);

-- ─── 6. Gắn khách hàng vào kế hoạch ────────────────────────────────
ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS customer_id INT;

-- ─── 7. Zalo Group (bot 3) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zalo_groups (
  id           SERIAL PRIMARY KEY,
  chat_id      VARCHAR(100) NOT NULL,
  bot_index    INT NOT NULL DEFAULT 2,
  name         VARCHAR(255),
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zalo_groups_chat_id ON zalo_groups (chat_id);

-- ─── 8. Tin nhắn hẹn giờ: hỗ trợ gửi nhóm + lặp hằng ngày ──────────
ALTER TABLE zalo_scheduled_messages ADD COLUMN IF NOT EXISTS target_type  VARCHAR(10) NOT NULL DEFAULT 'user';
ALTER TABLE zalo_scheduled_messages ADD COLUMN IF NOT EXISTS chat_id      VARCHAR(100);
ALTER TABLE zalo_scheduled_messages ADD COLUMN IF NOT EXISTS bot_index    INT NOT NULL DEFAULT 0;
ALTER TABLE zalo_scheduled_messages ADD COLUMN IF NOT EXISTS repeat_daily BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE zalo_scheduled_messages ALTER COLUMN user_id DROP NOT NULL;
