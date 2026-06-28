import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("message_read_states")
@Index(["userId"])
export class MessageReadStateEntity {
    @PrimaryColumn({ type: "varchar" })
    conversationId!: string;

    @PrimaryColumn({ type: "varchar" })
    userId!: string;

    @Column({ type: "varchar", nullable: true })
    lastReadMessageId!: string | null;

    @Column({ type: "timestamp", nullable: true })
    lastReadAt!: Date | null;
}
