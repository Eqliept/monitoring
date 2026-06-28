import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";

import { MessageAttachmentEntity } from "./message-attachment.entity";
import { MessageConversationEntity } from "./message-conversation.entity";
import { MessageLinkEntity } from "./message-link.entity";
import { UserEntity } from "./users.entity";

@Entity("messages")
@Index(["conversationId", "createdAt"])
@Index(["senderUserId"])
export class MessageEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    conversationId!: string;

    @ManyToOne(() => MessageConversationEntity, (conversation) => conversation.messages, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "conversationId" })
    conversation!: MessageConversationEntity;

    @Column({ type: "varchar" })
    senderUserId!: string;

    @ManyToOne(() => UserEntity, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "senderUserId" })
    sender!: UserEntity;

    @Column({ type: "text", nullable: true })
    text!: string | null;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @OneToMany(() => MessageAttachmentEntity, (attachment) => attachment.message)
    attachments!: MessageAttachmentEntity[];

    @OneToMany(() => MessageLinkEntity, (link) => link.message)
    links!: MessageLinkEntity[];
}
