-- ============================================================================
-- Migration: bảng đảo lái xe theo kế hoạch (plan_vehicle_overrides).
-- Idempotent — chạy lại nhiều lần an toàn.
--
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
--     < deploy/migrate-add-plan-vehicle-overrides.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS plan_vehicle_overrides (
  id              SERIAL PRIMARY KEY,
  plan_id         INT NOT NULL,
  driver_id       INT NOT NULL,
  vehicle_id      INT NOT NULL,
  created_by_id   INT,
  created_by_name VARCHAR(255) NOT NULL DEFAULT '',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_plan_vehicle_override') THEN
    ALTER TABLE plan_vehicle_overrides ADD CONSTRAINT uq_plan_vehicle_override UNIQUE (plan_id, driver_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_vehicle_overrides_plan ON plan_vehicle_overrides(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_vehicle_overrides_vehicle ON plan_vehicle_overrides(vehicle_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pvo_plan') THEN
    ALTER TABLE plan_vehicle_overrides ADD CONSTRAINT fk_pvo_plan
      FOREIGN KEY (plan_id) REFERENCES shipping_lines(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pvo_driver') THEN
    ALTER TABLE plan_vehicle_overrides ADD CONSTRAINT fk_pvo_driver
      FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pvo_vehicle') THEN
    ALTER TABLE plan_vehicle_overrides ADD CONSTRAINT fk_pvo_vehicle
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;

SELECT 'Migration completed: plan_vehicle_overrides' AS status;
