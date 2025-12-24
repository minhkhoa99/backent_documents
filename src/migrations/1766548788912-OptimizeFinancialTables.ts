import { MigrationInterface, QueryRunner } from "typeorm";

export class OptimizeFinancialTables1766548788912 implements MigrationInterface {
    name = 'OptimizeFinancialTables1766548788912'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_f1d359a55923bb45b057fbdab0" ON "order_items" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f00e04a3801422d34c69bfd28" ON "order_items" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_151b79a83ba240b0cb31b2302d" ON "orders" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d5fa024a84dceb158b2b95f34" ON "transactions" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_a88f466d39796d3081cf96e1b6" ON "transactions" ("walletId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2fdbbae70ff802bc8b703ee7c5" ON "transactions" ("orderId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_2fdbbae70ff802bc8b703ee7c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a88f466d39796d3081cf96e1b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d5fa024a84dceb158b2b95f34"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_151b79a83ba240b0cb31b2302d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_775c9f06fc27ae3ff8fb26f2c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f00e04a3801422d34c69bfd28"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1d359a55923bb45b057fbdab0"`);
    }

}
