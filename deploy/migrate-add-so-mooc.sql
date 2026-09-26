-- Migration: Thêm Số mooc cho lái xe (tab Lương Tháng / BANG LUONG LX)
-- Chạy trên VPS (container newway-postgres-1, user `postgres`):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < migrate-add-so-mooc.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới,
-- nếu không tab Thành phần Lương sẽ báo "Lỗi server nội bộ".

ALTER TABLE users ADD COLUMN IF NOT EXISTS so_mooc VARCHAR(50) NOT NULL DEFAULT '';