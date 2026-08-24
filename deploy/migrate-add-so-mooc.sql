-- Migration: Thêm Số mooc cho lái xe (tab Lương Tháng / BANG LUONG LX)
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-so-mooc.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-add-so-mooc.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới,
-- nếu không tab Thành phần Lương sẽ báo "Lỗi server nội bộ".

ALTER TABLE users ADD COLUMN IF NOT EXISTS so_mooc VARCHAR(50) NOT NULL DEFAULT '';