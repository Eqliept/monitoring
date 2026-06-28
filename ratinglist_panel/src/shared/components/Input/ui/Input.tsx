import type { FC } from "react";
import type { InputProps } from "../types";
import { InputSearch } from "./InputSearch";

const sizeClasses = {
  small: "h-10 text-sm",
  medium: "h-11 text-sm",
  large: "h-12 text-base",
};

export const Input: FC<InputProps> = ({
  variant = "default",
  inputSize = "medium",
  label,
  error,
  hint,
  leftIcon,
  rightSlot,
  className = "",
  id,
  ...inputProps
}) => {
  switch (variant) {
    case "search":
      return <InputSearch />;
    default:
      return (
        <label className="block w-full" htmlFor={id}>
          {label && (
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
          )}
          <span className="relative flex w-full items-center">
            {leftIcon && (
              <span className="pointer-events-none absolute left-3 inline-flex text-muted-foreground">
                {leftIcon}
              </span>
            )}
            <input
              id={id}
              className={[
                "w-full rounded-xl border border-input bg-surface px-3 font-semibold text-foreground shadow-sm outline-none transition-colors",
                "placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary-muted",
                leftIcon ? "pl-10" : "",
                rightSlot ? "pr-28" : "",
                sizeClasses[inputSize],
                error ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "",
                className,
              ].join(" ")}
              {...inputProps}
            />
            {rightSlot && (
              <span className="absolute right-1.5 inline-flex items-center">
                {rightSlot}
              </span>
            )}
          </span>
          {(error || hint) && (
            <span className={["mt-2 block text-xs font-medium", error ? "text-red-600" : "text-muted-foreground"].join(" ")}>
              {error || hint}
            </span>
          )}
        </label>
      );
  }
};
