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
import { ActionMenu, PublicationStatus } from "@/components/action-menu";
import { AdultDialog, AdultMenuItem } from "@/components/adult";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type TagOptions, TagsDialog } from "@/components/tags-dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { AdultState } from "@/lib/adult/adult";
import {
  setChapterPublished,
  setStoryAdult,
  setStoryTags,
} from "../../chapters/actions";
import { DeleteStoryDialog } from "../../chapters/delete-story-dialog";
import { MoveStoryDialog } from "./move-story-dialog";

type Dialog = "tags" | "move" | "publish" | "adult" | "delete";

export function ChapterMenu({
  id,
  title,
  tags,
  folderTags,
  tagOptions,
  isPublic,
  adult,
  otherFolders,
}: {
  id: string;
  title: string;
  tags: string[];
  folderTags: string[];
  tagOptions: TagOptions;
  isPublic: boolean;
  adult: AdultState;
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
      <PublicationStatus isPublic={isPublic} />
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
      <TagsDialog
        {...dialogProps("tags")}
        name={title}
        tags={tags}
        folderTags={folderTags}
        options={tagOptions}
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
      <AdultDialog
        {...dialogProps("adult")}
        kind="chapter"
        name={title}
        adult={adult.adult}
        action={() => setStoryAdult(id, !adult.adult)}
      />
      <DeleteStoryDialog {...dialogProps("delete")} id={id} title={title} />
    </>
  );
}
