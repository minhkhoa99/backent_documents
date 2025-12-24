import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFullTextSearch1766549825595 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX "IDX_FULLTEXT_SEARCH" 
            ON "documents" 
            USING GIN (to_tsvector('simple', "title"))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_FULLTEXT_SEARCH"`);
    }

}
