import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalaryComponents1787303328000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "allowance_far_home" numeric(15,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "allowance_wait_loading" numeric(15,2) DEFAULT 0
        `);

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "salary_settings" (
                "id" SERIAL PRIMARY KEY,
                "fixed_salary" numeric(15,2) DEFAULT 7000000,
                "attendance_bonus" numeric(15,2) DEFAULT 0,
                "standard_days" integer DEFAULT 26,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "salary_records" (
                "id" SERIAL PRIMARY KEY,
                "driver_id" integer NOT NULL,
                "month" integer NOT NULL,
                "year" integer NOT NULL,
                "fixed_salary" numeric(15,2) DEFAULT 0,
                "attendance_bonus" numeric(15,2) DEFAULT 0,
                "allowance_far_home" numeric(15,2) DEFAULT 0,
                "allowance_wait_loading_rate" numeric(15,2) DEFAULT 0,
                "wait_loading_count" integer DEFAULT 0,
                "days_off" jsonb DEFAULT '[]',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_salary_records_driver_month_year" UNIQUE ("driver_id", "month", "year"),
                CONSTRAINT "FK_salary_records_driver" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_salary_records_driver" ON "salary_records" ("driver_id")
        `);

    const count = await queryRunner.query(
      `SELECT COUNT(*)::int AS c FROM "salary_settings"`,
    );
    if (!count?.[0]?.c) {
      await queryRunner.query(`
                INSERT INTO "salary_settings" ("fixed_salary", "attendance_bonus", "standard_days")
                VALUES (7000000, 0, 26)
            `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "salary_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "salary_settings"`);
    await queryRunner.query(`
            ALTER TABLE "users"
            DROP COLUMN IF EXISTS "allowance_far_home",
            DROP COLUMN IF EXISTS "allowance_wait_loading"
        `);
  }
}
