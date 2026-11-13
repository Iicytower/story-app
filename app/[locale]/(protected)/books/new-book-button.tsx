"use client";

import { FolderPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateFolderDialog } from "./create-folder-dialog";

export function NewBookButton({
  variant,
}: {
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("folders");
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <FolderPlusIcon />
        {t("newFolder")}
      </Button>
      <CreateFolderDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
