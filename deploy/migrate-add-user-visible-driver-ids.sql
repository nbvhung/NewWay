-- Migration: thêm cột visible_driver_ids (TEXT[]) — giới hạn tài khoản admin xem dữ liệu theo từng xe/lái xe
-- Chạy trên DB production (container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS visible_driver_ids TEXT[];"

ALTER TABLE users ADD COLUMN IF NOT EXISTS visible_driver_ids TEXT[];