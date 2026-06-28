import { Moon, Sun } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { useThemeSelector } from "../libs";

export const ThemeSelector = () => {
  const { isDarkTheme, toggleTheme, label, title } = useThemeSelector();

  return (
    <Button
      variant="secondary"
      size="small"
      isIconOnly
      icon={
        isDarkTheme ? (
          <Sun className="size-[18px]" />
        ) : (
          <Moon className="size-[18px]" />
        )
      }
      onClick={toggleTheme}
      aria-label={label}
      title={title}
    />
  );
};
