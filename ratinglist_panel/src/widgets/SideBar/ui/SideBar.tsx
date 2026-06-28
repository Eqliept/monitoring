import { SideBarCategory } from "../../../shared/components/SideBarCategory";
import type { SideBarProps } from "../types";

export const SideBar = ({ categories }: SideBarProps) => {
  return (
    <aside className="w-full shrink-0 border-b border-border bg-surface lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:w-64 lg:border-b-0 lg:border-r">
      <nav
        className="flex gap-3 overflow-x-auto p-4 lg:h-full lg:flex-col lg:overflow-y-auto lg:px-3 lg:py-5"
      >
        {categories.map((category) => (
          <SideBarCategory key={category.id} category={category} />
        ))}
      </nav>
    </aside>
  );
};