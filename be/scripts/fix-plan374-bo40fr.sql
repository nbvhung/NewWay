-- ============================================================================
--  Kế hoạch 374 — DONGJIN / HPH-GREENPORT / 13-10-2026
--
--  Sửa 4 container V40 thành ĐÚNG 1 BÓ 40FR và ghi nhận cho lái xe
--  Lương Anh Tuấn (user 21, stt 12, xe 15H 24648).
--
--  Mã / id:
--    SEGU7638362  ci 11940   (lái xe đọc bot 09:16:25 -> bot ghi "Vỏ 40: 1")
--    SKHU5540920  ci 11943
--    SKHU5540999  ci 11946
--    SKHU5640745  ci 11949
--
--  TRƯỚC:
--    4 cont type = V40, bundle_id NULL
--    chỉ 11940 có submission_id = 1821 + 1 claim CLAIM  => vo_40 = 1
--    11943 / 11946 / 11949 chưa ai ghi nhận
--
--  SAU (đúng bằng trạng thái nếu bot ghi 1 BÓ FR):
--    4 cont type = V40FR, bundle_id = 'Bó 1'
--    cả 4 có submission_id = 1821, mỗi cont 1 dòng container_claims (CLAIM)
--    submissions 1821: vo_40 1 -> 0, vo_40fr 0 -> 4, edit_count +1
--    edit_history +1 dòng, edited_by = chính lái xe
--
--  Vì sao vo_40 phải về 0 (không giữ lại):
--    Mỗi dòng container_claims = đúng 1 lần cộng, và ô bị trừ khi xoá cont là
--    TYPE_FIELD_MAP[container.type]. Sau khi đổi type sang V40FR thì 4 claim
--    phải nằm ở ô vo_40fr. Giữ vo_40 = 1 sẽ tạo ô "treo" không bao giờ trừ
--    được: xoá cả 4 cont -> vo_40fr = -1 mà vo_40 vẫn = 1.
--
--  CHẠY:
--    python vps.py -f be/scripts/fix-plan374-bo40fr.sql --apply
--
--  IDEMPOTENT: chạy lần 2 không thay đổi gì (báo "0 sửa, 0 ghi mới").
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_plan        integer := 374;
  v_driver      integer := 21;
  v_bundle      text    := 'Bó 1';
  v_codes       text[]  := ARRAY['SEGU7638362','SKHU5540920','SKHU5540999','SKHU5640745'];
  v_ids         integer[];
  v_driver_name text;
  v_sub         submissions%ROWTYPE;
  v_old_vo40    text; v_new_vo40    text;
  v_old_vo40fr  text; v_new_vo40fr  text;
  v_reclass     integer := 0;   -- cont trong bó đang được ghi nhận như V40
  v_newly       integer := 0;   -- cont trong bó chưa ai ghi nhận
  v_other       integer := 0;   -- cont khác của kế hoạch đã dùng tên bó này
  v_json        text;
BEGIN
  -- (0) Chốt an toàn --------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM shipping_lines WHERE id = v_plan AND completed = false
  ) THEN
    RAISE EXCEPTION 'Kế hoạch % không tồn tại hoặc đã hoàn thành', v_plan;
  END IF;

  SELECT u.full_name INTO v_driver_name
    FROM users u WHERE u.id = v_driver AND u.role = 'laixe';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % không phải là lái xe', v_driver;
  END IF;

  -- 4 mã phải nằm ĐÚNG trong kế hoạch 374, không lẫn kế hoạch khác.
  IF EXISTS (
    SELECT 1 FROM container_imports ci
     WHERE trim(ci.container_code) = ANY(v_codes)
       AND ci.shipping_line_id IS DISTINCT FROM v_plan
  ) THEN
    RAISE EXCEPTION 'Có mã trong danh sách đang nằm ở kế hoạch khác — dừng để kiểm tra';
  END IF;

  SELECT array_agg(ci.id ORDER BY ci.id) INTO v_ids
    FROM container_imports ci
   WHERE ci.shipping_line_id = v_plan
     AND trim(ci.container_code) = ANY(v_codes);
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 4 THEN
    RAISE EXCEPTION 'Không tìm thấy đủ 4 container trong kế hoạch % (thấy %)',
      v_plan, coalesce(array_length(v_ids, 1), 0);
  END IF;

  IF EXISTS (SELECT 1 FROM container_imports ci WHERE ci.id = ANY(v_ids) AND ci.phat_sinh) THEN
    RAISE EXCEPTION 'Có container phát sinh trong danh sách — không thể ghi nhận';
  END IF;

  -- Không được đè lên container đã có lái xe KHÁC chạy.
  IF EXISTS (
    SELECT 1 FROM container_imports ci
     WHERE ci.id = ANY(v_ids)
       AND ci.submission_id IS NOT NULL
       AND ci.submission_id <> (SELECT s.id FROM submissions s
                                 WHERE s.user_id = v_driver AND s.shipping_line_id = v_plan)
  ) THEN
    RAISE EXCEPTION 'Có container đã được lái xe khác ghi nhận — dừng để kiểm tra';
  END IF;

  SELECT count(*) INTO v_other
    FROM container_imports ci
   WHERE ci.shipping_line_id = v_plan
     AND ci.bundle_id = v_bundle
     AND NOT (ci.id = ANY(v_ids));
  IF v_other > 0 THEN
    RAISE EXCEPTION 'Kế hoạch % đã có % container mang tên bó "%" — đổi tên bó trước',
      v_plan, v_other, v_bundle;
  END IF;

  SELECT * INTO v_sub
    FROM submissions s
   WHERE s.user_id = v_driver AND s.shipping_line_id = v_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lái xe % chưa có submission trong kế hoạch %', v_driver, v_plan;
  END IF;

  -- (1) Đếm trạng thái TRƯỚC khi sửa (để tính đúng phần sản lượng phải dịch) --
  SELECT count(*) FILTER (WHERE ci.submission_id = v_sub.id AND ci.type = 'V40'),
         count(*) FILTER (WHERE ci.submission_id IS NULL)
    INTO v_reclass, v_newly
    FROM container_imports ci
   WHERE ci.id = ANY(v_ids);

  -- (2) Đổi loại sang V40FR + gom vào 1 bó -----------------------------------
  UPDATE container_imports
     SET type = 'V40FR', bundle_id = v_bundle
   WHERE id = ANY(v_ids);

  -- (3) Gắn submission + ghi container_claims cho phần chưa ai ghi nhận ------
  IF v_newly > 0 THEN
    UPDATE container_imports
       SET submission_id = v_sub.id
     WHERE id = ANY(v_ids) AND submission_id IS NULL;

    INSERT INTO container_claims
      (container_import_id, submission_id, claim_type, created_at)
    SELECT ci.id, v_sub.id, 'CLAIM', now()
      FROM container_imports ci
     WHERE ci.id = ANY(v_ids)
       AND NOT EXISTS (
         SELECT 1 FROM container_claims cc
          WHERE cc.container_import_id = ci.id
            AND cc.submission_id = v_sub.id
       );
  END IF;

  -- (4) Sản lượng: vo_40 - (phần đã ghi nhận nhầm là V40)
  --               vo_40fr + (phần đã ghi nhận nhầm + phần ghi mới) ---------
  IF (v_reclass + v_newly) > 0 THEN
    v_old_vo40   := coalesce(nullif(v_sub.vo_40, ''), '');
    v_new_vo40   := (coalesce(nullif(v_sub.vo_40, '')::int, 0) - v_reclass)::text;
    v_old_vo40fr := coalesce(nullif(v_sub.vo_40fr, ''), '');
    v_new_vo40fr := (coalesce(nullif(v_sub.vo_40fr, '')::int, 0)
                     + v_reclass + v_newly)::text;

    IF v_new_vo40::int < 0 THEN
      RAISE EXCEPTION 'vo_40 của submission % sẽ âm (% -> %) — dừng lại',
        v_sub.id, v_old_vo40, v_new_vo40;
    END IF;

    UPDATE submissions
       SET vo_40          = v_new_vo40,
           vo_40fr        = v_new_vo40fr,
           edit_count     = edit_count + 1,
           last_edited_at = now(),
           updated_at     = now()
     WHERE id = v_sub.id;

    -- JSON đúng định dạng bot tạo: tên thuộc tính entity (camelCase),
    -- KHÔNG có dấu cách — {"vo40":{"old":"1","new":"0"},"vo40fr":{"old":"","new":"4"}}
    v_json := '{';
    IF v_reclass > 0 THEN
      v_json := v_json || '"vo40":{"old":"' || v_old_vo40 || '","new":"' || v_new_vo40 || '"},';
    END IF;
    v_json := v_json || '"vo40fr":{"old":"' || v_old_vo40fr || '","new":"' || v_new_vo40fr || '"}}';

    INSERT INTO edit_history
      (submission_id, edited_by_id, edited_by_name, changes, edited_at)
    VALUES
      (v_sub.id, v_driver, v_driver_name, v_json, now());

    RAISE NOTICE 'Đã sửa bó % (plan %): dịch % cont V40->V40FR, ghi mới % cont; vo_40 % -> %, vo_40fr % -> %',
      v_bundle, v_plan, v_reclass, v_newly,
      v_old_vo40, v_new_vo40, v_old_vo40fr, v_new_vo40fr;
  ELSE
    RAISE NOTICE 'Không có gì để sửa (bó % của kế hoạch % đã đúng) — 0 thay đổi', v_bundle, v_plan;
  END IF;
END $$;

COMMIT;

\echo ''
\echo '=== 4 container của bó ==='
SELECT ci.id, trim(ci.container_code) AS code, ci.type, ci.bundle_id,
       ci.submission_id, ci.keo_ve, ci.phat_sinh,
       (SELECT string_agg(cc.claim_type || '#' || cc.id, ',')
          FROM container_claims cc WHERE cc.container_import_id = ci.id) AS claims
  FROM container_imports ci
 WHERE ci.shipping_line_id = 374
   AND trim(ci.container_code) IN ('SEGU7638362','SKHU5540920','SKHU5540999','SKHU5640745')
 ORDER BY ci.id;

\echo ''
\echo '=== Submission của lái xe Lương Anh Tuấn ==='
SELECT s.id, s.user_id, u.full_name, u.stt, s.hang_20, s.hang_40, s.vo_40, s.vo_40fr,
       s.edit_count,
       (SELECT count(*) FROM edit_history e WHERE e.submission_id = s.id) AS hist_rows,
       (SELECT count(*) FROM container_imports ci WHERE ci.submission_id = s.id) AS cont_rows,
       (SELECT count(*) FROM container_claims cc WHERE cc.submission_id = s.id) AS claim_rows
  FROM submissions s JOIN users u ON u.id = s.user_id
 WHERE s.id = 1821;

\echo ''
\echo '=== edit_history mới nhất của submission 1821 ==='
SELECT id, changes, edited_by_id, edited_by_name, edited_at
  FROM edit_history WHERE submission_id = 1821 ORDER BY id DESC LIMIT 3;

\echo ''
\echo '=== Tổng quan kế hoạch 374 ==='
SELECT count(*) AS tong_cont,
       count(submission_id) AS da_ghi,
       count(*) - count(submission_id) AS chua_ghi,
       count(*) FILTER (WHERE bundle_id IS NOT NULL) AS cont_trong_bo
  FROM container_imports WHERE shipping_line_id = 374;

-- ============================================================================
--  HOÀN TÁC (chỉ chạy nếu cần trả về đúng trạng thái trước khi sửa):
--
--  BEGIN;
--    -- 1. trả sản lượng: vo_40 0->1, vo_40fr 4->0, edit_count -1
--    UPDATE submissions SET vo_40 = '1', vo_40fr = '', edit_count = edit_count - 1
--     WHERE id = 1821;
--
--    -- 2. xoá đúng 1 dòng edit_history mình vừa ghi (dòng mới nhất)
--    DELETE FROM edit_history
--     WHERE id = (SELECT id FROM edit_history WHERE submission_id = 1821
--                  ORDER BY id DESC LIMIT 1);
--
--    -- 3. bỏ 3 claim mới (giữ lại claim 7124 của SEGU7638362)
--    DELETE FROM container_claims
--     WHERE container_import_id IN (11943, 11946, 11949);
--
--    -- 4. trả 4 container về V40, bỏ bó; chỉ 11940 giữ submission
--    UPDATE container_imports
--       SET type = 'V40', bundle_id = NULL,
--           submission_id = CASE WHEN id = 11940 THEN 1821 ELSE NULL END
--     WHERE id IN (11940, 11943, 11946, 11949);
--  COMMIT;
-- ============================================================================
