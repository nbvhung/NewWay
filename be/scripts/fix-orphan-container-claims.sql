-- =============================================================================
-- Vá dữ liệu: 23 container "mồ côi" (container bị xoá nhưng còn lượt ghi nhận)
-- =============================================================================
--
-- BỐI CẢNH
-- Bảng container_claims KHÔNG có khoá ngoại tới container_imports. Khi 1 container
-- bị xoá, các claim của nó KHÔNG bị xoá theo → thành "claim mồ côi". Vì mọi chỗ
-- đọc claim đều truy vấn `container_import_id IN (<container đang sống>)`:
--   • be/src/submissions/submissions.service.ts   (bảng kê / lương / "Container - Người chạy")
--   • be/src/customers/customers.service.ts       (bảng kê gửi khách hàng)
--   • be/src/container-import/container-import.service.ts (loadClaimInfo: tô đỏ/xanh, ô Kéo Về)
-- nên claim mồ côi bị bỏ qua âm thầm → mất ô "x" Kéo Về, mất note "Kéo Lần 2",
-- mất ghép cặp KẸP, mất tô màu.
--
-- 23 container mồ côi (26 claim) được tìm ra bằng cách quét toàn bộ 1092 bản backup
-- (xem skill newway-excel-verify, mục "Full-backup scan"). Danh sách:
--   plan 205 (7): 218, 585, 586, 587, 588, 589, 590
--   plan 222 (9): 1507, 1508, 1511, 1515, 1519, 1523, 1535, 1538, 1541
--   plan 272 (1): 4510 (2 claim CLAMP)
--   plan 288 (1): 5170  -> mã TEST1231212 (mã test, xem mục 4)
--   plan 298 (1): 6225
--   plan 306 (1): 6829 (3 claim: CLAIM + KV + KD2)
--   plan 312 (2): 8018, 8021
--   plan 318 (1): 8250
--
-- ---------------------------------------------------------------------------
-- PHÁT HIỆN QUAN TRỌNG: 21/23 mã container ĐÃ ĐƯỢC NHẬP LẠI
-- ---------------------------------------------------------------------------
-- Khi quét chéo, 21 trong 23 mã container này ĐÃ TỒN TẠI trong DB với id MỚI, và
-- dòng mới đó ĐÃ CÓ claim của chính nó (cùng submission). Ví dụ plan 222:
--   dòng cũ 1507 TRLU9400685 (V20, sub 992)  -> claim cũ #450 @15/08 22:12
--   dòng mới 1593 TRLU9400685 (V20FR, sub 992) -> claim mới #508 @16/08 02:39
-- Tức là container đã được nhập lại, claim cũ chỉ là bản ghi TRÙNG còn sót lại.
--
-- Vì vậy KHÔNG được khôi phục dòng container cũ cho 21 trường hợp này:
--   • sẽ tạo 2 dòng cùng mã container trong cùng kế hoạch → bảng kê của khách
--     hàng bị nhân đôi;
--   • đẩy số container của lái xe lên sai → THAY ĐỔI SẢN LƯỢNG.
-- Cách vá đúng: NỐI LẠI claim cũ vào dòng container đang sống cùng mã + cùng kế
-- hoạch. Không thêm dòng container nào → sản lượng không đổi (xem mục "BẢO ĐẢM").
--
-- Chỉ 2 trường hợp mã container KHÔNG còn tồn tại ở đâu cả:
--   • 6829 WHSU8668815 (plan 306)  -> khôi phục dòng container (đúng như script
--     fix-orphan-container-plan306.sql đã làm, script này thay thế script đó);
--   • 5170 (plan 288) = TEST1231212 -> mã TEST, KHÔNG khôi phục (xem mục 4).
--
-- ---------------------------------------------------------------------------
-- BẢO ĐẢM KHÔNG ĐỔI SẢN LƯỢNG
-- ---------------------------------------------------------------------------
-- Sản lượng của lái xe đến từ 2 nguồn, script này không đụng tới nguồn nào:
--   1. `submissions` (hang_20/hang_40/vo_*/ve_sinh_lai/keo_ve) — script KHÔNG
--      UPDATE/INSERT/DELETE bảng submissions.
--   2. Số container trong "📊 Sản lượng của tôi" / Dashboard = đếm số dòng
--      container_imports gắn submission của lái xe. Script chỉ THÊM ĐÚNG 1 dòng
--      (id 6829) — dòng này vốn đã bị mất nên bảng kê plan 306 đang thiếu 1 H40.
--      21 trường hợp còn lại chỉ đổi container_import_id của claim, KHÔNG thêm
--      dòng container → số đếm không đổi.
-- Ngoài ra KHÔNG xoá claim nào, KHÔNG sửa nội dung claim nào.
--
-- CÁCH CHẠY (trên VPS, DB production)
--   psql -U <user> -d <db> -v ON_ERROR_STOP=1 -f fix-orphan-container-claims.sql
--
-- Đã kiểm chứng trên bản dump production 26-09-2026 08:00 (restore vào nw_fix):
--   • trước khi vá: 26 claim mồ côi / 23 container
--   • sau khi vá:   1 claim mồ côi (5170 - mã test) — nối lại 22 claim, khôi phục 1 dòng
--   • chạy lần 2 không thay đổi gì (idempotent)
--   • số dòng container mỗi kế hoạch: CHỈ plan 306 tăng 121 -> 122 (container 6829)
--   • sản lượng lái xe (container gắn submission của lái xe): CHỈ plan 306 / user 29
--     tăng 7 -> 8. Các cặp (kế hoạch, lái xe) khác giữ nguyên.
--   • bảng submissions: 0 dòng bị sửa.
--   • cặp KẸP của plan 222 giữ đúng như trước khi container bị xoá:
--     container chính SKHU1640536 (cũ 1511) ↔ container kẹp SKHU2840544 (cũ 1515).
--
-- LƯU Ý 1: 10 claim nối lại bị TRÙNG (cùng container, cùng submission, cùng loại)
--   với claim đã có của dòng nhập lại — xem báo cáo ở bước 7 của script. Đây là dữ
--   liệu lịch sử thật, không phải lỗi. Hệ quả: sheet "Container - Người chạy" của
--   các kế hoạch 222 / 298 / 318 sẽ hiện 2 dòng cho mấy container đó (bôi vàng =
--   có nhiều xác nhận). Muốn dọn thì xoá claim cũ, nhưng PHẢI giữ claim đứng ngay
--   trước 1 claim CLAMP cùng submission (nếu xoá, cặp KẸP sẽ mất).
--
-- LƯU Ý 2: script này THAY THẾ fix-orphan-container-plan306.sql (script cũ chỉ vá
--   riêng container 6829 và đặt keo_ve = true). Bản này khôi phục 6829 đúng như
--   trong backup: keo_ve = false. Nếu đã chạy script cũ rồi thì dòng 6829 sẽ được
--   bỏ qua; muốn sửa lại cờ thì chạy:
--     UPDATE container_imports SET keo_ve = false WHERE id = 6829;
-- =============================================================================

BEGIN;

-- ── 0. Dữ liệu khôi phục của 23 container (lấy từ bản backup cuối cùng còn
--       chứa chúng; riêng 5170 lấy mã từ lịch sử chat Zalo vì không có backup)
--    action: 'AUTO' = nếu có dòng cùng mã trong cùng kế hoạch thì NỐI claim vào
--                     dòng đó, nếu không có thì KHÔI PHỤC dòng container cũ;
--            'SKIP' = không đụng tới.
CREATE TEMP TABLE _orphan (
  orphan_id     int PRIMARY KEY,
  code          varchar(20),
  ctype         varchar(20),
  plan_id       int,
  imported_by   int,
  submission_id int,
  created_at    timestamp,
  action        varchar(10) NOT NULL
) ON COMMIT DROP;

INSERT INTO _orphan
  (orphan_id, code, ctype, plan_id, imported_by, submission_id, created_at, action)
VALUES
  -- plan 205 "Chuyển bãi" — lô nhập 12/08 10:51 bị xoá 13/08 14:00 sau khi nhập lại lô 597..971
  (218 , 'WHSU8195184', 'V40', 205, 27,  933, '2026-08-12 10:51:47.096588', 'AUTO'),
  (585 , 'WHSU6144655', 'V40', 205, 27,  934, '2026-08-12 10:51:47.807340', 'AUTO'),
  (586 , 'WHSU5011025', 'V40', 205, 27,  934, '2026-08-12 10:51:47.810133', 'AUTO'),
  (587 , 'WHSU8442670', 'V40', 205, 27,  934, '2026-08-12 10:51:47.812730', 'AUTO'),
  (588 , 'WHSU6909235', 'V40', 205, 27,  934, '2026-08-12 10:51:47.817213', 'AUTO'),
  (589 , 'WHSU5332107', 'V40', 205, 27,  934, '2026-08-12 10:51:47.819516', 'AUTO'),
  (590 , 'WHSU6551497', 'V40', 205, 27,  934, '2026-08-12 10:51:47.821910', 'AUTO'),
  -- plan 222 "DONGJIN" — lô nhập 15/08 14:10 bị xoá 16/08 08:00-08:30, nhập lại lô 1591..1604
  (1507, 'TRLU9400685', 'V20', 222, 27,  992, '2026-08-15 14:10:49.845821', 'AUTO'),
  (1508, 'SKHU5640391', 'V40', 222, 27,  994, '2026-08-15 14:10:49.847670', 'AUTO'),
  (1511, 'SKHU1640536', 'V20', 222, 27,  992, '2026-08-15 14:10:49.852882', 'AUTO'),
  (1515, 'SKHU2840544', 'V20', 222, 27,  992, '2026-08-15 14:10:49.861761', 'AUTO'),
  (1519, 'TOLU8101576', 'V20', 222, 27,  992, '2026-08-15 14:10:49.868624', 'AUTO'),
  (1523, 'TRIU0802288', 'V40', 222, 27,  994, '2026-08-15 14:10:49.876729', 'AUTO'),
  (1535, 'CAXU5720305', 'V40', 222, 27,  994, '2026-08-15 14:10:49.897889', 'AUTO'),
  (1538, 'CRXU7684599', 'V40', 222, 27,  994, '2026-08-15 14:10:49.902758', 'AUTO'),
  (1541, 'SEGU7637448', 'V40', 222, 27,  996, '2026-08-15 14:10:49.908154', 'AUTO'),
  -- plan 272 "SKY MOON" — 2 claim CLAMP của 2 lái xe khác nhau
  (4510, 'CKSU2239228', 'V20', 272, 27, 1278, '2026-09-04 12:29:00.750901', 'AUTO'),
  -- plan 288 "DJCO" — mã test, KHÔNG khôi phục (xem mục 4)
  (5170, 'TEST1231212', 'V40', 288, 27, 1372, '2026-09-11 18:21:11.597848', 'SKIP'),
  -- plan 298 "KOBE TRADER 2607N"
  (6225, 'HLHU8588366', 'H40', 298, 27, 1437, '2026-09-15 11:36:58.464956', 'AUTO'),
  -- plan 306 "W293" — container DUY NHẤT không còn tồn tại ở đâu: phải khôi phục
  (6829, 'WHSU8668815', 'H40', 306, 27, 1494, '2026-09-19 12:19:47.786800', 'AUTO'),
  -- plan 312 "BIỂN ĐÔNG MARINA"
  (8018, 'WHSU5085645', 'V40', 312, 27, 1521, '2026-09-21 15:23:23.939975', 'AUTO'),
  (8021, 'TIIU6354304', 'V40', 312, 27, NULL, '2026-09-21 15:23:23.946471', 'AUTO'),
  -- plan 318 "Hun Trùng"
  (8250, 'CAIU4699958', 'H20', 318, 27, 1531, '2026-09-23 03:02:29.375964', 'AUTO');


-- ── 1. Chốt an toàn: chỉ chạy khi mọi claim mồ côi đều nằm trong danh sách trên.
--       Nếu phát sinh container mồ côi mới (ngoài 23 cái này) → dừng, không sửa gì.
DO $$
DECLARE
  n_unknown int;
  ids       text;
BEGIN
  SELECT count(DISTINCT cc.container_import_id),
         string_agg(DISTINCT cc.container_import_id::text, ',' ORDER BY cc.container_import_id::text)
    INTO n_unknown, ids
    FROM container_claims cc
   WHERE NOT EXISTS (SELECT 1 FROM container_imports ci WHERE ci.id = cc.container_import_id)
     AND NOT EXISTS (SELECT 1 FROM _orphan o WHERE o.orphan_id = cc.container_import_id);

  IF n_unknown > 0 THEN
    RAISE EXCEPTION 'Co % container mo coi nam NGOAI danh sach da kiem chung: %. Dung lai de kiem tra.',
      n_unknown, ids;
  END IF;
END $$;

-- ── 2. NỐI LẠI claim vào dòng container đang sống cùng mã + cùng kế hoạch.
--       Đây là 21/23 trường hợp — KHÔNG thêm dòng container nào.
DO $$
DECLARE
  n int;
BEGIN
  UPDATE container_claims cl
     SET container_import_id = (
           SELECT min(ci.id)
             FROM container_imports ci
            WHERE trim(ci.container_code) = o.code
              AND ci.shipping_line_id      = o.plan_id
         )
    FROM _orphan o
   WHERE cl.container_import_id = o.orphan_id
     AND o.action = 'AUTO'
     -- chỉ nối khi dòng cũ THẬT SỰ đã mất...
     AND NOT EXISTS (SELECT 1 FROM container_imports x WHERE x.id = o.orphan_id)
     -- ...và có đúng dòng sống cùng mã trong cùng kế hoạch
     AND EXISTS (
           SELECT 1 FROM container_imports ci2
            WHERE trim(ci2.container_code) = o.code
              AND ci2.shipping_line_id      = o.plan_id
         );

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[2] Da noi lai % luot ghi nhan vao container dang song.', n;
END $$;

-- ── 3. KHÔI PHỤC dòng container cho trường hợp mã không còn tồn tại ở đâu cả
--       (chỉ 6829 WHSU8668815). Chốt an toàn: nếu mã này lại xuất hiện ở BẤT KỲ
--       kế hoạch nào thì dừng — khôi phục nữa sẽ thành nhân đôi container.
DO $$
DECLARE
  n int;
BEGIN
  -- Chỉ soi những mã THẬT SỰ sẽ được khôi phục: dòng cũ đã mất VÀ không có dòng
  -- sống cùng mã trong cùng kế hoạch (nếu có thì bước 2 đã nối claim rồi).
  IF EXISTS (
       SELECT 1 FROM _orphan o
        WHERE o.action = 'AUTO'
          AND NOT EXISTS (SELECT 1 FROM container_imports x WHERE x.id = o.orphan_id)
          AND NOT EXISTS (
                SELECT 1 FROM container_imports ci2
                 WHERE trim(ci2.container_code) = o.code
                   AND ci2.shipping_line_id      = o.plan_id
              )
          AND EXISTS (SELECT 1 FROM container_imports y WHERE trim(y.container_code) = o.code)
     ) THEN
    RAISE EXCEPTION 'Co ma container can khoi phuc nhung DA ton tai trong DB o ke hoach khac. Dung lai.';
  END IF;

  INSERT INTO container_imports
    (id, container_code, type, shipping_line_id, imported_by_id, submission_id,
     created_at, keo_ve, ve_sinh_lai, bundle_id, phat_sinh)
  SELECT o.orphan_id, o.code, o.ctype, o.plan_id, o.imported_by, o.submission_id,
         o.created_at, false, false, NULL, false
    FROM _orphan o
   WHERE o.action = 'AUTO'
     -- dòng cũ đã mất...
     AND NOT EXISTS (SELECT 1 FROM container_imports x WHERE x.id = o.orphan_id)
     -- ...và KHÔNG có dòng sống cùng mã trong cùng kế hoạch (những cái đó đã nối
     -- claim ở bước 2, khôi phục nữa sẽ thành nhân đôi container)
     AND NOT EXISTS (
           SELECT 1 FROM container_imports ci2
            WHERE trim(ci2.container_code) = o.code
              AND ci2.shipping_line_id      = o.plan_id
         );

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[3] Da khoi phuc % dong container bi thieu.', n;
END $$;

-- ── 4. Các trường hợp KHÔNG vá (mã test / rác) — chỉ báo cáo, không sửa.
--      5170 = TEST1231212 (plan 288 DJCO): lái xe Hưng gửi "31212" ngày 12/09
--      lúc 01:21, bot khớp vào mã mẫu TEST1231212 và ghi nhận 1 Vỏ 40.
--      Container này KHÔNG khôi phục vì sẽ thêm 1 dòng container GIẢ vào bảng kê
--      plan 288 → đổi sản lượng. Claim #3240 giữ nguyên (vô hại, không hiện ở đâu).
--
--      Muốn dọn hẳn thì bỏ comment 2 câu dưới (xoá claim rác):
--      DELETE FROM container_claims WHERE container_import_id = 5170;
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT o.orphan_id, o.code, o.plan_id,
           (SELECT count(*) FROM container_claims cc WHERE cc.container_import_id = o.orphan_id) AS n_claim
      FROM _orphan o
     WHERE o.action = 'SKIP'
  LOOP
    RAISE NOTICE '[4] BO QUA container % (%) plan % - con % claim mo coi (ma test/rac).',
      r.orphan_id, r.code, r.plan_id, r.n_claim;
  END LOOP;
END $$;

-- ── 5. Kiểm tra sau khi vá: các claim đã nối được container chưa
SELECT cc.container_import_id AS container_id,
       ci.container_code, ci.type, ci.shipping_line_id AS plan_id,
       cc.id AS claim_id, cc.claim_type, cc.submission_id, cc.created_at
  FROM container_claims cc
  JOIN container_imports ci ON ci.id = cc.container_import_id
 WHERE cc.container_import_id IN (SELECT orphan_id FROM _orphan WHERE action = 'AUTO')
 ORDER BY cc.container_import_id, cc.created_at;

-- ── 6. Số dòng container mỗi kế hoạch liên quan (để đối chiếu sản lượng)
SELECT ci.shipping_line_id AS plan_id, count(*) AS so_container
  FROM container_imports ci
 WHERE ci.shipping_line_id IN (SELECT DISTINCT plan_id FROM _orphan)
 GROUP BY 1
 ORDER BY 1;

-- ── 7. LƯU Ý: sau khi nối lại, có container mang 2 claim CÙNG submission + CÙNG
--       loại (claim cũ vừa nối vào + claim của dòng nhập lại). Đây là dữ liệu
--       lịch sử thật, không phải lỗi của script. Danh sách để đối chiếu:
SELECT ci.shipping_line_id AS plan_id, ci.id AS container_id, ci.container_code,
       cc.submission_id, cc.claim_type, count(*) AS so_lan
  FROM container_claims cc
  JOIN container_imports ci ON ci.id = cc.container_import_id
 WHERE ci.shipping_line_id IN (SELECT DISTINCT plan_id FROM _orphan)
 GROUP BY 1, 2, 3, 4, 5
HAVING count(*) > 1
 ORDER BY 1, 2, 5;

COMMIT;

-- =============================================================================
-- KIỂM TRA SAU KHI VÁ (chạy riêng, ngoài transaction)
-- =============================================================================
-- Còn claim mồ côi nào không?  Mong đợi: 1 (claim #3240 của 5170 - mã test).
--   select cc.container_import_id, count(*) from container_claims cc
--    where not exists (select 1 from container_imports ci where ci.id = cc.container_import_id)
--    group by 1 order by 1;
--
-- TRƯỚC khi vá: CLAIM 21, CLAMP 3, KD2 1, KV 1  (tổng 26)
-- SAU khi vá:   CLAIM  1                        (tổng  1)  <- chỉ còn 5170 (TEST1231212)
--
-- Sản lượng KHÔNG đổi — kiểm tra 2 nguồn:
--   a) submissions: script không hề UPDATE bảng này.
--   b) số container gắn submission của lái xe theo kế hoạch:
--      select ci.shipping_line_id, s.user_id, count(*)
--        from container_imports ci join submissions s on s.id = ci.submission_id
--       where ci.shipping_line_id in (205,222,272,288,298,306,312,318)
--       group by 1,2 order by 1,2;
--      -> chỉ plan 306 / user 29 tăng 7 -> 8 (container 6829 được khôi phục);
--         các cặp còn lại giữ nguyên.
-- =============================================================================
