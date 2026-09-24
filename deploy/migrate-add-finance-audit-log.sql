-- Lịch sử chỉnh sửa chi phí tài chính (finance_audit_logs)
CREATE TABLE IF NOT EXISTS finance_audit_logs (
  id SERIAL PRIMARY KEY,
  month INT NOT NULL,
  year INT NOT NULL,
  user_id INT NOT NULL,
  edited_by_id INT NULL,
  edited_by_name VARCHAR(255) NOT NULL DEFAULT '',
  changes TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_entry
  ON finance_audit_logs (month, year, user_id);
