import { Sparkles } from "lucide-react";
import type { FC } from "react";
import { SideBarItem } from "../../SideBarItem";
import type { SideBarCategoryProps } from "../types";

export const SideBarCategory: FC<SideBarCategoryProps> = ({ category }) => {
  const isAiCategory = category.variant === "ai";

  return (
    <section
      className={[
        "min-w-56 rounded-2xl p-2 lg:min-w-0",
        isAiCategory
          ? "border border-primary/20 bg-primary-muted/70 shadow-[0_10px_35px_-24px_var(--primary)]"
          : "",
      ].join(" ")}
    >
      <div className="mb-1 flex items-center gap-2 px-2 py-1.5">
        {isAiCategory && <Sparkles aria-hidden="true" className="size-3.5 text-primary" />}

        <h2
          className={[
            "text-[0.65rem] font-bold uppercase tracking-[0.14em]",
            isAiCategory ? "text-primary" : "text-muted-foreground",
          ].join(" ")}
        >
          {category.name}
        </h2>

        {isAiCategory && (
          <span className="ml-auto rounded-md bg-primary px-1.5 py-0.5 text-[0.55rem] font-black uppercase tracking-wider text-primary-foreground">
            AI
          </span>
        )}
      </div>

      <ul className="space-y-1">
        {category.items.map((item) => (
          <SideBarItem key={item.id} item={item} variant={category.variant} />
        ))}
      </ul>
    </section>
  );
};
