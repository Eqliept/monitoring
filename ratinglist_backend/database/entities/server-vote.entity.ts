import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { ServerEntity } from "./server.entity";
import { UserEntity } from "./users.entity";

@Entity("server_votes")
@Index(["serverId", "createdAt"])
@Index(["userId", "createdAt"])
@Index(["serverId", "userId"])
export class ServerVoteEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    serverId!: string;

    @ManyToOne(() => ServerEntity, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "serverId" })
    server!: ServerEntity;

    @Column({ type: "varchar" })
    userId!: string;

    @ManyToOne(() => UserEntity, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "userId" })
    user!: UserEntity;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;
}
