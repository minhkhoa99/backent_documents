import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddIsDeletedAndIsActiveToDocuments1765773567934 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('documents', new TableColumn({
            name: 'isDeleted',
            type: 'boolean',
            default: false
        }));

        await queryRunner.addColumn('documents', new TableColumn({
            name: 'isActive',
            type: 'boolean',
            default: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('documents', 'isActive');
        await queryRunner.dropColumn('documents', 'isDeleted');
    }

}
