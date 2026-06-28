import type { FormEvent } from "react";

import { Button } from "../../../../shared/components/Button";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import type { TaxonomyGroup, TaxonomyVariant } from "../types";

type FormModalMode = "create" | "edit";

const variantLabels: Record<TaxonomyVariant, string> = {
  default: "Обычный",
  primary: "Популярный",
};

interface CategoryItemFormModalProps {
  isOpen: boolean;
  mode: FormModalMode;
  activeGroup?: TaxonomyGroup;
  name: string;
  variant: TaxonomyVariant;
  error?: string;
  isPending: boolean;
  onNameChange: (name: string) => void;
  onVariantChange: (variant: TaxonomyVariant) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export const CategoryItemFormModal = ({
  isOpen,
  mode,
  activeGroup,
  name,
  variant,
  error,
  isPending,
  onNameChange,
  onVariantChange,
  onSubmit,
  onClose,
}: CategoryItemFormModalProps) => (
  <Modal
    isOpen={isOpen}
    title={mode === "edit" ? "Редактировать элемент" : "Добавить элемент"}
    description={activeGroup ? `Группа: ${activeGroup.label}` : undefined}
    onClose={onClose}
    footer={(
      <>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button form="taxonomy-item-form" type="submit" disabled={isPending}>
          Сохранить
        </Button>
      </>
    )}
  >
    <form id="taxonomy-item-form" className="space-y-4" onSubmit={onSubmit}>
      <Input
        autoFocus
        label="Название"
        placeholder="Например: ВЫЖИВАНИЕ"
        value={name}
        error={error}
        onChange={(event) => onNameChange(event.target.value)}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {(["default", "primary"] as TaxonomyVariant[]).map((itemVariant) => (
          <button
            key={itemVariant}
            type="button"
            className={[
              "rounded-xl border px-4 py-3 text-left transition-colors",
              variant === itemVariant
                ? "border-primary bg-primary-muted text-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-muted",
            ].join(" ")}
            onClick={() => onVariantChange(itemVariant)}
          >
            <span className="block text-sm font-black">{variantLabels[itemVariant]}</span>
            <span className="mt-1 block text-xs font-medium">
              {itemVariant === "primary" ? "Выделяется цветом как популярный" : "Обычная плашка"}
            </span>
          </button>
        ))}
      </div>
    </form>
  </Modal>
);
