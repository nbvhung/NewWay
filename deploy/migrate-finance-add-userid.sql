-- Migration: thêm user_id vào finance_entries, đổi unique constraint

-- 1. Thêm cột user_id nếu chưa có
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 0;

-- 2. Xóa unique constraint cũ (chỉ month+year) - tìm và xóa theo tên
DO $body$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'finance_entries'
    AND c.contype = 'u'
    AND c.conname NOT LIKE '%user_id%'
  LIMIT 1;
  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE finance_entries DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
END
$body$;

-- 3. Thêm unique constraint mới (month, year, user_id)
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'finance_entries_month_year_user_id_key'
  ) THEN
    ALTER TABLE finance_entries ADD CONSTRAINT finance_entries_month_year_user_id_key UNIQUE (month, year, user_id);
  END IF;
END
$body$;

-- Xác nhận
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'finance_entries' ORDER BY ordinal_position;
