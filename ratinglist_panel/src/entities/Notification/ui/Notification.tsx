import { Bell } from "lucide-react";
import { Button } from "../../../shared/components/Button";

export const Notification = () => {
  return (
    <span className="relative inline-flex">
      <Button
        variant="secondary"
        size="small"
        isIconOnly
        icon={<Bell className="size-[18px]" />}
        aria-label="Уведомления: 3 непрочитанных"
        title="Уведомления"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-2 size-2 rounded-full bg-action ring-2 ring-background"
      />
    </span>
  );
};
