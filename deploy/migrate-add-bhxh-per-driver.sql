-- Migration: Thêm ô tick "đóng bảo hiểm" (BHXH) theo từng lái xe
-- users.pay_bhxh        : giá trị nền mặc định của lái xe (true = có đóng)
-- salary_records.has_bhxh: trạng thái theo từng tháng (true = có trừ BHXH)
-- Chạy trên DB production:
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-bhxh-per-driver.sql
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_bhxh BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS has_bhxh BOOLEAN NOT NULL DEFAULT true;