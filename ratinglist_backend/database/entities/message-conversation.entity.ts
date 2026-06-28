import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";

import { ServerEntity } from "./server.entity";
import { UserEntity } from "./users.entity";
import { MessageEntity } from "./message.entity";

@Entity("message_conversations")
@Index(["serverId", "playerUserId"], { unique: true })
@Index(["serverId"])
@Index(["playerUserId"])
@Index(["lastMessageAt"])
export class MessageConversationEntity {
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
    playerUserId!: string;

    @ManyToOne(() => UserEntity, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "playerUserId" })
    player!: UserEntity;

    @Column({ type: "varchar", nullable: true })
    lastMessageId!: string | null;

    @Column({ type: "text", nullable: true })
    lastMessageText!: string | null;

    @Column({ type: "varchar", nullable: true })
    lastMessageSenderUserId!: string | null;

    @Column({ type: "timestamp", nullable: true })
    lastMessageAt!: Date | null;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;

    @OneToMany(() => MessageEntity, (message) => message.conversation)
    messages!: MessageEntity[];
}
