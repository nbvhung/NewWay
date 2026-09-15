-- ════════════════════════════════════════════════════════════════════
-- Migration: Đơn giá theo tuyến đường (2026-09)
-- An toàn chạy lại nhiều lần (IF NOT EXISTS).
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < migrate-add-customer-price-route.sql
-- ════════════════════════════════════════════════════════════════════

-- route_name = '' nghĩa là đơn giá CHUNG (áp dụng mọi tuyến).
-- route_name = '<tên tuyến>' là đơn giá riêng cho tuyến đó (ưu tiên hơn giá chung).
ALTER TABLE customer_prices
  ADD COLUMN IF NOT EXISTS route_name VARCHAR(255) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_customer_prices_route
  ON customer_prices (customer_id, month, year, route_name);
