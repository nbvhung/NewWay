-- Migration: Add driver advance salary (tạm ứng) feature
-- Chạy lệnh: psql -U newway_app -d newway -f migrate-add-driver-advance.sql

-- 1. Bảng tạm ứng
CREATE TABLE IF NOT EXISTS driver_advances (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    monthly_deduction NUMERIC(15,2) NOT NULL DEFAULT 0,
    note TEXT,
    date DATE NOT NULL,
    deduct_start DATE,
    is_paid_off BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_advances_driver ON driver_advances(driver_id);

-- 2. Thêm cột vào salary_records
ALTER TABLE salary_records
    ADD COLUMN IF NOT EXISTS advance_deduct NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS advance_deduct_overridden BOOLEAN NOT NULL DEFAULT FALSE;

SELECT 'Migration completed: driver_advances table + salary_records columns' AS status;
