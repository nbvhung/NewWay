-- Migration: Tạo bảng finance_entries
-- Chạy khi deploy version có FinanceModule

CREATE TABLE IF NOT EXISTS finance_entries (
  id          SERIAL PRIMARY KEY,
  month       INT NOT NULL,
  year        INT NOT NULL,
  sua_chua    DECIMAL DEFAULT 0,
  nhien_lieu  DECIMAL DEFAULT 0,
  cp_khac     DECIMAL DEFAULT 0,
  von_xe      DECIMAL DEFAULT 0,
  von_mooc    DECIMAL DEFAULT 0,
  von_khac    DECIMAL DEFAULT 0,
  note        VARCHAR(500),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(month, year)
);
