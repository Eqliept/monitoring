import { Plus } from "lucide-react";

import { Button } from "../../../../shared/components/Button";

interface CategoriesSettingsHeaderProps {
  onCreateClick: () => void;
}

export const CategoriesSettingsHeader = ({
  onCreateClick,
}: CategoriesSettingsHeaderProps) => (
  <div className="rounded-2xl border border-border bg-surface px-5 py-5 shadow-sm sm:px-6">
    <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Категории и версии
        </h1>
      </div>
      <Button icon={<Plus className="size-4" />} onClick={onCreateClick}>
        Добавить элемент
      </Button>
    </div>
  </div>
);
