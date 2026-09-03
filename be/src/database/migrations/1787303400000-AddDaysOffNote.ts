import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDaysOffNote1787303400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "salary_records"
            ADD COLUMN IF NOT EXISTS "days_off_note" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "salary_records"
            DROP COLUMN IF EXISTS "days_off_note"
        `);
    }

}