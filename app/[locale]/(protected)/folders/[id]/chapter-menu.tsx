"use client";

import {
  FolderInputIcon,
  GlobeIcon,
  GlobeLockIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActionMenu, PublicationIcon } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TagsDialog } from "@/components/tags-dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setChapterPublished, setStoryTags } from "../../stories/actions";
import { DeleteStoryDialog } from "../../stories/delete-story-dialog";
import { MoveStoryDialog } from "./move-story-dialog";

type Dialog = "tags" | "move" | "publish" | "delete";

export function ChapterMenu({
  id,
  title,
  tags,
  folderTags,
  userTags,
  isPublic,
  otherFolders,
}: {
  id: string;
  title: string;
  tags: string[];
  folderTags: string[];
  userTags: string[];
  isPublic: boolean;
  otherFolders: { id: string; name: string }[];
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const t = useTranslations("menu");
  const tFolders = useTranslations("folders");
  const tTags = useTranslations("tags");
  const tCommon = useTranslations("common");
  const dialogProps = (name: Dialog) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  return (
    <>
      <PublicationIcon isPublic={isPublic} />
      <ActionMenu label={t("actionsFor", { name: title })}>
        <DropdownMenuItem onSelect={() => setDialog("tags")}>
          <TagIcon />
          {tTags("tags")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("move")}>
          <FolderInputIcon />
          {tFolders("moveTo")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("publish")}>
          {isPublic ? <GlobeLockIcon /> : <GlobeIcon />}
          {isPublic ? tFolders("unpublish") : tFolders("publish")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setDialog("delete")}
        >
          <Trash2Icon />
          {tCommon("delete")}
        </DropdownMenuItem>
      </ActionMenu>
      <TagsDialog
        {...dialogProps("tags")}
        name={title}
        tags={tags}
        folderTags={folderTags}
        suggestions={userTags}
        action={setStoryTags.bind(null, id)}
      />
      <MoveStoryDialog
        {...dialogProps("move")}
        id={id}
        title={title}
        folders={otherFolders}
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
        action={() => setChapterPublished(id, !isPublic)}
      />
      <DeleteStoryDialog {...dialogProps("delete")} id={id} title={title} />
    </>
  );
}
