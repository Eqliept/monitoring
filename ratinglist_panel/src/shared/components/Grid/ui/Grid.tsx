import type { FC } from "react";
import type { GridProps } from "../types";

const variantClasses = {
  stack: "grid-cols-1",
  twoColumns: "grid-cols-1 md:grid-cols-2",
  threeColumns: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  fourColumns: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  autoFit:
    "[grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]",
  dashboard: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  featuredLeft:
    "grid-cols-1 lg:grid-cols-3 [&>*:first-child]:lg:col-span-2 [&>*:first-child]:lg:row-span-2",
  featuredRight:
    "grid-cols-1 lg:grid-cols-3 [&>*:last-child]:lg:col-span-2 [&>*:last-child]:lg:row-span-2",
  sidebarLeft:
    "grid-cols-1 lg:grid-cols-4 [&>*:first-child]:lg:row-span-2 [&>*:not(:first-child)]:lg:col-span-3",
  sidebarRight:
    "grid-cols-1 lg:grid-cols-4 [&>*:last-child]:lg:row-span-2 [&>*:not(:last-child)]:lg:col-span-3",
  bento:
    "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 [&>*:first-child]:sm:col-span-2 [&>*:first-child]:xl:row-span-2 [&>*:nth-child(4)]:sm:col-span-2",
  bentoReverse:
    "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 [&>*:last-child]:sm:col-span-2 [&>*:last-child]:xl:row-span-2 [&>*:nth-last-child(4)]:sm:col-span-2",
  mainAside:
    "grid-cols-1 lg:grid-cols-3 [&>*:first-child]:lg:col-span-2",
  asideMain:
    "grid-cols-1 lg:grid-cols-3 [&>*:last-child]:lg:col-span-2",
};

const gapClasses = {
  none: "gap-0",
  small: "gap-2",
  medium: "gap-4",
  large: "gap-6 lg:gap-8",
};

export const Grid: FC<GridProps> = ({
  variant = "dashboard",
  gap = "medium",
  dense = false,
  className = "",
  children,
  ...gridProps
}) => {
  return (
    <div
      className={[
        "grid w-full",
        variantClasses[variant],
        gapClasses[gap],
        dense ? "grid-flow-dense" : "",
        className,
      ].join(" ")}
      {...gridProps}
    >
      {children}
    </div>
  );
};
