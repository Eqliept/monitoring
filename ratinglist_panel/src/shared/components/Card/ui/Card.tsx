import type { HTMLAttributes } from "react";

type CardVariant = "transparent" | "default" | "secondary" | "tertiary";

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  transparent: "border-transparent bg-transparent shadow-none",
  default: "border-border bg-surface shadow-sm",
  secondary: "border-border bg-surface-muted shadow-sm",
  tertiary: "border-primary/30 bg-primary-muted shadow-sm",
};

const cardBaseClass =
  "relative flex flex-col rounded-2xl border p-5 transition-colors";

export const Card = ({
  variant = "default",
  className = "",
  children,
  ...props
}: CardProps) => (
  <article
    className={[cardBaseClass, variantClasses[variant], className].join(" ")}
    {...props}
  >
    {children}
  </article>
);

export const CardHeader = ({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={["flex flex-col gap-1", className].join(" ")} {...props}>
    {children}
  </div>
);

export const CardTitle = ({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={["text-lg font-bold tracking-tight text-foreground", className].join(" ")}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={["text-sm leading-6 text-muted-foreground", className].join(" ")} {...props}>
    {children}
  </p>
);

export const CardContent = ({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={["mt-4", className].join(" ")} {...props}>
    {children}
  </div>
);

export const CardFooter = ({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={["mt-5 flex items-center gap-2", className].join(" ")} {...props}>
    {children}
  </div>
);
