import type { TaxonomyGroup, TaxonomyGroupKey } from "../types";

interface CategoriesGroupsNavProps {
  groups: TaxonomyGroup[];
  activeGroupKey?: TaxonomyGroupKey;
  onGroupChange: (groupKey: TaxonomyGroupKey) => void;
}

export const CategoriesGroupsNav = ({
  groups,
  activeGroupKey,
  onGroupChange,
}: CategoriesGroupsNavProps) => (
  <aside className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
    <div className="space-y-1">
      {groups.map((group) => (
        <button
          key={group.key}
          type="button"
          className={[
            "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold transition-colors",
            group.key === activeGroupKey
              ? "bg-primary-muted text-primary"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          ].join(" ")}
          onClick={() => onGroupChange(group.key)}
        >
          <span>{group.label}</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[0.65rem]">
            {group.items.length}
          </span>
        </button>
      ))}
    </div>
  </aside>
);
