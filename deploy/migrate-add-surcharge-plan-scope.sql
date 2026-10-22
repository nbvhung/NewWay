-- Phụ phí: cho phép chọn phụ phí áp dụng cho TẤT CẢ kế hoạch hay chỉ một số kế hoạch.
--   apply_scope = 'all'   → mọi kế hoạch của khách trong tháng + khoảng ngày (mặc định cũ)
--   apply_scope = 'plans' → chỉ các kế hoạch trong plan_ids
-- Idempotent: chạy nhiều lần không lỗi.

ALTER TABLE customer_surcharges
  ADD COLUMN IF NOT EXISTS apply_scope varchar(10) NOT NULL DEFAULT 'all';

ALTER TABLE customer_surcharges
  ADD COLUMN IF NOT EXISTS plan_ids integer[] NULL;

-- Dữ liệu cũ giữ nguyên hành vi (áp cho tất cả kế hoạch).
UPDATE customer_surcharges
SET apply_scope = 'all'
WHERE apply_scope IS NULL;
