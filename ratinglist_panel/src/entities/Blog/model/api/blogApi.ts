import type { BlogPost, BlogPostDraft } from "../types";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const blogBaseUrl = `${backendUrl}/api/blogs`;

type BlogListResponse = BlogPost[] | { posts: BlogPost[] };

async function parseBlogResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let message = fallbackMessage;

    try {
      const text = await response.clone().text();
      const data = text ? JSON.parse(text) : null;
      message = typeof data?.message === "string" ? data.message : message;
    } catch {
      const text = await response.clone().text();

      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function normalizeBlogList(response: BlogListResponse): BlogPost[] {
  return Array.isArray(response) ? response : response.posts;
}

export async function loadBlogPosts(): Promise<BlogPost[]> {
  const response = await fetch(blogBaseUrl, {
    method: "GET",
    credentials: "include",
  });

  const data = await parseBlogResponse<BlogListResponse>(
    response,
    "Не удалось загрузить блоги",
  );

  return normalizeBlogList(data);
}

export async function createBlogPost(payload: BlogPostDraft): Promise<BlogPost> {
  const response = await fetch(blogBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return await parseBlogResponse<BlogPost>(response, "Не удалось создать блог");
}

export async function updateBlogPost(
  postId: string,
  payload: BlogPostDraft,
): Promise<BlogPost> {
  const response = await fetch(`${blogBaseUrl}/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return await parseBlogResponse<BlogPost>(response, "Не удалось обновить блог");
}

export async function deleteBlogPost(postId: string): Promise<void> {
  const response = await fetch(`${blogBaseUrl}/${encodeURIComponent(postId)}`, {
    method: "DELETE",
    credentials: "include",
  });

  await parseBlogResponse<void>(response, "Не удалось удалить блог");
}

export async function markBlogPostViewed(postId: string): Promise<void> {
  const response = await fetch(`${blogBaseUrl}/${encodeURIComponent(postId)}/view`, {
    method: "POST",
    credentials: "include",
  });

  await parseBlogResponse<void>(response, "Не удалось обновить просмотры блога");
}
