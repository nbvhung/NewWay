-- Migration: BHXH - NLĐ chuyển từ số tiền VNĐ cố định sang tỷ lệ % (tính theo lương cứng từng lái xe)
-- Cột bhxh_nld giữ nguyên tên, chỉ đổi ý nghĩa: giờ lưu tỷ lệ % (mặc định 10.5), không lưu số tiền.
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-bhxh-percent.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-bhxh-percent.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

-- 1) Đặt giá trị mặc định là 10,5%
ALTER TABLE salary_settings ALTER COLUMN bhxh_nld SET DEFAULT 10.5;

-- 2) Cập nhật giá trị cũ: nếu đang là 0 (chưa từng nhập) thì đặt về 10,5%.
--    Lưu ý: nếu đã nhập số tiền BHXH cũ (VD 735000) thì KHÔNG tự động chuyển đổi,
--    cần nhập lại đúng tỷ lệ % trên web sau khi deploy.
UPDATE salary_settings SET bhxh_nld = 10.5 WHERE bhxh_nld = 0;