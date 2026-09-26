-- ============================================================
-- Chuyen ghi nhan container HALU2436308
-- Ke hoach: HAYN / HPH-GREENPORT / 25-09-2026
-- Tu: ong Hien -> ong Ha
-- Ngay: 2026-09-26
-- ============================================================
-- CACH CHAY TREN VPS:
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < reassign-container-halu2436308.sql
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_plan_id       INT;
  v_plan_name     TEXT;
  v_cont_id       INT;
  v_cont_type     TEXT;
  v_old_sub_id    INT;
  v_old_user_id   INT;
  v_old_name      TEXT;
  v_new_user_id   INT;
  v_new_name      TEXT;
  v_new_sub_id    INT;
  v_field         TEXT;
  v_old_val       INT;
  v_new_val       INT;
BEGIN

  -- 1. Tim ke hoach theo ten
  SELECT id, name INTO v_plan_id, v_plan_name
  FROM shipping_lines
  WHERE name ILIKE '%HAYN%HPH-GREENPORT%25-09-2026%'
     OR name ILIKE '%HAYN%HPH-GREENPORT%25/09/2026%'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay ke hoach HAYN/HPH-GREENPORT/25-09-2026';
  END IF;
  RAISE NOTICE 'Ke hoach: % (id=%)', v_plan_name, v_plan_id;

  -- 2. Tim container HALU2436308
  SELECT id, type, submission_id INTO v_cont_id, v_cont_type, v_old_sub_id
  FROM container_imports
  WHERE container_code = 'HALU2436308'
    AND shipping_line_id = v_plan_id
  LIMIT 1;

  IF v_cont_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay container HALU2436308 trong ke hoach id=%', v_plan_id;
  END IF;
  RAISE NOTICE 'Container: HALU2436308 (id=%, type=%, submission_id=%)', v_cont_id, v_cont_type, v_old_sub_id;

  IF v_old_sub_id IS NULL THEN
    RAISE EXCEPTION 'Container HALU2436308 chua duoc ghi nhan. Khong can chuyen.';
  END IF;

  -- 3. Lay thong tin user cu (ong Hien)
  SELECT s.user_id, u.full_name INTO v_old_user_id, v_old_name
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  WHERE s.id = v_old_sub_id;
  RAISE NOTICE 'User cu: % (id=%)', v_old_name, v_old_user_id;

  -- 4. Tim ong Ha trong danh sach lai xe
  SELECT id, full_name INTO v_new_user_id, v_new_name
  FROM users
  WHERE role = 'laixe'
    AND (full_name ILIKE '%ha%')
    AND id <> v_old_user_id
  ORDER BY id
  LIMIT 1;

  IF v_new_user_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay lai xe ten "Ha". Kiem tra lai bang users.';
  END IF;
  RAISE NOTICE 'User moi: % (id=%)', v_new_name, v_new_user_id;

  -- 5. Xac dinh field san luong tu loai container
  v_field := CASE v_cont_type
    WHEN 'H20'   THEN 'hang20'
    WHEN 'H40'   THEN 'hang40'
    WHEN 'V20'   THEN 'vo20'
    WHEN 'V40'   THEN 'vo40'
    WHEN 'V20FR' THEN 'vo20fr'
    WHEN 'V40FR' THEN 'vo40fr'
    WHEN 'VSL'   THEN 've_sinh_lai'
    WHEN 'KV'    THEN 'keo_ve'
    WHEN 'TIP'   THEN 'tip'
    ELSE NULL
  END;

  IF v_field IS NULL THEN
    RAISE EXCEPTION 'Loai container khong xac dinh: %', v_cont_type;
  END IF;
  RAISE NOTICE 'Field san luong: %', v_field;

  -- 6. Tru san luong submission cu (ong Hien)
  EXECUTE format(
    'SELECT COALESCE(NULLIF(%I, '''')::INT, 0) FROM submissions WHERE id = $1',
    v_field
  ) INTO v_old_val USING v_old_sub_id;

  v_new_val := GREATEST(v_old_val - 1, 0);
  RAISE NOTICE 'Tru san luong %: % -> %', v_old_name, v_old_val, v_new_val;

  EXECUTE format(
    'UPDATE submissions SET %I = $1::TEXT, edit_count = edit_count + 1, last_edited_at = NOW(), updated_at = NOW() WHERE id = $2',
    v_field
  ) USING v_new_val, v_old_sub_id;

  INSERT INTO edit_history (submission_id, edited_by_id, edited_by_name, changes, edited_at)
  VALUES (
    v_old_sub_id,
    v_old_user_id,
    'OPS (reassign HALU2436308)',
    format('{"%s":{"old":"%s","new":"%s"}}', v_field, v_old_val, v_new_val),
    NOW()
  );

  -- 7. Tim hoac tao submission cho ong Ha
  SELECT id INTO v_new_sub_id
  FROM submissions
  WHERE user_id = v_new_user_id AND shipping_line_id = v_plan_id
  LIMIT 1;

  IF v_new_sub_id IS NULL THEN
    INSERT INTO submissions (
      user_id, shipping_line, shipping_line_id, route, driver_name,
      hang20, hang40, vo20, vo40, vo20fr, vo40fr, ve_sinh_lai, keo_ve, tip,
      edit_count, created_at, updated_at
    )
    SELECT
      v_new_user_id, sl.name, sl.id,
      COALESCE(sl.route_name, ''), u.full_name,
      '', '', '', '', '', '', '', '', '',
      0, NOW(), NOW()
    FROM shipping_lines sl, users u
    WHERE sl.id = v_plan_id AND u.id = v_new_user_id
    RETURNING id INTO v_new_sub_id;
    RAISE NOTICE 'Tao submission moi cho %: id=%', v_new_name, v_new_sub_id;
  ELSE
    RAISE NOTICE 'Dung submission san co cua %: id=%', v_new_name, v_new_sub_id;
  END IF;

  -- 8. Cong san luong vao submission ong Ha
  EXECUTE format(
    'SELECT COALESCE(NULLIF(%I, '''')::INT, 0) FROM submissions WHERE id = $1',
    v_field
  ) INTO v_old_val USING v_new_sub_id;

  v_new_val := v_old_val + 1;
  RAISE NOTICE 'Cong san luong %: % -> %', v_new_name, v_old_val, v_new_val;

  EXECUTE format(
    'UPDATE submissions SET %I = $1::TEXT, edit_count = edit_count + 1, last_edited_at = NOW(), updated_at = NOW() WHERE id = $2',
    v_field
  ) USING v_new_val, v_new_sub_id;

  INSERT INTO edit_history (submission_id, edited_by_id, edited_by_name, changes, edited_at)
  VALUES (
    v_new_sub_id,
    v_new_user_id,
    'OPS (reassign HALU2436308)',
    format('{"%s":{"old":"%s","new":"%s"}}', v_field, v_old_val, v_new_val),
    NOW()
  );

  -- 9. Cap nhat container_imports.submission_id
  UPDATE container_imports
  SET submission_id = v_new_sub_id
  WHERE id = v_cont_id;
  RAISE NOTICE 'container_imports[%]: submission_id % -> %', v_cont_id, v_old_sub_id, v_new_sub_id;

  -- 10. Cap nhat container_claims.submission_id
  UPDATE container_claims
  SET submission_id = v_new_sub_id
  WHERE container_import_id = v_cont_id
    AND submission_id = v_old_sub_id;
  RAISE NOTICE 'container_claims cap nhat xong.';

  RAISE NOTICE 'HOAN TAT: HALU2436308 chuyen tu % sang %.', v_old_name, v_new_name;

END $$;

COMMIT;
