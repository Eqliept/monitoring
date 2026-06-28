import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { MessageEntity } from "./message.entity";

export enum MessageAttachmentType {
    Image = "image",
    Video = "video",
    Gif = "gif",
}

@Entity("message_attachments")
@Index(["messageId"])
@Index(["type"])
export class MessageAttachmentEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    messageId!: string;

    @ManyToOne(() => MessageEntity, (message) => message.attachments, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "messageId" })
    message!: MessageEntity;

    @Column({
        type: "enum",
        enum: MessageAttachmentType,
    })
    type!: MessageAttachmentType;

    @Column({ type: "varchar" })
    url!: string;

    @Column({ type: "varchar", nullable: true })
    publicId!: string | null;

    @Column({ type: "varchar" })
    mimeType!: string;

    @Column({ type: "integer" })
    sizeBytes!: number;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;
}
