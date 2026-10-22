-- Lương tháng: cho phép mỗi lái xe có tỷ lệ BHXH NLĐ riêng.
--   bhxh_percent = NULL  → dùng mức chung `salary_settings.bhxh_nld`
--   bhxh_percent = số    → dùng tỷ lệ riêng của lái xe trong tháng đó
-- Idempotent: chạy nhiều lần không lỗi.

ALTER TABLE salary_records
  ADD COLUMN IF NOT EXISTS bhxh_percent numeric(5,2) NULL;
