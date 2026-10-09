-- ════════════════════════════════════════════════════════════════════
-- Đổi lời template tin giao ca nhóm He Chun (GIỮ NGUYÊN khung giờ).
-- Chạy trên DB production (newway):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway < deploy/migrate-zalo-giao-ca-wording.sql
-- An toàn chạy lại nhiều lần (chỉ UPDATE nội dung).
-- ════════════════════════════════════════════════════════════════════

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của He Chun (06:45 đến 07:30). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
  AND s.send_time = '06:30:00';

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của He Chun (11:45 đến 13:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
  AND s.send_time = '11:30:00';

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của He Chun (18:45 đến 19:30). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
  AND s.send_time = '18:30:00';

UPDATE zalo_group_schedules s
SET content = E'Các anh lái xe lưu ý: Sắp đến giờ giao ca của He Chun (23:45 đến 01:00). Các anh vui lòng bố trí thời gian nghỉ ngơi tái tạo sức lao động nhé.\nTrân trọng.'
FROM zalo_groups g
WHERE s.group_id = g.id
  AND g.chat_id = 'zgr-6007a1f13ea1d7ff8eb0'
  AND s.send_time = '23:30:00';

SELECT 'Đã cập nhật lời tin giao ca He Chun' AS status;
