-- Migration: Phụ cấp xe cũ (tab Thành phần Lương cho HR/admin/supper_admin)
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-old-car.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-add-old-car.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới,
-- nếu không tab Thành phần Lương sẽ báo "Lỗi server nội bộ".

-- 1) Số tiền phụ cấp xe cũ chung toàn công ty
ALTER TABLE salary_settings ADD COLUMN IF NOT EXISTS old_car_allowance NUMERIC(15,2) NOT NULL DEFAULT 0;

-- 2) Lái xe có xe cũ hay không (theo từng tháng)
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS has_old_car BOOLEAN NOT NULL DEFAULT false;

-- 3) Giá trị nền mặc định theo từng lái xe (kế thừa qua tháng sau)
ALTER TABLE users ADD COLUMN IF NOT EXISTS old_car BOOLEAN NOT NULL DEFAULT false;