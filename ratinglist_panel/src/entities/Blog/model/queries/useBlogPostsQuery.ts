import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { BlogPost, BlogPostDraft } from "../types";
import {
  createBlogPost,
  deleteBlogPost,
  loadBlogPosts,
  markBlogPostViewed,
  updateBlogPost,
} from "../api/blogApi";

export const blogPostsQueryKey = ["blog-posts"];

export function useBlogPostsQuery() {
  return useQuery({
    queryKey: blogPostsQueryKey,
    queryFn: loadBlogPosts,
  });
}

export function useCreateBlogPostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BlogPostDraft) => createBlogPost(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blogPostsQueryKey }),
  });
}

export function useUpdateBlogPostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: BlogPostDraft }) => (
      updateBlogPost(postId, payload)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blogPostsQueryKey }),
  });
}

export function useDeleteBlogPostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deleteBlogPost(postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blogPostsQueryKey }),
  });
}

export function useMarkBlogPostViewedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => markBlogPostViewed(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: blogPostsQueryKey });

      const previousPosts = queryClient.getQueryData<BlogPost[]>(blogPostsQueryKey);

      queryClient.setQueryData<BlogPost[]>(blogPostsQueryKey, (currentPosts) => {
        if (!currentPosts) {
          return currentPosts;
        }

        return currentPosts.map((post) => (
          post.id === postId ? { ...post, views: post.views + 1 } : post
        ));
      });

      return { previousPosts };
    },
    onError: (_error, _postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(blogPostsQueryKey, context.previousPosts);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: blogPostsQueryKey }),
  });
}
