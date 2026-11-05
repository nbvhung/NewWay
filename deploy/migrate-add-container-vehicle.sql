ALTER TABLE container_imports
  ADD COLUMN IF NOT EXISTS vehicle_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_container_imports_vehicle
  ON container_imports(vehicle_id);

-- Backfill xe thực chạy cho container đã ghi nhận trước đây.
-- Thứ tự: snapshot xe của submission > xe nhà > id tài xế (fallback cũ).
UPDATE container_imports ci
SET vehicle_id = COALESCE(s.actual_vehicle_id, u.home_vehicle_id, s.user_id)
FROM submissions s
JOIN users u ON u.id = s.user_id
WHERE ci.submission_id = s.id
  AND ci.vehicle_id IS NULL;

SELECT 'Migration completed: container_imports.vehicle_id' AS status;
