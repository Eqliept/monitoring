import { ArrowUpRight, CalendarClock, Edit3, Eye, Trash2 } from "lucide-react";
import type { FC } from "react";

import { Button } from "../../Button";
import type { BlogCardProps } from "../types";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(date));
}

function getDateLabel(post: BlogCardProps["post"]): string {
  const wasEdited = post.updatedAt !== post.createdAt;
  return `${wasEdited ? "Редактировано" : "Создан"}: ${formatDate(wasEdited ? post.updatedAt : post.createdAt)}`;
}

export const BlogCard: FC<BlogCardProps> = ({
  post,
  onDeleteClick,
  onDetailsClick,
  onEditClick,
}) => (
  <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-colors hover:border-primary">
    <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
      <img
        alt={post.title}
        className="h-full w-full object-cover"
        src={post.imageUrl}
      />
      <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
        <Eye className="size-3.5" />
        {post.views}
      </div>
    </div>

    <div className="flex flex-1 flex-col gap-4 p-5">
      <div className="space-y-2">
        <h2 className="line-clamp-2 text-xl font-black tracking-tight text-foreground">
          {post.title}
        </h2>
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {post.summary}
        </p>
      </div>

      <div className="mt-auto space-y-4">
        <div className="text-xs font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="size-4" />
            {getDateLabel(post)}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Button
            className="w-full"
            icon={<ArrowUpRight className="size-4" />}
            onClick={() => onDetailsClick(post)}
          >
            Подробнее
          </Button>
          <Button
            aria-label="Редактировать блог"
            isIconOnly
            variant="secondary"
            icon={<Edit3 className="size-4" />}
            onClick={() => onEditClick(post)}
          />
          <Button
            aria-label="Удалить блог"
            isIconOnly
            variant="tertiary"
            icon={<Trash2 className="size-4" />}
            onClick={() => onDeleteClick(post)}
          />
        </div>
      </div>
    </div>
  </article>
);
