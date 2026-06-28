import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";

import { ServerEntity } from "./server.entity";

@Entity("server_search_embeddings")
export class ServerSearchEmbeddingEntity {
    @PrimaryColumn({ type: "varchar" })
    serverId!: string;

    @OneToOne(() => ServerEntity, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "serverId" })
    server!: ServerEntity;

    @Column({ type: "text" })
    context!: string;

    @Column({ type: "vector", length: 1536 })
    embedding!: number[];

    @Column({ type: "varchar" })
    model!: string;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
