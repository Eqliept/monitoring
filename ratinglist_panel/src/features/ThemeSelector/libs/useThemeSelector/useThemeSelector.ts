import { useEffect } from "react";
import { useThemeStore } from "../../../../shared/store/themeStore";

export const useThemeSelector = () => {
  const theme = useThemeStore((state) => state.theme);
  const onChangeTheme = useThemeStore((state) => state.onChangeTheme);
  const isDarkTheme = theme === "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }, [isDarkTheme, theme]);

  const toggleTheme = () => {
    onChangeTheme(isDarkTheme ? "light" : "dark");
  };

  return {
    isDarkTheme,
    toggleTheme,
    label: isDarkTheme ? "Включить светлую тему" : "Включить тёмную тему",
    title: isDarkTheme ? "Светлая тема" : "Тёмная тема",
  };
};
