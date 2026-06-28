import { GripVertical } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";

export interface EditableListItem {
  id: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  isDisabled?: boolean;
}

interface EditableListProps {
  items: EditableListItem[];
  emptyText?: string;
  isReordering?: boolean;
  renderActions?: (item: EditableListItem) => ReactNode;
  onReorder: (items: EditableListItem[]) => void;
}

type DropEdge = "before" | "after";

interface DropTarget {
  index: number;
  edge: DropEdge;
}

const editableListDragMime = "application/x-editable-list-index";

function moveItem<T>(items: T[], fromIndex: number, insertIndex: number): T[] {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  const normalizedInsertIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;

  nextItems.splice(normalizedInsertIndex, 0, item);
  return nextItems;
}

function getDropEdge(event: DragEvent<HTMLElement>): DropEdge {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function getInsertIndex(targetIndex: number, edge: DropEdge): number {
  return edge === "after" ? targetIndex + 1 : targetIndex;
}

function getDraggedIndex(event: DragEvent<HTMLElement>): number | null {
  const value = event.dataTransfer.getData(editableListDragMime)
    || event.dataTransfer.getData("text/plain");
  const index = Number.parseInt(value, 10);

  return Number.isNaN(index) ? null : index;
}

function isSamePosition(sourceIndex: number, targetIndex: number, edge: DropEdge): boolean {
  return sourceIndex === targetIndex
    || (edge === "after" && sourceIndex === targetIndex + 1)
    || (edge === "before" && sourceIndex === targetIndex - 1);
}

export const EditableList = ({
  items,
  emptyText = "Элементов пока нет",
  isReordering = false,
  renderActions,
  onReorder,
}: EditableListProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const clearDragState = () => {
    setDragIndex(null);
    setDropTarget(null);
  };

  const handleDrop = (targetIndex: number, edge: DropEdge, sourceIndex: number | null) => {
    if (sourceIndex === null || sourceIndex < 0 || sourceIndex >= items.length) {
      clearDragState();
      return;
    }

    if (isSamePosition(sourceIndex, targetIndex, edge)) {
      clearDragState();
      return;
    }

    onReorder(moveItem(items, sourceIndex, getInsertIndex(targetIndex, edge)));
    clearDragState();
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-busy={isReordering}>
      {items.map((item, index) => {
        const isDragging = dragIndex === index;
        const isDropTarget = dropTarget?.index === index && dragIndex !== index;

        return (
          <li
            key={item.id}
            className={[
              "relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-xl border bg-surface px-3 py-3 shadow-sm transition-all duration-150",
              isDragging ? "scale-[0.99] border-primary bg-primary-muted/70 opacity-60 shadow-md" : "border-border",
              isDropTarget ? "border-primary bg-primary-muted/50 shadow-md ring-2 ring-primary/20" : "",
              item.isDisabled && !isDragging ? "opacity-60" : "hover:bg-surface-muted/70",
            ].join(" ")}
            onDragOver={(event) => {
              if (dragIndex === null || isReordering) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = "move";

              const edge = getDropEdge(event);
              setDropTarget({ index, edge });
            }}
            onDrop={(event) => {
              event.preventDefault();
              const edge = dropTarget?.index === index ? dropTarget.edge : getDropEdge(event);
              handleDrop(index, edge, dragIndex ?? getDraggedIndex(event));
            }}
            onDragEnd={clearDragState}
          >
            {isDropTarget && (
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute left-3 right-3 z-10 h-0.5 bg-primary shadow-[0_0_0_3px_var(--primary-muted)]",
                  dropTarget.edge === "before" ? "-top-1" : "-bottom-1",
                ].join(" ")}
              >
                <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary" />
              </span>
            )}

            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-background px-2 text-[0.65rem] font-black text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>

            <button
              type="button"
              draggable={!isReordering}
              className={[
                "inline-flex size-9 cursor-grab items-center justify-center rounded-lg border border-border bg-surface-muted text-muted-foreground transition-colors",
                "hover:border-primary hover:text-primary active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50",
              ].join(" ")}
              title="Перетащить"
              aria-label={`Переместить ${item.title}`}
              disabled={isReordering}
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(editableListDragMime, String(index));
                event.dataTransfer.setData("text/plain", String(index));
              }}
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate text-sm font-bold text-foreground">
                  {item.title}
                </p>
                {item.badge}
              </div>
              {item.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>

            {renderActions && (
              <div className="flex items-center gap-1">
                {renderActions(item)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
