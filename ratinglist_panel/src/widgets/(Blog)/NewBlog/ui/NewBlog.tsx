import type { BlogPostDraft } from "../../../../entities/Blog";
import { CreateBlog } from "../../../../features/CreateBlog";

interface NewBlogProps {
  onCreateBlog: (draft: BlogPostDraft) => void | Promise<void>;
}

export const NewBlog = ({ onCreateBlog }: NewBlogProps) => (
  <div className="rounded-2xl border border-border bg-surface px-5 py-5 shadow-sm sm:px-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Посты
        </h1>
      </div>

      <CreateBlog onCreate={onCreateBlog} />
    </div>
  </div>
);
