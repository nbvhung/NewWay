-- Migration: Tách bên New Way A / New Way B + gắn chi phí vào từng xe
--
-- Chạy trên VPS (bảng thuộc role `postgres`; role `newway_app` KHÔNG tồn tại
-- trên DB production, nên đừng dùng -U newway_app):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
--     -f - < deploy/migrate-add-finance-vehicle-ben.sql
-- hoặc: python D:/NWW/vps.py -f deploy/migrate-add-finance-vehicle-ben.sql --apply
--
-- Mô hình:
--   * `users.ben` = bên của TÀI KHOẢN CHỦ VỐN ('A' | 'B'). Chỉ có ý nghĩa với
--     tài khoản admin/supper_admin đứng ra làm chủ vốn; lái xe để NULL.
--   * Xe (lái xe) thừa hưởng bên từ chủ vốn sở hữu nó qua `users.visible_driver_ids`.
--     Xe không thuộc chủ vốn nào → mặc định bên 'A'.
--   * `finance_cost_items.vehicle_user_id` = xe mà khoản chi thuộc về (id lái xe).
--     NULL = chi phí chung, không gắn xe cụ thể.
--   * Chọn nhiều xe cho 1 khoản chi → mỗi xe 1 DÒNG, mỗi dòng 1 số tiền riêng.
--
-- Idempotent: chạy lại nhiều lần không đổi gì thêm.

-- 1. Bên của tài khoản chủ vốn
ALTER TABLE users ADD COLUMN IF NOT EXISTS ben VARCHAR(10);

-- 2. Xe của từng khoản chi phí
ALTER TABLE finance_cost_items ADD COLUMN IF NOT EXISTS vehicle_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_finance_cost_items_vehicle
    ON finance_cost_items(vehicle_user_id);

-- 3. Khoá ngoại: xoá lái xe thì dòng chi phí vẫn còn, chỉ mất phần "gắn xe"
--    (tránh đúng lỗi mồ côi đã gặp với container_claims — bảng đó không có FK).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_finance_cost_items_vehicle'
    ) THEN
        ALTER TABLE finance_cost_items
            ADD CONSTRAINT fk_finance_cost_items_vehicle
            FOREIGN KEY (vehicle_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Gán bên cho 2 tài khoản chủ vốn hiện có (chỉ khi còn NULL → chạy lại an toàn)
UPDATE users SET ben = 'B' WHERE username = 'NwB'   AND ben IS NULL;
UPDATE users SET ben = 'A' WHERE username = 'admin' AND ben IS NULL;

SELECT 'Migration completed: users.ben + finance_cost_items.vehicle_user_id' AS status;

-- 5. Kiểm tra kết quả
SELECT id, username, full_name, role, ben, visible_driver_ids
  FROM users
 WHERE role IN ('admin', 'supper_admin')
 ORDER BY id;
