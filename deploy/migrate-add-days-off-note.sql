-- Migration: Ghi chú ngày nghỉ của lái xe (hiển thị cho lái xe trong chi tiết lương)
-- Chạy trên DB production (container postgres trên VPS):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-days-off-note.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS days_off_note TEXT;