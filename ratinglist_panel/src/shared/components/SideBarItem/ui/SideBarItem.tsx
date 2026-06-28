import type { FC } from "react";
import { NavLink } from "react-router-dom";
import type { SideBarItemProps } from "../types";
import { sideBarIcons } from "./sidebarIcons";

export const SideBarItem: FC<SideBarItemProps> = ({ item, variant }) => {
  const Icon = sideBarIcons[item.icon];
  const isAiItem = variant === "ai";

  return (
    <li>
      <NavLink
        to={item.href}
        end={item.href === "/"}
        className={({ isActive }) =>
          [
            "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
            isActive
              ? isAiItem
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-foreground text-background shadow-sm"
              : isAiItem
                ? "text-foreground hover:bg-primary/10 hover:text-primary"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          ].join(" ")
        }
      >
        <Icon
          aria-hidden="true"
          className="size-[18px] shrink-0 transition-transform group-hover:scale-110"
        />
        <span className="truncate">{item.name}</span>
      </NavLink>
    </li>
  );
};
