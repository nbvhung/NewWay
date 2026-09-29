-- Chuyen users.visible_driver_ids tu text[] sang integer[].
-- Ly do: cot dang la text[] nen TypeORM tra ve mang CHUOI ("10","11"),
-- khien `visible.includes(driverId)` (so) luon sai -> bo loc xe o tab
-- Tong quan / Khach hang / Container bi rong. Idempotent: chay lai an toan.
DO $$
BEGIN
  IF (
    SELECT udt_name FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'visible_driver_ids'
  ) = '_text' THEN
    ALTER TABLE users
      ALTER COLUMN visible_driver_ids TYPE integer[]
      USING visible_driver_ids::integer[];
  END IF;
END $$;
