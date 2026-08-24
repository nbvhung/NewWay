-- Migration: Tiền gửi xe tại HPH 2 (tab Lương Tháng / BANG LUONG LX)
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-parking-hph2.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-add-parking-hph2.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới,
-- nếu không tab Thành phần Lương sẽ báo "Lỗi server nội bộ".

-- 1) Số tiền gửi xe HPH 2 chung toàn công ty
ALTER TABLE salary_settings ADD COLUMN IF NOT EXISTS parking_hph2 NUMERIC(15,2) NOT NULL DEFAULT 0;

-- 2) Lái xe có gửi xe tại HPH 2 hay không (theo từng tháng)
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS has_parking_hph2 BOOLEAN NOT NULL DEFAULT false;