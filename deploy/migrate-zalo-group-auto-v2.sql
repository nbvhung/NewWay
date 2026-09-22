-- ════════════════════════════════════════════════════════════════════
-- Migration: Cơ chế tin giao ca nhóm v2 — gửi 2 mốc gần thời điểm ghi cont đầu
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < migrate-zalo-group-auto-v2.sql
-- An toàn chạy lại nhiều lần (IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════

-- Đánh dấu tin hẹn giờ do cơ chế tự động tạo (tin giao ca nhóm 2 mốc).
ALTER TABLE zalo_scheduled_messages ADD COLUMN IF NOT EXISTS is_auto BOOLEAN NOT NULL DEFAULT false;

-- Thứ tự mốc trong chu kỳ tự động (1, 2).
ALTER TABLE zalo_scheduled_messages ADD COLUMN IF NOT EXISTS section_no INTEGER;

-- Dọn tin giao ca nhóm TỰ ĐỘNG của cơ chế cũ (lặp 4 mốc hằng ngày):
-- target_type='group', created_by IS NULL (do cơ chế tự tạo), repeat_daily=TRUE.
-- Chỉ huỷ tin chưa gửi (pending/processing); tin đã gửi giữ lại lịch sử.
UPDATE zalo_scheduled_messages
SET status = 'cancelled'
WHERE target_type = 'group'
  AND created_by IS NULL
  AND repeat_daily = TRUE
  AND status IN ('pending', 'processing');