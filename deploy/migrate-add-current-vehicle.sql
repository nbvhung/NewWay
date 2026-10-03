-- Migration: Tính năng "Đổi xe / Lái thay xe"
--
-- Mô hình:
--   * `users.current_vehicle_id` = xe mà tài xế đang LÁI THỰC TẾ.
--     NULL = đang lái xe gốc của mình (users.id).
--     Khi đặt về một xe khác (id lái xe đại diện cho chiếc xe đó),
--     mọi chuyến Zalo Bot ghi nhận sẽ dùng xe đó làm "xe thực chạy"
--     để tính doanh thu / BKS / Bên, nhưng lương vẫn tính cho tài xế gốc.
--
--   * `submissions.actual_vehicle_id` = xe thực chạy đã được snapshot
--     tại thời điểm tài xế báo container. NULL = xe gốc của tài xế.
--     Dùng cột này để tính doanh thu / Bên / BKS về sau (kể cả khi
--     current_vehicle_id đã reset lại).
--
-- Chạy trên VPS:
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
--     -f - < deploy/migrate-add-current-vehicle.sql
-- hoặc: python D:/NWW/vps.py -f deploy/migrate-add-current-vehicle.sql --apply
--
-- Idempotent: chạy lại nhiều lần không đổi gì thêm.

-- 1. Xe tài xế đang lái thực tế (trạng thái sống, reset khi bot xử lý lệnh /xe)
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_vehicle_id INTEGER;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS fk_users_current_vehicle;

ALTER TABLE users
  ADD CONSTRAINT fk_users_current_vehicle
  FOREIGN KEY (current_vehicle_id) REFERENCES users(id) ON DELETE SET NULL;

-- 2. Snapshot xe thực chạy tại thời điểm tài xế ghi nhận container
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS actual_vehicle_id INTEGER;

ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS fk_submissions_actual_vehicle;

ALTER TABLE submissions
  ADD CONSTRAINT fk_submissions_actual_vehicle
  FOREIGN KEY (actual_vehicle_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_actual_vehicle
  ON submissions(actual_vehicle_id);

SELECT 'Migration completed: users.current_vehicle_id + submissions.actual_vehicle_id' AS status;
