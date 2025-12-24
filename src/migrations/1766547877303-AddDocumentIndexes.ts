import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocumentIndexes1766547877303 implements MigrationInterface {
    name = 'AddDocumentIndexes1766547877303'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_553906d54e4e79077bc641a648" ON "documents" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_f8cc10f6d16ee343bbf23b829e" ON "documents" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e643e23280aed5b2cfc586e0c" ON "documents" ("views") `);
        await queryRunner.query(`CREATE INDEX "IDX_281b24ad10d8870f9ceb92eaed" ON "documents" ("discountPercentage") `);
        await queryRunner.query(`CREATE INDEX "IDX_080ade64420297efbb8b7fc881" ON "documents" ("isDeleted", "isActive", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_080ade64420297efbb8b7fc881"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_281b24ad10d8870f9ceb92eaed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e643e23280aed5b2cfc586e0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8cc10f6d16ee343bbf23b829e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_553906d54e4e79077bc641a648"`);
    }

}
