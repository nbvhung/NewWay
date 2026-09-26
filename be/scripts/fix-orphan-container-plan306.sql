-- =============================================================================
-- ⚠️ ĐÃ ĐƯỢC THAY THẾ bởi fix-orphan-container-claims.sql (26-09-2026)
--    Script mới vá CẢ 23 container mồ côi (không chỉ 6829), và khôi phục 6829
--    đúng như trong backup (keo_ve = false; script này đặt keo_ve = true).
--    Chỉ dùng script này nếu bạn CHỈ muốn vá riêng container 6829.
-- =============================================================================
-- Vá dữ liệu: khôi phục container WHSU8668815 (id 6829) của kế hoạch 306
--            W293 / N094 / HPH-TV / 19-09-2026
-- =============================================================================
--
-- BỐI CẢNH
-- Tài xế số 5 (Vũ Văn Cẩm, users.id = 29) đã ghi nhận qua Zalo bot:
--   - 20-09-2026 01:45:17  "Kéo Về"      -> claim KV  id 4319
--   - 20-09-2026 02:56:22  "Kéo lần 2"   -> claim KD2 id 4342
--   - 19-09-2026 22:03:13  "Hàng 40: 1"  -> claim CLAIM id 4242
-- Cả 3 claim đều trỏ container_import_id = 6829.
--
-- Container 6829 sau đó ĐÃ BỊ XOÁ khỏi container_imports (dải id của plan 306 là
-- 6712..6833, chỉ thiếu đúng 6829). Vì container_claims KHÔNG có khoá ngoại tới
-- container_imports, việc xoá không hề báo lỗi và để lại 3 claim "mồ côi".
--
-- HỆ QUẢ: sheet "Container - Người chạy" được dựng bằng cách duyệt các container
-- còn sống rồi join claim theo container_import_id, nên claim mồ côi KHÔNG BAO GIỜ
-- hiện ra -> mất ô "x" cột Kéo Về, mất note "Kéo Lần 2", mất tô đỏ/xanh.
--
-- CÁCH CHẠY (trên VPS, DB production)
--   psql -U <user> -d <db> -v ON_ERROR_STOP=1 -f fix-orphan-container-plan306.sql
--
-- Đã kiểm chứng trên bản dump production ngày 25-09-2026 20:30: chạy xong thì
-- export "Đã hoàn thành" của plan 306 ra đúng 3 dòng:
--   WHSU8668815  H40  Vũ Văn Cẩm  15C 00756"  19/09 22:03:13  (đỏ)
--   WHSU8668815  H40  Vũ Văn Cẩm  15C 00756"  20/09 01:45:17  Kéo Về = x   (đỏ)
--   WHSU8668815  H40  Vũ Văn Cẩm  15C 00756"  20/09 02:56:22  Kéo Lần 2   (xanh)
-- =============================================================================

BEGIN;

-- Chốt an toàn: chỉ chạy khi đúng là container 6829 của plan 306 đang bị thiếu,
-- và đúng 3 claim mồ côi của nó còn nguyên. Nếu không khớp -> rollback, không sửa gì.
DO $$
DECLARE
  n_container int;
  n_claims    int;
  n_orphan    int;
BEGIN
  SELECT count(*) INTO n_container FROM container_imports WHERE id = 6829;
  IF n_container > 0 THEN
    RAISE EXCEPTION 'container id 6829 da ton tai - khong lam gi (co the da va roi)';
  END IF;

  SELECT count(*) INTO n_claims FROM container_imports WHERE shipping_line_id = 306;
  IF n_claims <> 121 THEN
    RAISE EXCEPTION 'plan 306 dang co % container, mong doi 121 - dung lai de kiem tra', n_claims;
  END IF;

  SELECT count(*) INTO n_orphan
  FROM container_claims cc
  WHERE cc.container_import_id = 6829
    AND NOT EXISTS (SELECT 1 FROM container_imports ci WHERE ci.id = cc.container_import_id);
  IF n_orphan <> 3 THEN
    RAISE EXCEPTION 'mong doi 3 claim mo coi tro vao 6829, thuc te %', n_orphan;
  END IF;
END $$;

-- Khôi phục container. created_at đặt đúng giữa 6828 và 6830 để giữ nguyên thứ tự
-- của lô import ngày 19-09 (các container của plan 306 được nhập cùng 1 lô).
INSERT INTO container_imports
  (id, container_code, type, shipping_line_id, imported_by_id, submission_id,
   keo_ve, ve_sinh_lai, bundle_id, phat_sinh, created_at)
VALUES
  (6829, 'WHSU8668815', 'H40', 306, 27, 1494,
   true, false, NULL, false, '2026-09-19 12:19:47.786000');

-- Kiểm tra lại: 3 claim đã nối được container
SELECT cc.id AS claim_id, cc.claim_type, cc.created_at,
       ci.container_code, ci.type, ci.shipping_line_id
FROM container_claims cc
JOIN container_imports ci ON ci.id = cc.container_import_id
WHERE cc.container_import_id = 6829
ORDER BY cc.created_at;

COMMIT;

-- =============================================================================
-- KIỂM TRA SAU KHI VÁ: còn claim mồ côi nào khác không
-- =============================================================================
-- select cc.claim_type, count(*) from container_claims cc
-- where not exists (select 1 from container_imports ci where ci.id = cc.container_import_id)
-- group by 1 order by 2 desc;
--
-- Trước khi vá: CLAIM 21, CLAMP 3, KD2 1, KV 1 (tổng 26)
-- Sau khi vá:  CLAIM 20, CLAMP 3          (tổng 23)  <- KV/KD2 đã hết mồ côi
--
-- LƯU Ý: 20 CLAIM + 3 CLAMP mồ côi còn lại thuộc các kế hoạch 222, 205, 312, 272,
-- 318, 288, 298. Chúng KHÔNG ảnh hưởng tô màu/ghi chú (chỉ KV/KD2 mới tô màu),
-- nhưng cùng một loại lỗi: container bị xoá sau khi đã có ghi nhận. Muốn khôi
-- phục thì phải biết mã container gốc - lấy từ lịch sử chat Zalo của tài xế.
