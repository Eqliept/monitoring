import { Edit3, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { EditableList, type EditableListItem } from "../../../../features/EditableList";
import { Button } from "../../../../shared/components/Button";
import type { TaxonomyGroup, TaxonomyItem, TaxonomyVariant } from "../types";

const variantLabels: Record<TaxonomyVariant, string> = {
  default: "Обычный",
  primary: "Популярный",
};

interface CategoryItemsPanelProps {
  activeGroup?: TaxonomyGroup;
  items: TaxonomyItem[];
  isLoading: boolean;
  isReordering: boolean;
  onReorder: (items: EditableListItem[]) => void;
  onEditItem: (item: TaxonomyItem) => void;
  onDeleteItem: (item: TaxonomyItem) => void;
}

function renderVariantBadge(item: TaxonomyItem): ReactNode {
  return (
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.12em]",
        item.variant === "primary"
          ? "bg-primary-muted text-primary"
          : "bg-surface-muted text-muted-foreground",
      ].join(" ")}
    >
      {variantLabels[item.variant]}
    </span>
  );
}

function toEditableItem(item: TaxonomyItem): EditableListItem {
  return {
    id: item.id,
    title: item.name,
    description: item.isActive ? undefined : "Не отображается на публичном сайте",
    isDisabled: !item.isActive,
    badge: renderVariantBadge(item),
  };
}

export const CategoryItemsPanel = ({
  activeGroup,
  items,
  isLoading,
  isReordering,
  onReorder,
  onEditItem,
  onDeleteItem,
}: CategoryItemsPanelProps) => (
  <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-black tracking-tight text-foreground">
          {activeGroup?.label ?? "Загрузка"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Популярные элементы подсвечиваются на публичном фронте другим стилем.
        </p>
      </div>
    </div>

    {isLoading ? (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
        Загружаем справочники...
      </div>
    ) : (
      <EditableList
        items={items.map(toEditableItem)}
        emptyText="В этой группе пока нет элементов"
        isReordering={isReordering}
        onReorder={onReorder}
        renderActions={(editableItem) => {
          const item = items.find((currentItem) => currentItem.id === editableItem.id);

          if (!item) {
            return null;
          }

          return (
            <>
              <Button
                isIconOnly
                size="small"
                variant="tertiary"
                icon={<Edit3 className="size-4" />}
                aria-label={`Редактировать ${item.name}`}
                onClick={() => onEditItem(item)}
              />
              <Button
                isIconOnly
                size="small"
                variant="tertiary"
                icon={<Trash2 className="size-4" />}
                aria-label={`Удалить ${item.name}`}
                title={`Удалить ${item.name}`}
                onClick={() => onDeleteItem(item)}
              />
            </>
          );
        }}
      />
    )}
  </div>
);
