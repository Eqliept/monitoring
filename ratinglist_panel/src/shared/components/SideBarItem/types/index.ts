export type SideBarCategoryVariant = "normal" | "ai";

export type SideBarIconName =
  | "dashboard"
  | "projects"
  | "monitoring"
  | "users"
  | "notifications"
  | "assistant"
  | "insights"
  | "settings"
  | "categories"

export interface SideBarItemData {
  id: string;
  name: string;
  icon: SideBarIconName;
  href: string;
}

export interface SideBarItemProps {
  item: SideBarItemData;
  variant: SideBarCategoryVariant;
}
