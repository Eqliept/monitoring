import { Search } from "lucide-react";

export const InputSearch = () => {
  return (
    <label className="group relative block w-full">
      <span className="sr-only">Поиск</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
      />
      <input
        type="search"
        placeholder="Поиск по панели..."
        className="h-11 w-full rounded-xl border border-border bg-background px-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-input focus:border-primary focus:ring-4 focus:ring-primary-muted"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
        Ctrl K
      </kbd>
    </label>
  );
};
