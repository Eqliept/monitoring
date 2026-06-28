import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { MessageEntity } from "./message.entity";

@Entity("message_links")
@Index(["messageId"])
export class MessageLinkEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    messageId!: string;

    @ManyToOne(() => MessageEntity, (message) => message.links, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "messageId" })
    message!: MessageEntity;

    @Column({ type: "text" })
    url!: string;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;
}
