-- Migration: Đánh dấu thanh toán lương cứng + toàn bộ lương tháng (nút Thanh Toán Lương Cứng / Thanh Toán Tổng)
-- Chạy trên DB production (container postgres trên VPS):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-salary-paid.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS fixed_salary_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS fixed_salary_paid_at TIMESTAMP;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS salary_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS salary_paid_at TIMESTAMP;