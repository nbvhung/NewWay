-- Migration: thêm cột zalo_bot (chỉ định bot Zalo cho tin nhắn chủ động)
-- Chạy trên DB production (container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-zalo-bot.sql
-- Hoặc chạy trực tiếp:
--   docker exec newway-postgres-1 psql -U postgres -d newway -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS zalo_bot INTEGER NOT NULL DEFAULT 0;"

ALTER TABLE users ADD COLUMN IF NOT EXISTS zalo_bot INTEGER NOT NULL DEFAULT 0;