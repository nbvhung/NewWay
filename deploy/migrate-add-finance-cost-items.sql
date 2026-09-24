-- Bảng chi tiết chi phí (mỗi dòng = 1 khoản phát sinh)
-- Nhóm theo category: suaChua | nhienLieu | cpKhac
CREATE TABLE IF NOT EXISTS finance_cost_items (
  id                SERIAL PRIMARY KEY,
  month             INT NOT NULL,
  year              INT NOT NULL,
  user_id           INT NOT NULL,
  category          VARCHAR(20) NOT NULL,
  item_date         DATE NULL,
  name              VARCHAR(255) NOT NULL DEFAULT '',
  amount            DECIMAL(18,0) NOT NULL DEFAULT 0,
  note              VARCHAR(500) NULL,
  created_by_id     INT NULL,
  created_by_name   VARCHAR(255) NOT NULL DEFAULT '',
  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_cost_items_scope
  ON finance_cost_items (month, year, user_id, category);
