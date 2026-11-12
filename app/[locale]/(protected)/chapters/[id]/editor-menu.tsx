"use client";

import {
  FileDownIcon,
  GlobeIcon,
  GlobeLockIcon,
  MessageSquareIcon,
  MessageSquareOffIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ActionMenu } from "@/components/action-menu";
import { AdultDialog, AdultMenuItem } from "@/components/adult";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExportDialog } from "@/components/export-dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import type { AdultState } from "@/lib/adult/adult";
import { setStoryAdult, setStoryCommentsDisabled } from "../actions";
import { DeleteStoryDialog } from "../delete-story-dialog";

type Dialog = "export" | "publish" | "adult" | "delete";

export function EditorMenu({
  id,
  title,
  isPublic,
  adult,
  commentsDisabled,
  beforeExport,
  togglePublished,
  onDeleted,
}: {
  id: string;
  title: string;
  isPublic: boolean;
  adult: AdultState;
  commentsDisabled: boolean;
  beforeExport: () => Promise<boolean>;
  togglePublished: () => Promise<ActionResult>;
  onDeleted: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useTranslations("menu");
  const tFolders = useTranslations("folders");
  const tExport = useTranslations("export");
  const tCommon = useTranslations("common");
  const dialogProps = (name: Dialog) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  function toggleComments() {
    setMenuError(null);
    startTransition(async () => {
      const result = await setStoryCommentsDisabled(id, !commentsDisabled);
      if (!result.ok) setMenuError(result.message);
    });
  }

  return (
    <>
      <ActionMenu label={t("actionsFor", { name: title })}>
        <DropdownMenuItem onSelect={() => setDialog("export")}>
          <FileDownIcon />
          {tExport("exportAs")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("publish")}>
          {isPublic ? <GlobeLockIcon /> : <GlobeIcon />}
          {isPublic ? tFolders("unpublish") : tFolders("publish")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleComments}>
          {commentsDisabled ? <MessageSquareIcon /> : <MessageSquareOffIcon />}
          {commentsDisabled ? t("enableComments") : t("disableComments")}
        </DropdownMenuItem>
        <AdultMenuItem state={adult} onSelect={() => setDialog("adult")} />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setDialog("delete")}
        >
          <Trash2Icon />
          {tCommon("delete")}
        </DropdownMenuItem>
      </ActionMenu>
      {menuError && (
        <p role="alert" className="text-destructive w-full text-sm">
          {menuError}
        </p>
      )}
      <ExportDialog
        {...dialogProps("export")}
        dataUrl={`/chapters/${id}/export/data`}
        fallbackName="story"
        beforeExport={beforeExport}
      />
      <ConfirmDialog
        {...dialogProps("publish")}
        title={isPublic ? t("unpublishChapterTitle") : t("publishChapterTitle")}
        description={
          isPublic
            ? t("unpublishChapterDescription", { title })
            : t("publishChapterDescription", { title })
        }
        confirmLabel={isPublic ? tFolders("unpublish") : tFolders("publish")}
        action={togglePublished}
      />
      <AdultDialog
        {...dialogProps("adult")}
        kind="chapter"
        name={title}
        adult={adult.adult}
        action={() => setStoryAdult(id, !adult.adult)}
      />
      <DeleteStoryDialog
        {...dialogProps("delete")}
        id={id}
        title={title}
        onDeleted={onDeleted}
      />
    </>
  );
}
