import { FastifyReply, FastifyRequest } from "fastify";

import { BlogsService } from "./blogs.service/blogs.service";
import { BlogPostDraftBody, BlogPostParams } from "./blogs.types";

function getBlogsService(request: FastifyRequest) {
    return new BlogsService(request.server);
}

export async function listBlogPosts(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await getBlogsService(request).listPosts());
}

export async function createBlogPost(
    request: FastifyRequest<{ Body: BlogPostDraftBody }>,
    reply: FastifyReply,
) {
    return reply.status(201).send(await getBlogsService(request).createPost(request.body));
}

export async function updateBlogPost(
    request: FastifyRequest<{ Params: BlogPostParams; Body: BlogPostDraftBody }>,
    reply: FastifyReply,
) {
    return reply.send(await getBlogsService(request).updatePost(request.params.postId, request.body));
}

export async function deleteBlogPost(
    request: FastifyRequest<{ Params: BlogPostParams }>,
    reply: FastifyReply,
) {
    return reply.send(await getBlogsService(request).deletePost(request.params.postId));
}

export async function markBlogPostViewed(
    request: FastifyRequest<{ Params: BlogPostParams }>,
    reply: FastifyReply,
) {
    const token = request.cookies["access_token"];
    return reply.send(await getBlogsService(request).markPostViewed(request.params.postId, token));
}
