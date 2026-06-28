import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";

import { AccountEntity } from "../../../database/entities/account.entity";
import { BlogPostEntity } from "../../../database/entities/blog-post.entity";
import { AppError, NotFoundError, UnauthorizedError } from "../../../errors/appErrors";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";
import { BlogPostDraftBody } from "../blogs.types";

const blogCacheNamespace = "blogs";
const accessSecret = process.env.JWT_SECRET ?? "";

if (!accessSecret) {
    throw new Error("Критическая ошибка: JWT секрет не задан в .env");
}

interface CachedBlogPost {
    id: string;
    title: string;
    imageUrl: string;
    summary: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

function normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

function normalizeContent(value: string): string {
    return value.trim();
}

export class BlogsService {
    constructor(private readonly fastify: FastifyInstance) {}

    private get blogRepository() {
        return this.fastify.dataSource.getRepository(BlogPostEntity);
    }

    private get accountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private async getAccountFromAccessToken(token?: string): Promise<AccountEntity> {
        if (!token) {
            throw new UnauthorizedError("Access token не предоставлен");
        }

        let decoded: JwtPayload;

        try {
            decoded = jwt.verify(token, accessSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedError("Неверный или просроченный access token");
        }

        const subject = decoded.sub as string | undefined;

        if (!subject) {
            throw new UnauthorizedError("Неверный access token (нет sub)");
        }

        const account = await this.accountRepository.findOne({ where: { id: subject } });

        if (!account) {
            throw new UnauthorizedError("Аккаунт не найден");
        }

        return account;
    }

    private buildViewsKey(postId: string): string {
        return `blogs:views:${postId}`;
    }

    private buildViewedAccountKey(postId: string, accountId: string): string {
        return `blogs:viewed:${postId}:${accountId}`;
    }

    private async getViewsByPostId(postIds: string[]): Promise<Map<string, number>> {
        if (postIds.length === 0 || !this.fastify.redis.isReady) {
            return new Map();
        }

        const values = await this.fastify.redis.mGet(postIds.map((postId) => this.buildViewsKey(postId)));

        return new Map(
            postIds.map((postId, index) => {
                const parsedViews = Number(values[index] ?? 0);
                return [postId, Number.isFinite(parsedViews) ? parsedViews : 0];
            }),
        );
    }

    private serializeBasePost(post: BlogPostEntity): CachedBlogPost {
        return {
            id: post.id,
            title: post.title,
            imageUrl: post.imageUrl,
            summary: post.summary,
            content: post.content,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
        };
    }

    private serializePost(post: CachedBlogPost, views: number) {
        return {
            ...post,
            views,
        };
    }

    async listPosts() {
        const result = await getCachedJson(
            this.fastify,
            blogCacheNamespace,
            { scope: "published-list-v2" },
            120,
            async () => {
                const posts = await this.blogRepository.find({
                    where: { isPublished: true },
                    order: {
                        createdAt: "DESC",
                    },
                });

                return posts.map((post) => this.serializeBasePost(post));
            },
        );
        const viewsByPostId = await this.getViewsByPostId(result.map((post) => post.id));

        return {
            posts: result.map((post) => this.serializePost(post, viewsByPostId.get(post.id) ?? 0)),
        };
    }

    async createPost(payload: BlogPostDraftBody) {
        const now = new Date();
        const post = this.blogRepository.create({
            id: randomUUID(),
            title: normalizeText(payload.title),
            imageUrl: normalizeContent(payload.imageUrl),
            summary: normalizeText(payload.summary),
            content: normalizeContent(payload.content),
            isPublished: true,
            createdAt: now,
            updatedAt: now,
        });

        await this.blogRepository.save(post);
        await invalidateCacheNamespaces(this.fastify, [blogCacheNamespace]);

        return this.serializePost(this.serializeBasePost(post), 0);
    }

    async updatePost(postId: string, payload: BlogPostDraftBody) {
        const post = await this.blogRepository.findOne({
            where: {
                id: postId,
                isPublished: true,
            },
        });

        if (!post) {
            throw new NotFoundError("Пост не найден");
        }

        post.title = normalizeText(payload.title);
        post.imageUrl = normalizeContent(payload.imageUrl);
        post.summary = normalizeText(payload.summary);
        post.content = normalizeContent(payload.content);
        post.updatedAt = new Date();

        await this.blogRepository.save(post);
        await invalidateCacheNamespaces(this.fastify, [blogCacheNamespace]);

        const views = (await this.getViewsByPostId([post.id])).get(post.id) ?? 0;

        return this.serializePost(this.serializeBasePost(post), views);
    }

    async deletePost(postId: string) {
        const post = await this.blogRepository.findOne({
            where: {
                id: postId,
                isPublished: true,
            },
        });

        if (!post) {
            throw new NotFoundError("Пост не найден");
        }

        post.isPublished = false;
        post.updatedAt = new Date();

        await this.blogRepository.save(post);
        await invalidateCacheNamespaces(this.fastify, [blogCacheNamespace]);

        const views = (await this.getViewsByPostId([post.id])).get(post.id) ?? 0;

        return this.serializePost(this.serializeBasePost(post), views);
    }

    async markPostViewed(postId: string, token?: string) {
        if (!this.fastify.redis.isReady) {
            throw new AppError("Redis недоступен для сохранения просмотров", 503);
        }

        const account = await this.getAccountFromAccessToken(token);
        const post = await this.blogRepository.findOne({
            where: {
                id: postId,
                isPublished: true,
            },
        });

        if (!post) {
            throw new NotFoundError("Пост не найден");
        }

        const viewedKey = this.buildViewedAccountKey(post.id, account.id);
        const createdViewMark = await this.fastify.redis.set(viewedKey, "1", { NX: true });

        if (createdViewMark) {
            await this.fastify.redis.incr(this.buildViewsKey(post.id));
        }

        const views = (await this.getViewsByPostId([post.id])).get(post.id) ?? 0;

        return this.serializePost(this.serializeBasePost(post), views);
    }
}
