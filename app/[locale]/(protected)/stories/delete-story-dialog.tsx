"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteStory } from "./actions";

export function DeleteStoryDialog({
  open,
  onOpenChange,
  id,
  title,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  title: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations("stories");
  const tCommon = useTranslations("common");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("deleteTitle")}
      description={t("deleteDescription", { title })}
      confirmLabel={tCommon("delete")}
      pendingLabel={tCommon("deleting")}
      destructive
      action={() => deleteStory(id)}
      onDone={onDeleted}
    />
  );
}
