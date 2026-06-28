import { Notification } from "../../../entities/Notification";
import { ThemeSelector } from "../../../features/ThemeSelector";
import { Input } from "../../../shared/components/Input";
import { Logo } from "../../../shared/components/Logo";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto grid min-h-20 w-full max-w-[1600px] grid-cols-[1fr_auto] [grid-template-areas:'logo_actions'_'search_search'] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_minmax(320px,640px)_1fr] lg:[grid-template-areas:'logo_search_actions'] lg:px-8">
        <div className="[grid-area:logo] min-w-0 justify-self-start">
          <Logo />
        </div>

        <div className="[grid-area:search] w-full pb-4 lg:pb-0">
          <Input variant="search" />
        </div>

        <div className="[grid-area:actions] flex items-center gap-2 justify-self-end">
          <ThemeSelector />
          <Notification />
        </div>
      </div>
    </header>
  );
};
