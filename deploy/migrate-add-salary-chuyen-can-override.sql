-- Lương tháng: cho phép sửa tay mức chuyên cần của từng lái xe trong tháng.
--   chuyen_can_override = NULL → dùng mức mặc định theo chính sách chuyên cần
--   chuyen_can_override = số  → dùng đúng số HR/Admin nhập
-- Idempotent: chạy nhiều lần không lỗi.

ALTER TABLE salary_records
  ADD COLUMN IF NOT EXISTS chuyen_can_override numeric(15,2) NULL;
