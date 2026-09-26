-- =============================================================================
-- Vá dữ liệu: khôi phục container WHSU8668815 (id 6829) — kế hoạch 306
--            W293 / N094 / HPH-TV / 19-09-2026
-- =============================================================================
--
-- YÊU CẦU: lấy lại dữ liệu container này vào đúng vị trí + các lần tác nghiệp
--         của nó, KHÔNG làm thay đổi sản lượng của lái xe.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO SẢN LƯỢNG KHÔNG ĐỔI (đã kiểm chứng)
-- ---------------------------------------------------------------------------
-- Sản lượng của lái xe nằm ở bảng `submissions`, KHÔNG phải ở container_imports.
-- Bot Zalo cộng dồn theo `TYPE_FIELD_MAP` (be/src/zalo-bot/type-map.ts) mỗi lần
-- ghi nhận 1 container:
--   6787 WHSU6460756 H40  CLAIM #4327 (20/09 02:19)  -> hang_40 = 1
--   6829 WHSU8668815 H40  CLAIM #4242 (19/09 22:03)  -> hang_40 = 2
--   6829 WHSU8668815 H40  KD2   #4342 (20/09 02:56)  -> hang_40 = 3
--   6829 WHSU8668815 KV    #4319 (20/09 01:45)       -> keo_ve  = 1
-- ⇒ `submissions` của lái xe 29 (Vũ Văn Cẩm, sub 1494) hiện là
--    hang_20 = 6, hang_40 = 3, keo_ve = 1 — ĐÃ bao gồm container 6829.
--   Script này KHÔNG UPDATE/INSERT/DELETE bảng `submissions` ⇒ sản lượng giữ
--   nguyên từng chữ số. Cũng KHÔNG xoá/thêm claim nào.
--
-- Lưu ý: ô "Sản lượng" trong Dashboard admin (dashboard.service.ts:392) đếm số
--   container KHÁC NHAU gắn submission của lái xe, nên nó tăng 7 -> 8 khi dòng
--   container xuất hiện lại. Đây là số đếm container (không phải sản lượng tính
--   lương): với lái xe có "Kéo lần 2" thì 1 container bị đếm 2 lần trong
--   submissions (CLAIM + KD2) nhưng chỉ là 1 dòng container.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO PHẢI KHÔI PHỤC DÒNG CONTAINER
-- ---------------------------------------------------------------------------
-- container_claims KHÔNG có khoá ngoại tới container_imports, nên khi container
-- 6829 bị xoá (21/09/2026 17:03:30, DELETE /api/admin/container-import/6829) 3
-- claim của nó thành "mồ côi". Mọi chỗ đọc claim đều lọc theo
-- `container_import_id IN (<container đang sống>)`:
--   • submissions.service.ts  (sheet "Container - Người chạy" của OPS)
--   • customers.service.ts    (bảng kê gửi khách hàng)
--   • container-import.service.ts (loadClaimInfo: ô "Kéo Về = x", tô đỏ/xanh)
-- ⇒ hiện tại 3 tác nghiệp của container này KHÔNG hiện ở đâu cả. Khôi phục dòng
--   container là cách duy nhất để chúng hiện lại, và claim tự nối lại — không
--   cần UPDATE claim nào.
--
-- ---------------------------------------------------------------------------
-- ĐÚNG VỊ TRÍ
-- ---------------------------------------------------------------------------
-- Dải id của lô nhập plan 306 là 6712..6833, chỉ thiếu đúng 6829. Dòng khôi phục
-- đặt id = 6829 và `created_at` = 2026-09-19 12:19:47.7868, nằm đúng giữa 6828
-- (…47.784833) và 6830 (…47.788752) — tức đúng chỗ trong lô nhập ngày 19/09.
-- Các cột khác lấy NGUYÊN từ backup `newway_20260921_170001.dump`:
--   type=H40, shipping_line_id=306, imported_by_id=27, submission_id=1494,
--   keo_ve=false, ve_sinh_lai=false, bundle_id=NULL, phat_sinh=false.
-- (Insert id nằm DƯỚI `last_value` của sequence nên không ảnh hưởng sequence.)
--
-- CÁCH CHẠY (trên VPS, DB production)
--   psql -U <user> -d <db> -v ON_ERROR_STOP=1 -f fix-container-6829-whsu8668815.sql
--
-- Đã kiểm chứng trên dump production 26-09-2026 08:00:
--   trước: plan 306 có 121 container, 3 claim mồ côi (CLAIM/KV/KD2) của 6829
--   sau:   plan 306 có 122 container, 3 claim đã nối; `submissions` 0 dòng đổi
-- =============================================================================

BEGIN;

-- ── 1. Chốt an toàn: đúng ca bệnh mới chạy. Nếu không khớp -> rollback, không sửa gì.
DO $$
DECLARE
  n_container int;
  n_plan      int;
  n_claims    int;
  n_bad       int;
BEGIN
  SELECT count(*) INTO n_container FROM container_imports WHERE id = 6829;
  IF n_container > 0 THEN
    RAISE EXCEPTION 'container 6829 DA ton tai - khong lam gi (co the da va roi)';
  END IF;

  SELECT count(*) INTO n_plan FROM container_imports WHERE shipping_line_id = 306;
  IF n_plan <> 121 THEN
    RAISE EXCEPTION 'plan 306 dang co % container, mong doi 121 - dung lai de kiem tra', n_plan;
  END IF;

  SELECT count(*) INTO n_claims
    FROM container_claims cc
   WHERE cc.container_import_id = 6829
     AND NOT EXISTS (SELECT 1 FROM container_imports ci WHERE ci.id = cc.container_import_id);
  IF n_claims <> 3 THEN
    RAISE EXCEPTION 'mong doi 3 luot ghi nhan mo coi tro vao 6829, thuc te %', n_claims;
  END IF;

  -- đúng 3 loại: CLAIM + KV + KD2, đều của sub 1494
  SELECT count(*) INTO n_bad
    FROM container_claims cc
   WHERE cc.container_import_id = 6829
     AND (cc.claim_type NOT IN ('CLAIM','KV','KD2') OR cc.submission_id <> 1494);
  IF n_bad > 0 THEN
    RAISE EXCEPTION 'co % luot ghi nhan cua 6829 khong dung loai/submission mong doi', n_bad;
  END IF;
END $$;

-- ── 2. Khôi phục dòng container đúng vị trí (giá trị lấy nguyên từ backup)
INSERT INTO container_imports
  (id, container_code, type, shipping_line_id, imported_by_id, submission_id,
   created_at, keo_ve, ve_sinh_lai, bundle_id, phat_sinh)
VALUES
  (6829, 'WHSU8668815', 'H40', 306, 27, 1494,
   '2026-09-19 12:19:47.786800', false, false, NULL, false);

-- ── 3. Các lần tác nghiệp đã nối lại container
SELECT cc.id AS claim_id, cc.claim_type, cc.submission_id,
       to_char(cc.created_at, 'DD-MM-YYYY HH24:MI:SS') AS ghi_nhan_luc,
       ci.container_code, ci.type, ci.shipping_line_id AS plan_id
  FROM container_claims cc
  JOIN container_imports ci ON ci.id = cc.container_import_id
 WHERE cc.container_import_id = 6829
 ORDER BY cc.created_at;

-- ── 4. Sản lượng của lái xe: đối chiếu trước/sau (phải giống hệt)
SELECT s.id AS submission_id, s.user_id, u.full_name,
       s.hang_20, s.hang_40, s.vo_20, s.vo_40, s.ve_sinh_lai, s.keo_ve, s.tip,
       (SELECT count(*) FROM container_imports ci
         WHERE ci.shipping_line_id = 306 AND ci.submission_id = s.id) AS so_container
  FROM submissions s
  LEFT JOIN users u ON u.id = s.user_id
 WHERE s.shipping_line_id = 306
 ORDER BY s.id;

-- ── 5. Còn claim mồ côi nào không (ngoài 5170 = mã test, xem script tổng)
SELECT cc.container_import_id, count(*) AS so_claim
  FROM container_claims cc
 WHERE NOT EXISTS (SELECT 1 FROM container_imports ci WHERE ci.id = cc.container_import_id)
 GROUP BY 1
 ORDER BY 1;

COMMIT;

-- =============================================================================
-- HOÀN TÁC (nếu cần trả về nguyên trạng): xoá dòng container vừa khôi phục.
-- 3 claim sẽ tự thành mồ côi lại như trước, không mất dữ liệu nào.
--   DELETE FROM container_imports WHERE id = 6829;
-- =============================================================================
