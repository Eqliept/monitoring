import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1781722808693 implements MigrationInterface {
    name = 'Auto1781722808693'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "categories" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "imageUrls" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "versions" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "managers" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "managers" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "versions" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "imageUrls" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "servers" ALTER COLUMN "categories" SET DEFAULT '{}'`);
    }

}
