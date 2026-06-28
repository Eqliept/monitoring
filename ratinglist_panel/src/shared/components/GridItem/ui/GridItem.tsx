import type { FC } from "react";
import type { GridItemProps } from "../types";

const variantClasses = {
  default: "",
  full: "col-span-full",
  half: "md:col-span-1 xl:col-span-2",
  third: "xl:col-span-1",
  twoThirds: "xl:col-span-2",
  quarter: "xl:col-span-1",
  threeQuarters: "xl:col-span-3",
  wide: "md:col-span-2",
  tall: "md:row-span-2",
  large: "md:col-span-2 md:row-span-2",
};

export const GridItem: FC<GridItemProps> = ({
  variant = "default",
  className = "",
  children,
  ...itemProps
}) => {
  return (
    <div className={[variantClasses[variant], className].join(" ")} {...itemProps}>
      {children}
    </div>
  );
};
