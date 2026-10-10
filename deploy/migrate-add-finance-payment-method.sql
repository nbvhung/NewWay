-- ════════════════════════════════════════════════════════════════════
-- Thêm PHƯƠNG THỨC THANH TOÁN (tiền mặt / chuyển khoản) cho khoản chi/vốn.
--   cash_amount + transfer_amount = amount  (bắt buộc bằng tổng).
--   Dòng cũ chưa có → mặc định tiền mặt = amount, chuyển khoản = 0.
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < deploy/migrate-add-finance-payment-method.sql
-- An toàn chạy lại nhiều lần (IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE finance_cost_items
  ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(18,0) NULL;
ALTER TABLE finance_cost_items
  ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC(18,0) NULL;

-- Backfill dòng cũ: tiền mặt = amount, chuyển khoản = 0.
UPDATE finance_cost_items
SET cash_amount = amount, transfer_amount = 0
WHERE cash_amount IS NULL AND transfer_amount IS NULL;

SELECT 'Migration completed: finance_cost_items.cash_amount + transfer_amount' AS status;
