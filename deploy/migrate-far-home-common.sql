-- Migration: Phụ cấp nhà xa thành GIÁ TRỊ CHUNG + tick theo từng lái xe
-- 1) salary_settings.allowance_far_home: giá trị chung (VNĐ/tháng) ở khối Lương và Phụ cấp
-- 2) salary_records.has_far_home: tick bật/tắt theo lái xe
-- 3) salary_records.allowance_far_home: đổi thành override riêng (nullable); NULL = dùng giá trị chung
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-far-home-common.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-far-home-common.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

ALTER TABLE salary_settings ADD COLUMN IF NOT EXISTS allowance_far_home NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS has_far_home BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE salary_records ALTER COLUMN allowance_far_home DROP NOT NULL;