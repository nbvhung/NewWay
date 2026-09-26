-- Migration: thêm cột phat_sinh cho tính năng "Container phát sinh" (mã không có trong kế hoạch)
-- Chạy trên VPS (container newway-postgres-1, user `postgres`):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < migrate-add-phat-sinh.sql

ALTER TABLE container_imports ADD COLUMN IF NOT EXISTS phat_sinh BOOLEAN DEFAULT FALSE;