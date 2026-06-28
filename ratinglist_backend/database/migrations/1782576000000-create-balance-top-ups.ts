import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBalanceTopUps1782576000000 implements MigrationInterface {
    name = "CreateBalanceTopUps1782576000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type type
                    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
                    WHERE type.typname = 'balance_top_ups_provider_enum'
                      AND namespace.nspname = 'public'
                ) THEN
                    CREATE TYPE "public"."balance_top_ups_provider_enum" AS ENUM ('cryptocloud', 'tbank');
                END IF;
            END
            $$
        `);
        await queryRunner.query(`
            ALTER TYPE "public"."balance_top_ups_provider_enum"
            ADD VALUE IF NOT EXISTS 'tbank'
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type type
                    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
                    WHERE type.typname = 'balance_top_ups_status_enum'
                      AND namespace.nspname = 'public'
                ) THEN
                    CREATE TYPE "public"."balance_top_ups_status_enum" AS ENUM (
                        'pending',
                        'paid',
                        'partial',
                        'overpaid',
                        'canceled',
                        'failed'
                    );
                END IF;
            END
            $$
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "balance_top_ups" (
                "id" varchar NOT NULL,
                "userId" varchar NOT NULL,
                "provider" "public"."balance_top_ups_provider_enum" NOT NULL,
                "status" "public"."balance_top_ups_status_enum" NOT NULL DEFAULT 'pending',
                "amountRub" integer NOT NULL,
                "creditedAmountRub" integer NOT NULL DEFAULT 0,
                "providerInvoiceId" varchar,
                "paymentUrl" varchar,
                "providerPayload" jsonb,
                "paidAt" timestamp,
                "expiresAt" timestamp,
                "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_balance_top_ups_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_balance_top_ups_provider_invoice"
            ON "balance_top_ups" ("provider", "providerInvoiceId")
            WHERE "providerInvoiceId" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_balance_top_ups_provider_invoice"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "balance_top_ups"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."balance_top_ups_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."balance_top_ups_provider_enum"`);
    }
}
