import { FastifyReply, FastifyRequest } from "fastify";

import { MessageAttachmentType } from "../../database/entities/message-attachment.entity";
import { AppError, UnauthorizedError } from "../../errors/appErrors";

const MAX_CHAT_MEDIA_BYTES = 5 * 1024 * 1024;
const ALLOWED_CHAT_MEDIA_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
]);

function parseDataUrl(dataUrl: string): { mimeType: string; sizeBytes: number } {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);

    if (!match) {
        throw new AppError("Нужен корректный base64 data URL", 400);
    }

    const [, mimeType, base64] = match;
    return {
        mimeType: mimeType.toLowerCase(),
        sizeBytes: Buffer.byteLength(base64, "base64"),
    };
}

function getAttachmentType(mimeType: string): MessageAttachmentType {
    if (mimeType === "image/gif") {
        return MessageAttachmentType.Gif;
    }

    if (mimeType.startsWith("image/")) {
        return MessageAttachmentType.Image;
    }

    return MessageAttachmentType.Video;
}

export async function uploadImage(
    request: FastifyRequest<{ Body: { dataUrl: string } }>,
    reply: FastifyReply,
) {
    const token = request.cookies["access_token"];

    if (!token) {
        throw new UnauthorizedError("Access token не предоставлен");
    }

    const dataUrl = request.body.dataUrl?.trim();

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
        throw new AppError("Нужен корректный image data URL", 400);
    }

    const uploaded = await request.server.cloudinary.uploadDataUrl(dataUrl);

    return reply.send({
        secure_url: uploaded.secure_url,
        public_id: uploaded.public_id,
    });
}

export async function uploadChatMedia(
    request: FastifyRequest<{ Body: { dataUrl: string } }>,
    reply: FastifyReply,
) {
    const token = request.cookies["access_token"];

    if (!token) {
        throw new UnauthorizedError("Access token не предоставлен");
    }

    const dataUrl = request.body.dataUrl?.trim();

    if (!dataUrl) {
        throw new AppError("Файл не предоставлен", 400);
    }

    const { mimeType, sizeBytes } = parseDataUrl(dataUrl);

    if (!ALLOWED_CHAT_MEDIA_TYPES.has(mimeType)) {
        throw new AppError("Можно отправлять только фото, видео и gif", 400);
    }

    if (sizeBytes > MAX_CHAT_MEDIA_BYTES) {
        throw new AppError("Файл должен быть не больше 5 МБ", 400);
    }

    const uploaded = await request.server.cloudinary.uploadChatDataUrl(dataUrl);

    return reply.send({
        type: getAttachmentType(mimeType),
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        mimeType,
        sizeBytes,
    });
}
