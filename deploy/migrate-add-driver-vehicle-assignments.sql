-- ============================================================================
-- Migration: Lịch sử BỔ NHIỆM lái xe theo NGÀY HIỆU LỰC.
--
-- Mục đích: lương cứng + các khoản cố định (chuyên cần, phụ cấp, BHXH, TIP,
-- tạm ứng, chi hộ, khoản cộng/trừ) bám đúng XE của TỪNG THÁNG. Nhờ vậy đổi xe
-- giữa tháng không làm lương tháng cũ bị chuyển ngược sang xe mới.
--
-- Quy tắc `salary_from`:
--   - Ngày hiệu lực là ngày 1  → tính từ đúng tháng đó.
--   - Ngày hiệu lực giữa tháng → tính từ ngày 1 tháng sau.
--
-- Idempotent — chạy lại nhiều lần an toàn.
--
-- Chạy trên VPS:
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
--     < deploy/migrate-add-driver-vehicle-assignments.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
  id                 SERIAL PRIMARY KEY,
  driver_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id         INT REFERENCES vehicles(id) ON DELETE SET NULL,
  effective_date     DATE NOT NULL,
  salary_from        DATE NOT NULL,
  note               TEXT,
  created_by_user_id INT,
  applied_at         TIMESTAMP,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dva_driver_effective UNIQUE (driver_id, effective_date)
);

-- Nâng cấp từ bản unique cũ (driver_id, salary_from) nếu đã chạy migration trước.
ALTER TABLE driver_vehicle_assignments
  DROP CONSTRAINT IF EXISTS uq_dva_driver_salary;
ALTER TABLE driver_vehicle_assignments
  DROP CONSTRAINT IF EXISTS uq_dva_driver_effective;
ALTER TABLE driver_vehicle_assignments
  ADD CONSTRAINT uq_dva_driver_effective UNIQUE (driver_id, effective_date);
DROP INDEX IF EXISTS idx_dva_driver_salary;

CREATE INDEX IF NOT EXISTS idx_dva_vehicle_effective
  ON driver_vehicle_assignments (vehicle_id, effective_date);

-- ----------------------------------------------------------------------------
-- Backfill: mọi lái xe hiện tại giữ xe nhà hiện tại từ 01/01/2026.
-- (Trừ Dũng — ghi lịch sử riêng bên dưới.)
-- ----------------------------------------------------------------------------
INSERT INTO driver_vehicle_assignments
  (driver_id, vehicle_id, effective_date, salary_from, applied_at)
SELECT u.id, u.home_vehicle_id, DATE '2026-01-01', DATE '2026-01-01', NOW()
FROM users u
WHERE u.role = 'laixe'
  AND u.home_vehicle_id IS NOT NULL
  AND u.username <> '0963370168'
ON CONFLICT (driver_id, effective_date) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Dũng (username 0963370168): xe 15H 10090 từ đầu đến hết 31/10/2026;
-- xe 15H 40566 từ 01/11/2026.
-- ----------------------------------------------------------------------------
WITH d AS (
  SELECT id FROM users WHERE username = '0963370168' LIMIT 1
), oldv AS (
  SELECT id FROM vehicles WHERE so_xe = '15H 10090' ORDER BY id LIMIT 1
)
INSERT INTO driver_vehicle_assignments
  (driver_id, vehicle_id, effective_date, salary_from, applied_at)
SELECT d.id, oldv.id, DATE '2026-01-01', DATE '2026-01-01', NOW()
FROM d, oldv
ON CONFLICT (driver_id, effective_date) DO NOTHING;

WITH d AS (
  SELECT id FROM users WHERE username = '0963370168' LIMIT 1
), newv AS (
  SELECT id FROM vehicles WHERE so_xe = '15H 40566' ORDER BY id LIMIT 1
)
INSERT INTO driver_vehicle_assignments
  (driver_id, vehicle_id, effective_date, salary_from, applied_at)
SELECT
  d.id,
  newv.id,
  DATE '2026-11-01',
  DATE '2026-11-01',
  CASE WHEN DATE '2026-11-01' <= CURRENT_DATE THEN NOW() ELSE NULL END
FROM d, newv
ON CONFLICT (driver_id, effective_date) DO NOTHING;

COMMIT;
