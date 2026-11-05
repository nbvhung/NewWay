ALTER TABLE customer_surcharges
  ADD COLUMN IF NOT EXISTS amount_scope VARCHAR(10) NOT NULL DEFAULT 'plan';

-- Chỉ áp dụng cho phụ phí cộng thêm (calc_type='add'):
--   'container' = cộng cho từng container (bó/kẹp tính 1, bỏ VSL/TIP)
--   'plan'      = cộng 1 lần cho cả kế hoạch, phân bổ theo doanh thu gốc
UPDATE customer_surcharges
SET amount_scope = 'plan'
WHERE calc_type = 'add' AND (amount_scope IS NULL OR amount_scope = '');

SELECT 'Migration completed: customer_surcharges.amount_scope' AS status;
