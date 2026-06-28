import { create } from "zustand";
import { setLocalStorage, getLocalStorage } from "../utils/localeStorage";

type Theme = "light" | "dark";

interface ThemeStore {
    theme: Theme;
    onChangeTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
    const savedTheme = getLocalStorage("theme");

    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
};

export const useThemeStore = create<ThemeStore>((set) => ({
    theme: getInitialTheme(),
    onChangeTheme: (theme) => {
        set({ theme });
        setLocalStorage("theme", theme);
    },
}));
