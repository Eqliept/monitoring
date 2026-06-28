import type { HTMLAttributes, ReactNode } from "react";

export type GridVariant =
  | "stack"
  | "twoColumns"
  | "threeColumns"
  | "fourColumns"
  | "autoFit"
  | "dashboard"
  | "featuredLeft"
  | "featuredRight"
  | "sidebarLeft"
  | "sidebarRight"
  | "bento"
  | "bentoReverse"
  | "mainAside"
  | "asideMain";

export type GridGap = "none" | "small" | "medium" | "large";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: GridVariant;
  gap?: GridGap;
  dense?: boolean;
}
