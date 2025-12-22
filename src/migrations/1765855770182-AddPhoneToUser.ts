import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneToUser1765855770182 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('users');
        if (!table) return;

        if (!table.findColumnByName('phone')) {
            await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    }

}
