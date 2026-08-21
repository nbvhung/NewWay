-- Migration: Thành phần Lương (tab Thành phần Lương cho HR/admin/supper_admin)
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-salary.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-add-salary.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới,
-- nếu không tab Thành phần Lương sẽ báo "Lỗi server nội bộ".

-- 1) Cột phụ cấp mặc định trên users
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowance_far_home NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowance_wait_loading NUMERIC(15,2) NOT NULL DEFAULT 0;

-- 2) Bảng cấu hình lương chung toàn công ty
CREATE TABLE IF NOT EXISTS salary_settings (
    id SERIAL PRIMARY KEY,
    fixed_salary NUMERIC(15,2) NOT NULL DEFAULT 7000000,
    attendance_bonus NUMERIC(15,2) NOT NULL DEFAULT 0,
    standard_days INTEGER NOT NULL DEFAULT 26,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 3) Bảng lương theo tháng của từng lái xe
CREATE TABLE IF NOT EXISTS salary_records (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    fixed_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
    attendance_bonus NUMERIC(15,2) NOT NULL DEFAULT 0,
    allowance_far_home NUMERIC(15,2) NOT NULL DEFAULT 0,
    allowance_wait_loading_rate NUMERIC(15,2) NOT NULL DEFAULT 0,
    wait_loading_count INTEGER NOT NULL DEFAULT 0,
    days_off JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT UQ_salary_records_driver_month_year UNIQUE (driver_id, month, year),
    CONSTRAINT FK_salary_records_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_salary_records_driver ON salary_records (driver_id);

-- 4) Cấu hình mặc định (chỉ insert nếu chưa có dòng nào)
INSERT INTO salary_settings (fixed_salary, attendance_bonus, standard_days)
SELECT 7000000, 0, 26
WHERE NOT EXISTS (SELECT 1 FROM salary_settings LIMIT 1);