
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMissingSchemas1766136989929 implements MigrationInterface {
    name = 'CreateMissingSchemas1766136989929'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // MENUS
        if (!(await queryRunner.getTable('menus'))) {
            await queryRunner.query(`CREATE TABLE "menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "label" character varying NOT NULL, "link" character varying, "icon" character varying, "order" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "parentId" uuid, CONSTRAINT "PK_3fec3d9cb9cbbf532675f9226g" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "menus" ADD CONSTRAINT "FK_722f67600874e0d421235123d" FOREIGN KEY ("parentId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        }

        // CARTS
        if (!(await queryRunner.getTable('carts'))) {
            await queryRunner.query(`CREATE TABLE "carts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, CONSTRAINT "REL_912384723466456" UNIQUE ("userId"), CONSTRAINT "PK_b54673645857989" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "carts" ADD CONSTRAINT "FK_912384723466456" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // CART ITEMS
        if (!(await queryRunner.getTable('cart_items'))) {
            await queryRunner.query(`CREATE TABLE "cart_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "cartId" uuid, "documentId" uuid, CONSTRAINT "PK_1236545785679" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "cart_items" ADD CONSTRAINT "FK_cart_item_cart" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            await queryRunner.query(`ALTER TABLE "cart_items" ADD CONSTRAINT "FK_cart_item_document" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // SEARCH HISTORY
        if (!(await queryRunner.getTable('search_history'))) {
            await queryRunner.query(`CREATE TABLE "search_history" ("id" SERIAL NOT NULL, "keyword" character varying NOT NULL, "count" integer NOT NULL DEFAULT '1', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_keyword_search" UNIQUE ("keyword"), CONSTRAINT "PK_search_history_id" PRIMARY KEY ("id"))`);
        }

        // WALLETS
        if (!(await queryRunner.getTable('wallets'))) {
            await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "balance" decimal(15,2) NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "REL_wallet_user" UNIQUE ("userId"), CONSTRAINT "PK_wallet_id" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "wallets" ADD CONSTRAINT "FK_wallet_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // TRANSACTIONS
        const transactionTypeEnum = await queryRunner.query(`SELECT 1 FROM pg_type WHERE typname = 'transaction_type_enum'`);
        if (transactionTypeEnum.length === 0) {
            await queryRunner.query(`CREATE TYPE "public"."transaction_type_enum" AS ENUM('deposit', 'withdraw', 'payment', 'commission')`);
        }

        if (!(await queryRunner.getTable('transactions'))) {
            await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."transaction_type_enum" NOT NULL, "amount" decimal(15,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "walletId" uuid NOT NULL, "orderId" uuid, CONSTRAINT "PK_transaction_id" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_transaction_wallet" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
            await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_transaction_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop in reverse order of dependency
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transaction_order"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transaction_wallet"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_type_enum"`);

        await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT "FK_wallet_user"`);
        await queryRunner.query(`DROP TABLE "wallets"`);

        await queryRunner.query(`DROP TABLE "search_history"`);

        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "FK_cart_item_document"`);
        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "FK_cart_item_cart"`);
        await queryRunner.query(`DROP TABLE "cart_items"`);

        await queryRunner.query(`ALTER TABLE "carts" DROP CONSTRAINT "FK_912384723466456"`);
        await queryRunner.query(`DROP TABLE "carts"`);

        await queryRunner.query(`ALTER TABLE "menus" DROP CONSTRAINT "FK_722f67600874e0d421235123d"`);
        await queryRunner.query(`DROP TABLE "menus"`);
    }

}
