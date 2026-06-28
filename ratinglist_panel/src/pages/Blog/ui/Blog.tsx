import { NewBlog}  from "../../../widgets/(Blog)/NewBlog";
import { BlogsList } from "../../../widgets/(Blog)/BlogsList";
import type { BlogPostDraft } from "../../../entities/Blog";
import {
  useBlogPostsQuery,
  useCreateBlogPostMutation,
  useDeleteBlogPostMutation,
  useUpdateBlogPostMutation,
} from "../../../entities/Blog";

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export const BlogPage = () => {
  const { data: posts = [], error, isLoading } = useBlogPostsQuery();
  const createMutation = useCreateBlogPostMutation();
  const updateMutation = useUpdateBlogPostMutation();
  const deleteMutation = useDeleteBlogPostMutation();

  const mutationError =
    getErrorMessage(createMutation.error)
    ?? getErrorMessage(updateMutation.error)
    ?? getErrorMessage(deleteMutation.error);

  const createBlog = async (draft: BlogPostDraft) => {
    await createMutation.mutateAsync(draft);
  };

  const editBlog = async (postId: string, draft: BlogPostDraft) => {
    await updateMutation.mutateAsync({ postId, payload: draft });
  };

  const deleteBlog = async (postId: string) => {
    await deleteMutation.mutateAsync(postId);
  };

  return (
    <div className="space-y-6">
      <NewBlog onCreateBlog={createBlog} />

      {(error || mutationError) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error instanceof Error ? error.message : mutationError ?? "Не удалось загрузить блоги"}
        </div>
      )}

      <BlogsList
        posts={posts}
        isLoading={isLoading}
        isDeleting={deleteMutation.isPending}
        onDeletePost={deleteBlog}
        onEditPost={editBlog}
      />
    </div>
  );
};
