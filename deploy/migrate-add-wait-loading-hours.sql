-- Migration: Phụ cấp chờ đóng hàng tính theo GIỜ (rate chung toàn công ty) + Phụ cấp nhà xa thành tick
-- 1) salary_settings.allowance_wait_loading_rate: giá chung (VNĐ/giờ) ở khối Lương và Phụ cấp
-- 2) salary_records.has_wait_loading + wait_loading_hours: tick + số tiếng theo từng lái xe
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-wait-loading-hours.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-add-wait-loading-hours.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.
-- Các cột cũ (salary_records.allowance_wait_loading_rate, wait_loading_count) giữ nguyên nhưng không còn dùng.

ALTER TABLE salary_settings ADD COLUMN IF NOT EXISTS allowance_wait_loading_rate NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS has_wait_loading BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS wait_loading_hours INTEGER NOT NULL DEFAULT 0;