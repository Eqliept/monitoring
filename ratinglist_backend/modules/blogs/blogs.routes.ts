import { FastifyInstance } from "fastify";

import {
    createBlogPost,
    deleteBlogPost,
    listBlogPosts,
    markBlogPostViewed,
    updateBlogPost,
} from "./blogs.controller";
import {
    blogPostCreateSchema,
    blogPostParamSchema,
    blogPostUpdateSchema,
} from "./blogs.schema";

export async function blogsRoutes(fastify: FastifyInstance) {
    fastify.get("/", listBlogPosts);
    fastify.post("/", { schema: blogPostCreateSchema }, createBlogPost);
    fastify.patch("/:postId", { schema: blogPostUpdateSchema }, updateBlogPost);
    fastify.delete("/:postId", { schema: blogPostParamSchema }, deleteBlogPost);
    fastify.post("/:postId/view", { schema: blogPostParamSchema }, markBlogPostViewed);
}
