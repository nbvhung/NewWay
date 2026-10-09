-- ════════════════════════════════════════════════════════════════════
-- Thêm cột SỐ TIỀN XUẤT HOÁ ĐƠN cho khoản chi/vốn (finance_cost_items).
--   amount = tổng khoản; invoice_amount = phần xuất được hoá đơn (≤ amount).
--   NULL = không xuất hoá đơn.
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < deploy/migrate-add-finance-invoice-amount.sql
-- An toàn chạy lại nhiều lần (IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE finance_cost_items
  ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(18,0) NULL;

SELECT 'Migration completed: finance_cost_items.invoice_amount' AS status;
