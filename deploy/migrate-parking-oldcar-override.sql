-- Migration: Phụ cấp Xe cũ & Gửi xe HPH2 có số tiền riêng theo từng lái xe (override)
-- salary_records.old_car_allowance: số tiền xe cũ riêng (NULL = dùng giá trị chung)
-- salary_records.parking_hph2: số tiền gửi xe riêng (NULL = dùng giá trị chung)
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-parking-oldcar-override.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-parking-oldcar-override.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS old_car_allowance NUMERIC(15,2) NULL;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS parking_hph2 NUMERIC(15,2) NULL;