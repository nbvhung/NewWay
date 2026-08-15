-- Migration: thêm cột phat_sinh cho tính năng "Container phát sinh" (mã không có trong kế hoạch)
-- Chạy trên DB production (server công ty) bằng user newway_migrate:
--   psql "postgres://newway_migrate:...@.../newway" -f migrate-add-phat-sinh.sql

ALTER TABLE container_imports ADD COLUMN IF NOT EXISTS phat_sinh BOOLEAN DEFAULT FALSE;