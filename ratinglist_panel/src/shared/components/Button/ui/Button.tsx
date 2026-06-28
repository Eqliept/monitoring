import type { ButtonProps } from "../types";
import type { FC } from "react";

const variantClasses = {
  primary:
    "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover",
  secondary:
    "border-border bg-background text-muted-foreground hover:border-primary hover:bg-primary-muted hover:text-primary",
  tertiary:
    "border-transparent bg-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
};

const sizeClasses = {
  small: "h-10 px-3 text-sm",
  medium: "h-11 px-4 text-sm",
  large: "h-12 px-5 text-base",
};

const iconOnlySizeClasses = {
  small: "size-10",
  medium: "size-11",
  large: "size-12",
};

export const Button: FC<ButtonProps> = ({
  variant = "primary",
  size = "medium",
  icon,
  isIconOnly = false,
  type = "button",
  className = "",
  children,
  ...buttonProps
}) => {
  return (
    <button
      type={type}
      className={[
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-semibold transition-colors",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        isIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
        className,
      ].join(" ")}
      {...buttonProps}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
};
