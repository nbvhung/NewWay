-- ════════════════════════════════════════════════════════════════════
-- Migration: Tự động BẬT/TẮT tin giao ca hằng ngày theo kế hoạch (2026-09)
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < migrate-zalo-group-auto.sql
-- An toàn chạy lại nhiều lần (IF NOT EXISTS / WHERE NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. zalo_groups: cờ active + keyword tuyến ──────────────────────
ALTER TABLE zalo_groups ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE zalo_groups ADD COLUMN IF NOT EXISTS route_keyword VARCHAR(100) NOT NULL DEFAULT '';

-- ─── 2. Bảng template tin giao ca của từng nhóm ──────────────────────
CREATE TABLE IF NOT EXISTS zalo_group_schedules (
  id        SERIAL PRIMARY KEY,
  group_id  INT NOT NULL REFERENCES zalo_groups(id) ON DELETE CASCADE,
  send_time TIME NOT NULL,          -- giờ VN (Asia/Ho_Chi_Minh)
  content   TEXT NOT NULL
);
ALTER TABLE zalo_group_schedules ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();

-- ─── 3. Gán keyword cho 2 nhóm ───────────────────────────────────────
UPDATE zalo_groups SET route_keyword = 'hph'    WHERE chat_id = 'zgr-0ed4f3ce70ab99f5c0ba';
UPDATE zalo_groups SET route_keyword = 'hechun,hc' WHERE chat_id = 'zgr-6007a1f13ea1d7ff8eb0';

-- ─── 4. Seed template tin giao ca HPH ────────────────────────────────
INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '05:15:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của HPH (05:30 đến 06:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh OPS HPH ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '05:15:00');

INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '11:15:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của HPH (11:30 đến 12:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh OPS HPH ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '11:15:00');

INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '17:15:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của HPH (17:30 đến 18:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh OPS HPH ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '17:15:00');

INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '23:45:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của HPH (00:00 đến 00:30). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh OPS HPH ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '23:45:00');

-- ─── 5. Seed template tin giao ca He Chun ────────────────────────────
INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '06:30:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của He Chun (06:45 đến 07:30). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh Hê Chun ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '06:30:00');

INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '11:30:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của He Chun (11:45 đến 13:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh Hê Chun ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '11:30:00');

INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '18:30:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của He Chun (18:45 đến 19:30). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh Hê Chun ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '18:30:00');

INSERT INTO zalo_group_schedules (group_id, send_time, content)
SELECT g.id, '23:30:00',
E'Các anh lái xe thân mến, sắp đến giờ giao ca của He Chun (23:45 đến 01:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé. Yêu các anh 🥰\nAnh Hê Chun ơi nếu cần anh em tăng ca thì nhắn một câu nhé. Yêu luôn cả anh 🥰'
FROM zalo_groups g WHERE g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
AND NOT EXISTS (SELECT 1 FROM zalo_group_schedules s WHERE s.group_id = g.id AND s.send_time = '23:30:00');