import {
  Bell,
  Bot,
  ChartNoAxesCombined,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListTree,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SideBarIconName } from "../types";

export const sideBarIcons = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  monitoring: Gauge,
  users: Users,
  notifications: Bell,
  assistant: Bot,
  insights: ChartNoAxesCombined,
  settings: Settings,
  categories: ListTree,
} satisfies Record<SideBarIconName, LucideIcon>;
