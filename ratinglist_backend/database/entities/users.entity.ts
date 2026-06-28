import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";

import { ServerEntity } from "./server.entity";

@Entity("users")
export class UserEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar", nullable: true })
    username!: string | null;

    @Column({ type: "varchar", nullable: true })
    firstName!: string | null;

    @Column({ type: "varchar", nullable: true })
    lastName!: string | null;

    @Column({ type: "varchar", nullable: true })
    telegram!: string | null;

    @Column({ type: "varchar", nullable: true })
    avatarUrl!: string | null;

    @Column({ type: "integer", default: 0 })
    balanceRub!: number;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;

    @OneToMany(() => ServerEntity, (server) => server.owner)
    servers!: ServerEntity[];
}
