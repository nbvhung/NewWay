-- ============================================================
--  Thêm quyền TÀI CHÍNH riêng (finance.view / finance.manage)
--  cho các tài khoản ĐANG có `dashboard.view` (tài khoản cũ).
--
--  Lý do: trước đây tab Tài chính gate bằng `dashboard.view`. Nay tách
--  riêng finance.view / finance.manage. Tài khoản có mảng `permissions`
--  tường minh (không NULL) sẽ thiếu quyền mới → phải bổ sung, nếu không
--  sẽ bị 403 khi vào tab Tài chính.
--
--  Tài khoản có `permissions IS NULL` KHÔNG cần chạy: sẽ dùng preset theo
--  role (preset mới đã bao gồm finance.view/manage).
--
--  Idempotent — chạy lại nhiều lần vẫn an toàn.
--
--  Chạy TRƯỚC khi build backend mới:
--    docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
--      < deploy/migrate-add-finance-tab-permissions.sql
-- ============================================================

UPDATE users
SET permissions = (
  SELECT array_agg(DISTINCT x ORDER BY x)
  FROM unnest(permissions || ARRAY['finance.view', 'finance.manage']) AS x
)
WHERE permissions IS NOT NULL
  AND array_length(permissions, 1) > 0
  AND 'dashboard.view' = ANY(permissions);

-- Kiểm tra nhanh sau khi chạy:
--   SELECT id, username, role, permissions FROM users
--   WHERE 'dashboard.view' = ANY(permissions) ORDER BY id;
