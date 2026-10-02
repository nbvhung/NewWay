-- ============================================================
-- Migration: Thêm cột ngay_hoat_dong vào bảng users
-- Ngày: 02/10/2026
-- Mô tả: Lưu ngày xe/lái xe đi vào hoạt động (DATE nullable).
-- Chạy: docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < deploy/migrate-add-ngay-hoat-dong.sql
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ngay_hoat_dong DATE DEFAULT NULL;

-- Xác nhận
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'ngay_hoat_dong';
