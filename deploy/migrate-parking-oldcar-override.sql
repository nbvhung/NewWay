-- Migration: Phụ cấp Xe cũ & Gửi xe HPH2 có số tiền riêng theo từng lái xe (override)
-- salary_records.old_car_allowance: số tiền xe cũ riêng (NULL = dùng giá trị chung)
-- salary_records.parking_hph2: số tiền gửi xe riêng (NULL = dùng giá trị chung)
-- Chạy trên VPS (container newway-postgres-1, user `postgres`):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < migrate-parking-oldcar-override.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS old_car_allowance NUMERIC(15,2) NULL;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS parking_hph2 NUMERIC(15,2) NULL;