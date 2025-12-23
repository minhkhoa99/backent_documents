import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddDiscountToDocument1766475600000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('documents');
        const column = table?.findColumnByName('discountPercentage');

        if (!column) {
            await queryRunner.addColumn('documents', new TableColumn({
                name: 'discountPercentage',
                type: 'int',
                isNullable: false,
                default: 0
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('documents', 'discountPercentage');
    }
}
