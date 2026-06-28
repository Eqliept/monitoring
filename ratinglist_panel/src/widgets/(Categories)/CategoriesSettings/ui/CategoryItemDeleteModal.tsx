import { Button } from "../../../../shared/components/Button";
import { Modal } from "../../../../shared/components/Modal";
import type { TaxonomyItem } from "../types";

interface CategoryItemDeleteModalProps {
  isOpen: boolean;
  item?: TaxonomyItem;
  isPending: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export const CategoryItemDeleteModal = ({
  isOpen,
  item,
  isPending,
  onDelete,
  onClose,
}: CategoryItemDeleteModalProps) => {
  const itemLabel = item?.groupKey === "versions" ? "версию" : "категорию";

  return (
    <Modal
      isOpen={isOpen}
      title={`Удалить ${itemLabel}?`}
      description="Элемент будет удалён из справочника и больше не появится в списках выбора."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" disabled={isPending} onClick={onDelete}>
            {`Удалить ${itemLabel}`}
          </Button>
        </>
      )}
    >
      <p className="text-sm text-muted-foreground">
        {item ? `Вы удаляете: ${item.name}` : "Элемент не выбран"}
      </p>
    </Modal>
  );
};
