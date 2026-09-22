-- Migration: thêm đơn giá deal + trạng thái duyệt giá cho kế hoạch
-- Chạy trên DB production (container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -c "ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS dealed_prices JSONB; ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS price_status VARCHAR(20) DEFAULT 'none'; ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS price_approved_by INT; ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS price_approved_at TIMESTAMP;"

ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS dealed_prices JSONB;
ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS price_status VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS price_approved_by INT;
ALTER TABLE shipping_lines ADD COLUMN IF NOT EXISTS price_approved_at TIMESTAMP;