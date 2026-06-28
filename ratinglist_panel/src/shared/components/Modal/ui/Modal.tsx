import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "../../Button";

interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "medium" | "large";
  onClose: () => void;
}

const sizeClasses = {
  medium: "max-w-xl",
  large: "max-w-4xl",
};

export const Modal = ({
  isOpen,
  title,
  description,
  children,
  footer,
  size = "medium",
  onClose,
}: ModalProps) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const portalRoot = document.getElementById("modal-root") ?? document.body;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm">
      <button
        aria-label="Закрыть модальное окно"
        className="absolute inset-0 cursor-default"
        type="button"
        onClick={onClose}
      />
      <section
        aria-modal="true"
        className={[
          "relative z-10 flex max-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_-40px_rgba(0,0,0,0.65)]",
          sizeClasses[size],
        ].join(" ")}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Управление
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button
            aria-label="Закрыть"
            isIconOnly
            size="small"
            variant="tertiary"
            icon={<X className="size-4" />}
            onClick={onClose}
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    portalRoot,
  );
};
