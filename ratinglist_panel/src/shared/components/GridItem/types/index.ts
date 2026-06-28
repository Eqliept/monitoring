import type { HTMLAttributes, ReactNode } from "react";

export type GridItemVariant =
  | "default"
  | "full"
  | "half"
  | "third"
  | "twoThirds"
  | "quarter"
  | "threeQuarters"
  | "wide"
  | "tall"
  | "large";

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: GridItemVariant;
}
