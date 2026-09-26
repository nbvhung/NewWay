-- ============================================================================
--  Ghi nhận 19 container V40 cho kế hoạch 317 (VSL / VỆ SINH LẠI)
--    - lái xe Thành (user 11, stt 02) :  9 container
--    - lái xe Đồng  (user 19, stt 10) : 10 container
--
--  Kết quả giống HỆT lái xe tự nhắn bot Zalo ghi nhận TỪNG container:
--    container_imports : +1 dòng (type V40, gắn submission của lái xe)
--    container_claims  : +1 dòng (claim_type = 'CLAIM')
--    submissions       : vo_40 +1, edit_count +1, last_edited_at = now()
--    edit_history      : +1 dòng {"vo40":{"old":"x","new":"y"}}
--
--  Vì sao 19 lượt ghi nhận chứ không phải 2:
--    Bot chỉ xử lý 1 mã cho mỗi tin nhắn (zalo-bot.service.ts:550 lấy digits[0],
--    rồi upsertContainer() cho đúng 1 container). Dữ liệu production xác nhận
--    điều này: mọi submission của kế hoạch 317 đều có
--        edit_count == count(edit_history) == số container đã ghi nhận - 1
--    (1526: 31 cont / edit_count 30 · 1527: 32 cont / edit_count 31 ...).
--    Bất biến đó được giữ nguyên ở đây.
--
--  CHẠY:
--    python vps.py -f be/scripts/record-plan317-v40-19cont.sql --apply
--
--  IDEMPOTENT: chạy lần thứ 2 không thay đổi gì (mã nào đã gắn submission thì
--  bỏ qua). Không hardcode số cũ — luôn đọc giá trị hiện tại của submission,
--  nên chạy được kể cả khi có lái xe khác ghi nhận thêm trong lúc chờ.
--
--  HOÀN TÁC: xem khối cuối file (đã comment).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_plan        integer := 317;
  v_type        text    := 'V40';
  -- Tên THUỘC TÍNH entity (camelCase), KHÔNG phải tên cột (vo_40).
  -- Bot ghi edit_history bằng TYPE_FIELD_MAP -> {"vo40":{...}}.
  v_field       text    := 'vo40';
  v_imported_by integer := 27;   -- ops đang nhập kế hoạch 317 (các lô 24-26/09)
  rec           record;
  v_cont        container_imports%ROWTYPE;
  v_sub         submissions%ROWTYPE;
  v_old         text;
  v_new         text;
  v_driver_name text;
  v_done        integer := 0;
  v_skip        integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM shipping_lines WHERE id = v_plan AND completed = false
  ) THEN
    RAISE EXCEPTION 'Kế hoạch % không tồn tại hoặc đã hoàn thành', v_plan;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ( 1, 'WHSU6050371', 11), ( 2, 'WHSU8087277', 11), ( 3, 'WHSU5324760', 11),
      ( 4, 'WHSU6981137', 11), ( 5, 'WHSU6056003', 11), ( 6, 'WHSU6806279', 11),
      ( 7, 'IIIU6359836', 11), ( 8, 'IIIU6351136', 11), ( 9, 'TCKU7579282', 11),
      (10, 'WHSU6940400', 19), (11, 'WHSU8025969', 19), (12, 'WHSU8225627', 19),
      (13, 'WHSU6924103', 19), (14, 'WHSU6818271', 19), (15, 'WHSU6463971', 19),
      (16, 'WHSU6462152', 19), (17, 'WHLU5787055', 19), (18, 'WHSU8029521', 19),
      (19, 'WHSU5053735', 19)
    ) AS t(ord, code, driver_id)
    ORDER BY t.ord
  LOOP
    -- (0) Chốt an toàn: mã không được nằm ở một kế hoạch KHÁC.
    IF EXISTS (
      SELECT 1 FROM container_imports ci
       WHERE trim(ci.container_code) = rec.code
         AND ci.shipping_line_id <> v_plan
    ) THEN
      RAISE EXCEPTION 'Mã % đã tồn tại ở kế hoạch khác — dừng để kiểm tra', rec.code;
    END IF;

    SELECT u.full_name INTO v_driver_name
      FROM users u WHERE u.id = rec.driver_id AND u.role = 'laixe';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'User % không phải là lái xe', rec.driver_id;
    END IF;

    -- (1) Tạo dòng container nếu chưa có (giống lúc nhập kế hoạch).
    SELECT * INTO v_cont
      FROM container_imports
     WHERE trim(container_code) = rec.code
       AND shipping_line_id = v_plan;

    IF NOT FOUND THEN
      INSERT INTO container_imports
        (container_code, type, shipping_line_id, imported_by_id,
         submission_id, keo_ve, ve_sinh_lai, bundle_id, phat_sinh, created_at)
      VALUES
        (rec.code, v_type, v_plan, v_imported_by,
         NULL, false, false, NULL, false, now())
      RETURNING * INTO v_cont;
    END IF;

    -- Đã có người chạy rồi -> không ghi lại (idempotent).
    IF v_cont.submission_id IS NOT NULL THEN
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;

    -- (2) Cộng sản lượng cho lái xe — y như bot làm.
    SELECT * INTO v_sub
      FROM submissions
     WHERE user_id = rec.driver_id
       AND shipping_line_id = v_plan;

    IF NOT FOUND THEN
      -- Lần ghi nhận đầu tiên: bot tạo submission và KHÔNG ghi edit_history.
      INSERT INTO submissions
        (user_id, shipping_line, shipping_line_id, route, driver_name,
         hang_20, hang_40, vo_20, vo_40, vo_20fr, vo_40fr, ve_sinh_lai, keo_ve, tip,
         edit_count, created_at, updated_at)
      VALUES
        (rec.driver_id,
         (SELECT name FROM shipping_lines WHERE id = v_plan),
         v_plan,
         (SELECT coalesce(route_name, '') FROM shipping_lines WHERE id = v_plan),
         v_driver_name,
         '', '', '', '1', '', '', '', '', '',
         0, now(), now())
      RETURNING * INTO v_sub;

      v_old := '';
      v_new := '1';
    ELSE
      v_old := coalesce(nullif(v_sub.vo_40, ''), '0');
      v_new := (coalesce(nullif(v_sub.vo_40, '')::int, 0) + 1)::text;

      UPDATE submissions
         SET vo_40          = v_new,
             edit_count     = edit_count + 1,
             last_edited_at = now(),
             updated_at     = now()
       WHERE id = v_sub.id;

      -- Chuỗi JSON viết đúng định dạng bot tạo: {"vo40":{"old":"31","new":"32"}}
      INSERT INTO edit_history
        (submission_id, edited_by_id, edited_by_name, changes, edited_at)
      VALUES
        (v_sub.id, rec.driver_id, v_driver_name,
         '{"' || v_field || '":{"old":"' || v_old || '","new":"' || v_new || '"}}',
         now());
    END IF;

    -- (3) Gắn container cho submission + ghi container_claims (CLAIM).
    UPDATE container_imports SET submission_id = v_sub.id WHERE id = v_cont.id;

    INSERT INTO container_claims
      (container_import_id, submission_id, claim_type, created_at)
    VALUES
      (v_cont.id, v_sub.id, 'CLAIM', now());

    v_done := v_done + 1;
  END LOOP;

  RAISE NOTICE 'Da ghi nhan % container (bo qua % da ghi truoc do)', v_done, v_skip;
END $$;

COMMIT;

\echo ''
\echo '=== Sau khi ghi: san luong 2 lai xe ==='
SELECT s.id AS submission_id,
       s.user_id,
       u.full_name,
       u.stt,
       s.vo_40,
       s.edit_count,
       (SELECT count(*) FROM edit_history e WHERE e.submission_id = s.id) AS hist_rows,
       (SELECT count(*) FROM container_imports ci
         WHERE ci.submission_id = s.id AND ci.shipping_line_id = 317) AS cont_rows
  FROM submissions s
  JOIN users u ON u.id = s.user_id
 WHERE s.shipping_line_id = 317
 ORDER BY s.id;

\echo ''
\echo '=== Sau khi ghi: tong quan ke hoach 317 ==='
SELECT count(*) AS tong_cont,
       count(submission_id) AS da_ghi,
       count(*) - count(submission_id) AS chua_ghi
  FROM container_imports
 WHERE shipping_line_id = 317;

\echo ''
\echo '=== 19 ma vua ghi ==='
SELECT ci.container_code, ci.type, ci.submission_id, s.user_id, u.full_name,
       cc.claim_type, cc.id AS claim_id
  FROM container_imports ci
  LEFT JOIN submissions s ON s.id = ci.submission_id
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN container_claims cc ON cc.container_import_id = ci.id
 WHERE ci.shipping_line_id = 317
   AND trim(ci.container_code) IN (
     'WHSU6050371','WHSU8087277','WHSU5324760','WHSU6981137','WHSU6056003',
     'WHSU6806279','IIIU6359836','IIIU6351136','TCKU7579282',
     'WHSU6940400','WHSU8025969','WHSU8225627','WHSU6924103','WHSU6818271',
     'WHSU6463971','WHSU6462152','WHLU5787055','WHSU8029521','WHSU5053735')
 ORDER BY ci.container_code;

-- ============================================================================
--  HOÀN TÁC (chạy tay nếu cần trả về trạng thái trước):
--
--  BEGIN;
--    -- 1. bỏ 19 lượt ghi nhận
--    DELETE FROM container_claims
--     WHERE container_import_id IN (
--       SELECT id FROM container_imports
--        WHERE shipping_line_id = 317
--          AND trim(container_code) IN ( ...19 mã trên... ));
--
--    -- 2. bỏ 19 dòng container
--    DELETE FROM container_imports
--     WHERE shipping_line_id = 317
--       AND trim(container_code) IN ( ...19 mã trên... );
--
--    -- 3. trả sản lượng: vo_40 -9 / -10, edit_count -9 / -10,
--    --    xoá 19 dòng edit_history mới nhất của 2 submission
--    DELETE FROM edit_history
--     WHERE id IN (SELECT id FROM edit_history
--                   WHERE submission_id = 1526 ORDER BY id DESC LIMIT 9);
--    DELETE FROM edit_history
--     WHERE id IN (SELECT id FROM edit_history
--                   WHERE submission_id = 1527 ORDER BY id DESC LIMIT 10);
--    UPDATE submissions SET vo_40 = '31', edit_count = 30 WHERE id = 1526;
--    UPDATE submissions SET vo_40 = '32', edit_count = 31 WHERE id = 1527;
--  COMMIT;
--
--  (Số 31/30 và 32/31 là giá trị TRƯỚC khi ghi — kiểm tra lại trước khi dùng.)
-- ============================================================================
