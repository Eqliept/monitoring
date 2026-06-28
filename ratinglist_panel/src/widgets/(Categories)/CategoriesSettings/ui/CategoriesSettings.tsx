import { useState, type FormEvent } from "react";

import type { EditableListItem } from "../../../../features/EditableList";
import {
  useCreateTaxonomyItemMutation,
  useDeleteTaxonomyItemMutation,
  useReorderTaxonomyItemsMutation,
  useTaxonomyQuery,
  useUpdateTaxonomyItemMutation,
} from "../model";
import type { TaxonomyGroup, TaxonomyGroupKey, TaxonomyItem, TaxonomyVariant } from "../types";
import { CategoriesGroupsNav } from "./CategoriesGroupsNav";
import { CategoriesSettingsHeader } from "./CategoriesSettingsHeader";
import { CategoryItemDeleteModal } from "./CategoryItemDeleteModal";
import { CategoryItemFormModal } from "./CategoryItemFormModal";
import { CategoryItemsPanel } from "./CategoryItemsPanel";

type ModalMode = "create" | "edit" | "delete";

interface CategoryModalState {
  mode: ModalMode;
  item?: TaxonomyItem;
}

function getMutationError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export const CategoriesSettings = () => {
  const { data, error, isLoading } = useTaxonomyQuery();
  const createMutation = useCreateTaxonomyItemMutation();
  const updateMutation = useUpdateTaxonomyItemMutation();
  const deleteMutation = useDeleteTaxonomyItemMutation();
  const reorderMutation = useReorderTaxonomyItemsMutation();
  const groups = data?.groups ?? [];
  const [activeGroupKey, setActiveGroupKey] = useState<TaxonomyGroupKey>("versions");
  const [modalState, setModalState] = useState<CategoryModalState | null>(null);
  const [name, setName] = useState("");
  const [variant, setVariant] = useState<TaxonomyVariant>("default");

  const activeGroup: TaxonomyGroup | undefined = (
    groups.find((group) => group.key === activeGroupKey) ?? groups[0]
  );
  const activeItems = activeGroup?.items ?? [];
  const modalError = getMutationError(createMutation.error)
    ?? getMutationError(updateMutation.error)
    ?? getMutationError(deleteMutation.error);

  const openCreateModal = () => {
    setName("");
    setVariant("default");
    setModalState({ mode: "create" });
  };

  const openEditModal = (item: TaxonomyItem) => {
    setName(item.name);
    setVariant(item.variant);
    setModalState({ mode: "edit", item });
  };

  const closeModal = () => {
    setModalState(null);
    setName("");
    setVariant("default");
    createMutation.reset();
    updateMutation.reset();
    deleteMutation.reset();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!modalState || !activeGroup || !name.trim()) {
      return;
    }

    if (modalState.mode === "create") {
      createMutation.mutate(
        {
          groupKey: activeGroup.key,
          groupLabel: activeGroup.label,
          name,
          variant,
        },
        { onSuccess: closeModal },
      );
      return;
    }

    if (modalState.mode === "edit" && modalState.item) {
      updateMutation.mutate(
        {
          itemId: modalState.item.id,
          payload: { name, variant },
        },
        { onSuccess: closeModal },
      );
    }
  };

  const handleDelete = () => {
    if (!modalState?.item) {
      return;
    }

    deleteMutation.mutate(modalState.item.id, { onSuccess: closeModal });
  };

  const handleReorder = (nextItems: EditableListItem[]) => {
    if (!activeGroup) {
      return;
    }

    reorderMutation.mutate({
      groupKey: activeGroup.key,
      itemIds: nextItems.map((item) => item.id),
    });
  };

  return (
    <section className="space-y-6">
      <CategoriesSettingsHeader onCreateClick={openCreateModal} />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error instanceof Error ? error.message : "Не удалось загрузить справочники"}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <CategoriesGroupsNav
          groups={groups}
          activeGroupKey={activeGroup?.key}
          onGroupChange={setActiveGroupKey}
        />

        <CategoryItemsPanel
          activeGroup={activeGroup}
          items={activeItems}
          isLoading={isLoading}
          isReordering={reorderMutation.isPending}
          onReorder={handleReorder}
          onEditItem={openEditModal}
          onDeleteItem={(item) => setModalState({ mode: "delete", item })}
        />
      </div>

      <CategoryItemFormModal
        isOpen={modalState?.mode === "create" || modalState?.mode === "edit"}
        mode={modalState?.mode === "edit" ? "edit" : "create"}
        activeGroup={activeGroup}
        name={name}
        variant={variant}
        error={modalError ?? undefined}
        isPending={createMutation.isPending || updateMutation.isPending}
        onNameChange={setName}
        onVariantChange={setVariant}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />

      <CategoryItemDeleteModal
        isOpen={modalState?.mode === "delete"}
        item={modalState?.item}
        isPending={deleteMutation.isPending}
        onDelete={handleDelete}
        onClose={closeModal}
      />
    </section>
  );
};
