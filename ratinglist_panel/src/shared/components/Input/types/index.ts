import type { InputHTMLAttributes, ReactNode } from "react";

export type InputVariant = "default" | "search";
export type InputSize = "small" | "medium" | "large";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: InputVariant;
  inputSize?: InputSize;
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}
