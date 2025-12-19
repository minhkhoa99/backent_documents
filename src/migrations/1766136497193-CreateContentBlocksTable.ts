
import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateContentBlocksTable1766136497193 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "content_blocks",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid",
                    default: "uuid_generate_v4()" // Requires uuid-ossp extension, standard in many setups. Or use proper PSQL syntax based on env. Let's assume uuid-ossp.
                },
                {
                    name: "title",
                    type: "varchar",
                },
                {
                    name: "type",
                    type: "varchar",
                    // Using varchar for enum to keep migration simple and portable, can be cleaner with native enum but requires separate type creation.
                    default: "'LATEST'",
                },
                {
                    name: "order",
                    type: "int",
                    default: 0,
                },
                {
                    name: "isVisible",
                    type: "boolean",
                    default: true,
                },
                {
                    name: "config",
                    type: "jsonb",
                    isNullable: true,
                },
                {
                    name: "createdAt",
                    type: "timestamp",
                    default: "now()",
                },
                {
                    name: "updatedAt",
                    type: "timestamp",
                    default: "now()",
                },
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("content_blocks");
    }

}
