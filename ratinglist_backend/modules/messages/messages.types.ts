import { MessageAttachmentType } from "../../database/entities/message-attachment.entity";

export type MessageAttachmentPayload = {
    type: MessageAttachmentType;
    url: string;
    publicId?: string | null;
    mimeType: string;
    sizeBytes: number;
};

export type SendMessagePayload = {
    text?: string | null;
    attachments?: MessageAttachmentPayload[];
};

export type ConversationListQuery = {
    serverId?: string;
    search?: string;
    page?: number;
    limit?: number;
};
