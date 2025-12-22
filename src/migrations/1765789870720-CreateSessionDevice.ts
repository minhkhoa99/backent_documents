import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSessionDevice1765789870720 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('session_devices');
        if (table) return;

        await queryRunner.query(`
            CREATE TABLE "session_devices" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "jti" character varying,
                "jti_rf" character varying,
                "exp" bigint NOT NULL,
                "user_agent" character varying NOT NULL,
                "revoked" boolean NOT NULL DEFAULT false,
                "device_token" character varying,
                "device_name" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "user_id" uuid,
                CONSTRAINT "PK_session_devices_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "session_devices" 
            ADD CONSTRAINT "FK_session_devices_user_id" FOREIGN KEY ("user_id") 
            REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session_devices" DROP CONSTRAINT "FK_session_devices_user_id"`);
        await queryRunner.query(`DROP TABLE "session_devices"`);
    }

}
