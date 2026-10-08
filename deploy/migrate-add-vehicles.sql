-- ============================================================================
-- Migration: Tách thực thể XE (vehicles) khỏi tài khoản lái xe.
-- Idempotent — chạy lại nhiều lần an toàn.
--
-- Chạy trên VPS:
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
--     < deploy/migrate-add-vehicles.sql
--
-- Nguyên tắc: mỗi tài khoản lái xe hiện tại = 1 xe, với `vehicles.id = users.id`
-- → giữ nguyên mọi tham chiếu số (submissions.actual_vehicle_id,
-- finance_cost_items.vehicle_user_id, users.current_vehicle_id), chỉ đổi FK
-- trỏ từ users(id) sang vehicles(id).
-- ============================================================================

BEGIN;

-- 1. Bảng xe --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id             SERIAL PRIMARY KEY,
  so_xe          VARCHAR(50) NOT NULL DEFAULT '',
  so_mooc        VARCHAR(50) NOT NULL DEFAULT '',
  stt            VARCHAR(50) NOT NULL DEFAULT '',
  ngay_hoat_dong DATE,
  owner_user_id  INT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_user_id);

-- 2. Backfill: 1 xe cho mỗi tài khoản lái xe, id = users.id ----------------
INSERT INTO vehicles (id, so_xe, so_mooc, stt, ngay_hoat_dong)
SELECT id, COALESCE(so_xe, ''), COALESCE(so_mooc, ''), COALESCE(stt, ''), ngay_hoat_dong
FROM users
WHERE role = 'laixe'
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('vehicles', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM vehicles), 1)
);

-- 3. users.home_vehicle_id (xe nhà) --------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_vehicle_id INT;
UPDATE users SET home_vehicle_id = id
WHERE role = 'laixe' AND home_vehicle_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_home_vehicle ON users(home_vehicle_id);

-- 4. owner_user_id suy từ visible_driver_ids (chủ vốn id nhỏ thắng) --------
UPDATE vehicles v
SET owner_user_id = o.id
FROM users o
WHERE o.visible_driver_ids IS NOT NULL
  AND v.id = ANY (o.visible_driver_ids)
  AND (v.owner_user_id IS NULL OR o.id < v.owner_user_id);

-- 5. FK: vehicles.owner_user_id → users ----------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vehicles_owner') THEN
    ALTER TABLE vehicles ADD CONSTRAINT fk_vehicles_owner
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. FK: users.home_vehicle_id → vehicles --------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_home_vehicle') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_home_vehicle
      FOREIGN KEY (home_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Repoint FK: submissions.actual_vehicle_id → vehicles -----------------
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS fk_submissions_actual_vehicle;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_submissions_actual_vehicle') THEN
    ALTER TABLE submissions ADD CONSTRAINT fk_submissions_actual_vehicle
      FOREIGN KEY (actual_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Repoint FK: users.current_vehicle_id → vehicles ----------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_current_vehicle;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_current_vehicle') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_current_vehicle
      FOREIGN KEY (current_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 9. Repoint FK: finance_cost_items.vehicle_user_id → vehicles ------------
ALTER TABLE finance_cost_items DROP CONSTRAINT IF EXISTS fk_finance_cost_items_vehicle;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_finance_cost_items_vehicle') THEN
    ALTER TABLE finance_cost_items ADD CONSTRAINT fk_finance_cost_items_vehicle
      FOREIGN KEY (vehicle_user_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

SELECT 'Migration completed: vehicles + home_vehicle_id + FK repoint' AS status;
SELECT count(*) AS so_xe FROM vehicles;
SELECT count(*) AS lai_xe_co_xe_nha FROM users WHERE role='laixe' AND home_vehicle_id IS NOT NULL;
