-- Migration: Lịch sử thanh toán lương (ai thực hiện lệnh gì, cho lái xe nào, khi nào)
-- Chạy trên DB production (container postgres trên VPS):
--   docker exec -i newway-postgres-1 psql -U postgres -d newway -f - < migrate-add-salary-payment-log.sql
--
-- QUAN TRỌNG: phải chạy migration NÀY trước khi deploy code backend mới.

CREATE TABLE IF NOT EXISTS "salary_payment_logs" (
    "id" SERIAL PRIMARY KEY,
    "driver_id" integer NOT NULL,
    "driver_name" varchar(255) DEFAULT '',
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "action" varchar(30) NOT NULL,
    "performed_by_id" integer,
    "performed_by_name" varchar(255) DEFAULT '',
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_salary_payment_logs_my" ON "salary_payment_logs" ("month", "year");
CREATE INDEX IF NOT EXISTS "idx_salary_payment_logs_driver" ON "salary_payment_logs" ("driver_id");