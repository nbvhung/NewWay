-- Migration: Khoản lương động (tab Lương Tháng — phần Lương và Phụ cấp)
-- Cho phép định nghĩa thêm các khoản cộng thêm / khấu trừ theo từng lái xe.
-- Chạy trên DB production (server công ty qua WireGuard / container VPS):
--   docker exec newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-salary-items.sql
-- Hoặc chạy trực tiếp trên DB server:
--   psql -U newway_app -d newway -f migrate-add-salary-items.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới,
-- nếu không tab Lương Tháng sẽ báo "Lỗi server nội bộ".

-- 1) Định nghĩa khoản lương (cộng thêm / khấu trừ) — giá trị chung mặc định
CREATE TABLE IF NOT EXISTS salary_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(10) NOT NULL DEFAULT 'add',   -- 'add' = cộng thêm, 'deduct' = khấu trừ
    default_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 2) Giá trị khoản lương theo lái xe / tháng (tick + số tiền riêng)
CREATE TABLE IF NOT EXISTS salary_record_items (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,    -- tick bật/tắt cho lái xe
    amount NUMERIC(15,2) NULL,                 -- NULL = dùng default_amount của khoản
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT FK_salary_record_items_record FOREIGN KEY (record_id) REFERENCES salary_records(id) ON DELETE CASCADE,
    CONSTRAINT FK_salary_record_items_item FOREIGN KEY (item_id) REFERENCES salary_items(id) ON DELETE CASCADE,
    CONSTRAINT UQ_salary_record_items UNIQUE (record_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_record_items_record ON salary_record_items (record_id);
CREATE INDEX IF NOT EXISTS idx_salary_record_items_item ON salary_record_items (item_id);