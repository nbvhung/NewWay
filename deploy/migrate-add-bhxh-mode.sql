-- ============================================================================
-- Migration: BHXH phần NGƯỜI LAO ĐỘNG đóng theo % HOẶC theo SỐ TIỀN.
--
-- Mỗi tháng, mỗi lái xe có thể đóng BHXH:
--   - 'percent' → tỷ lệ % × lương cứng (mức cũ, mặc định 10,5%).
--   - 'amount'  → số tiền cố định (VNĐ), không phụ thuộc lương cứng.
--
-- Cài đặt CHUNG nằm ở `salary_settings`; lái xe có thể ghi đè riêng trong
-- `salary_records` của từng tháng (NULL = dùng mức chung).
--
-- Idempotent — chạy lại nhiều lần an toàn. Dữ liệu cũ giữ nguyên 10,5%.
--
-- Chạy trên VPS:
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
--     < deploy/migrate-add-bhxh-mode.sql
-- ============================================================================

BEGIN;

-- Cài đặt chung: cách tính + số tiền cố định.
ALTER TABLE salary_settings
  ADD COLUMN IF NOT EXISTS bhxh_nld_mode VARCHAR(10) NOT NULL DEFAULT 'percent';

ALTER TABLE salary_settings
  ADD COLUMN IF NOT EXISTS bhxh_nld_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Ghi đè riêng của lái xe trong từng tháng.
ALTER TABLE salary_records
  ADD COLUMN IF NOT EXISTS bhxh_mode VARCHAR(10);

ALTER TABLE salary_records
  ADD COLUMN IF NOT EXISTS bhxh_amount NUMERIC(15, 2);

COMMIT;
