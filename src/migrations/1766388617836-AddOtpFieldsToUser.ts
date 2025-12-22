import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOtpFieldsToUser1766388617836 implements MigrationInterface {
    name = 'AddOtpFieldsToUser1766388617836'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "is_verify" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otp_code" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otp_exp" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otp_retry" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_retry"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_exp"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_code"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_verify"`);
    }

}
