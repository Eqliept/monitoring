import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import crypto from "crypto";

type CloudinaryUploadResult = {
    secure_url: string;
    public_id: string;
};

type CloudinaryClient = {
    uploadDataUrl: (dataUrl: string) => Promise<CloudinaryUploadResult>;
    uploadChatDataUrl: (dataUrl: string) => Promise<CloudinaryUploadResult>;
};

declare module "fastify" {
    interface FastifyInstance {
        cloudinary: CloudinaryClient;
    }
}

function getCloudinaryConfig() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
    const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";
    const folder = process.env.CLOUDINARY_FOLDER ?? "astronix";

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary credentials are not configured");
    }

    return { cloudName, apiKey, apiSecret, folder };
}

async function uploadDataUrlToResource(dataUrl: string, resourceType: "image" | "auto"): Promise<CloudinaryUploadResult> {
    const { cloudName, apiKey, apiSecret, folder } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
        .createHash("sha1")
        .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
        .digest("hex");

    const body = new URLSearchParams({
        file: dataUrl,
        api_key: apiKey,
        timestamp,
        folder,
        signature,
    });

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Cloudinary upload failed: ${text}`);
    }

    return (await response.json()) as CloudinaryUploadResult;
}

async function uploadDataUrl(dataUrl: string): Promise<CloudinaryUploadResult> {
    return await uploadDataUrlToResource(dataUrl, "image");
}

async function uploadChatDataUrl(dataUrl: string): Promise<CloudinaryUploadResult> {
    return await uploadDataUrlToResource(dataUrl, "auto");
}

async function cloudinaryPlugin(fastify: FastifyInstance) {
    fastify.decorate("cloudinary", {
        uploadDataUrl,
        uploadChatDataUrl,
    });
}

export default fp(cloudinaryPlugin);
