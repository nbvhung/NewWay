-- Migration: BHXH - NLD (giá trị chung) + Chi hộ (theo lái xe) trong tab Thành phần Lương
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-salary-bhxh-chiho.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-add-salary-bhxh-chiho.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới,
-- nếu không tab Thành phần Lương sẽ báo "Lỗi server nội bộ".

-- 1) BHXH - NLD: số chung toàn công ty (chưa dùng để trừ, chỉ lưu)
ALTER TABLE salary_settings ADD COLUMN IF NOT EXISTS bhxh_nld NUMERIC(15,2) NOT NULL DEFAULT 0;

-- 2) Chi hộ: số tiền công ty chi hộ/ứng trước cho lái xe (trừ vào lương), nhập theo tháng
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS chi_ho NUMERIC(15,2) NOT NULL DEFAULT 0;