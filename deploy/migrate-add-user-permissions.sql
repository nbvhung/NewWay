-- Migration: thêm cột permissions (TEXT[]) cho phân quyền theo từng tài khoản
-- Chạy trên DB production (container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[];"

ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[];