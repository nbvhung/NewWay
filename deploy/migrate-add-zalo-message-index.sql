-- Migration: index zalo_messages.zalo_user_id cho truy vấn tự khôi phục liên kết Zalo
-- Chạy trên DB production:
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-zalo-message-index.sql

CREATE INDEX IF NOT EXISTS idx_zalo_messages_zalo_user ON zalo_messages (zalo_user_id);