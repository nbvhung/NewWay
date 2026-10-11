-- ════════════════════════════════════════════════════════════════════
-- Đổi lời template tin giao ca nhóm HPH (GIỮ NGUYÊN khung giờ).
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < deploy/migrate-zalo-giao-ca-wording-hph.sql
-- An toàn chạy lại nhiều lần (chỉ UPDATE nội dung).
-- ════════════════════════════════════════════════════════════════════

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của HPH (05:30 đến 06:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
  AND s.send_time = '05:15:00';

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của HPH (11:30 đến 12:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
  AND s.send_time = '11:15:00';

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của HPH (17:30 đến 18:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
  AND s.send_time = '17:15:00';

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của HPH (00:00 đến 00:30). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-0ed4f3ce70ab99f5c0ba'
  AND s.send_time = '23:45:00';

SELECT 'Đã cập nhật lời tin giao ca HPH' AS status;
