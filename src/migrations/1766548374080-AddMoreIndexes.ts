import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMoreIndexes1766548374080 implements MigrationInterface {
    name = 'AddMoreIndexes1766548374080'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_4b2bf18167e94dce386d714c67" ON "users" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_a000cca60bcf04454e72769949" ON "users" ("phone") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b57f5a4e38afb41bc7b110d9c" ON "menus" ("order") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a62a3abf8d3243b39aeaadbb8" ON "content_blocks" ("order") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3fbdf88b7181fe1860bb01ec5" ON "content_blocks" ("isVisible") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f3fbdf88b7181fe1860bb01ec5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a62a3abf8d3243b39aeaadbb8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4b57f5a4e38afb41bc7b110d9c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a000cca60bcf04454e72769949"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4b2bf18167e94dce386d714c67"`);
    }

}
