-- Tài khoản khách hàng (role 'partner') gắn với 1 khách hàng.
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id integer NULL;
