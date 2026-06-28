import { CalendarClock, Eye, Trash2 } from "lucide-react";
import { useState } from "react";

import type { BlogPost, BlogPostDraft } from "../../../../entities/Blog";
import { CreateBlog } from "../../../../features/CreateBlog";
import { BlogCard } from "../../../../shared/components/BlogCard";
import { Button } from "../../../../shared/components/Button";
import { MarkdownContent } from "../../../../shared/components/MarkdownContent";
import { Modal } from "../../../../shared/components/Modal";

interface BlogsListProps {
  posts: BlogPost[];
  isDeleting?: boolean;
  isLoading?: boolean;
  onDeletePost: (postId: string) => void | Promise<void>;
  onEditPost: (postId: string, draft: BlogPostDraft) => void | Promise<void>;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(date: string): string {
  return dateTimeFormatter.format(new Date(date));
}

function getDateLabel(post: BlogPost): string {
  const wasEdited = post.updatedAt !== post.createdAt;
  return `${wasEdited ? "Редактировано" : "Создан"}: ${formatDateTime(wasEdited ? post.updatedAt : post.createdAt)}`;
}

function toDraft(post: BlogPost): BlogPostDraft {
  return {
    title: post.title,
    imageUrl: post.imageUrl,
    summary: post.summary,
    content: post.content,
  };
}

export const BlogsList = ({
  posts,
  isDeleting = false,
  isLoading = false,
  onDeletePost,
  onEditPost,
}: BlogsListProps) => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  const editingPost = posts.find((post) => post.id === editingPostId);
  const deletingPost = posts.find((post) => post.id === deletingPostId);

  const openPost = (post: BlogPost) => {
    setSelectedPostId(post.id);
  };

  const handleEdit = async (draft: BlogPostDraft) => {
    if (!editingPostId) {
      return;
    }

    await onEditPost(editingPostId, draft);
    setEditingPostId(null);
  };

  const handleDelete = async () => {
    if (!deletingPostId) {
      return;
    }

    await onDeletePost(deletingPostId);
    setDeletingPostId(null);
    setSelectedPostId((currentId) => (currentId === deletingPostId ? null : currentId));
  };

  return (
    <section className="space-y-5">
      {isLoading ? (
        <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center shadow-sm">
          <h2 className="text-xl font-black tracking-tight text-foreground">
            Загружаем блоги...
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-muted-foreground">
            Получаем список публикаций с backend.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-12 text-center shadow-sm">
          <h2 className="text-xl font-black tracking-tight text-foreground">
            Блогов пока нет
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-muted-foreground">
            Нажмите «Создать блог» и заполните две фазы формы, чтобы добавить первую публикацию.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <BlogCard
              key={post.id}
              post={post}
              onDeleteClick={(currentPost) => setDeletingPostId(currentPost.id)}
              onDetailsClick={openPost}
              onEditClick={(currentPost) => setEditingPostId(currentPost.id)}
            />
          ))}
        </div>
      )}

      {editingPost && (
        <CreateBlog
          key={editingPost.id}
          initialDraft={toDraft(editingPost)}
          isOpen={Boolean(editingPost)}
          modalTitle="Редактирование блога"
          submitLabel="Сохранить"
          onCreate={handleEdit}
          onOpenChange={(nextIsOpen) => {
            if (!nextIsOpen) {
              setEditingPostId(null);
            }
          }}
        />
      )}

      <Modal
        isOpen={Boolean(deletingPost)}
        title="Удалить блог"
        description={deletingPost?.title}
        onClose={() => setDeletingPostId(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeletingPostId(null)}>
              Отмена
            </Button>
            <Button
              disabled={isDeleting}
              icon={<Trash2 className="size-4" />}
              onClick={handleDelete}
            >
              {isDeleting ? "Удаляем..." : "Удалить"}
            </Button>
          </>
        )}
      >
        <p className="text-sm font-semibold text-muted-foreground">
          Блог будет удален из списка публикаций.
        </p>
      </Modal>

      <Modal
        isOpen={Boolean(selectedPost)}
        size="large"
        title={selectedPost?.title ?? "Блог"}
        description={selectedPost?.summary}
        onClose={() => setSelectedPostId(null)}
        footer={(
          <Button variant="secondary" onClick={() => setSelectedPostId(null)}>
            Закрыть
          </Button>
        )}
      >
        {selectedPost && (
          <article className="space-y-5">
            <img
              alt={selectedPost.title}
              className="aspect-[16/7] w-full rounded-xl object-cover"
              src={selectedPost.imageUrl}
            />

            <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5">
                <CalendarClock className="size-4" />
                {getDateLabel(selectedPost)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5">
                <Eye className="size-4" />
                Просмотров: {selectedPost.views}
              </span>
            </div>

            <MarkdownContent content={selectedPost.content} />
          </article>
        )}
      </Modal>
    </section>
  );
};
