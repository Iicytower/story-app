"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteFolder } from "../actions";

export function DeleteFolderDialog({
  open,
  onOpenChange,
  id,
  name,
  chapterCount,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  name: string;
  chapterCount: number;
  onDeleted?: () => void;
}) {
  const t = useTranslations("folders");
  const tCommon = useTranslations("common");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("deleteTitle")}
      description={t("deleteDescription", { name, count: chapterCount })}
      confirmLabel={tCommon("delete")}
      pendingLabel={tCommon("deleting")}
      destructive
      action={() => deleteFolder(id)}
      onDone={onDeleted}
    />
  );
}
