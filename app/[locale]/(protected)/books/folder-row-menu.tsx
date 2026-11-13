"use client";

import {
  GlobeIcon,
  GlobeLockIcon,
  PencilIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
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
import { DeleteFolderDialog } from "./[id]/delete-folder-dialog";
import { RenameFolderDialog } from "./[id]/rename-folder-dialog";
import type { AdultState } from "@/lib/adult/adult";
import { setFolderAdult, setFolderPublished, setFolderTags } from "./actions";

type Dialog = "tags" | "rename" | "publish" | "adult" | "delete";

export function FolderRowMenu({
  id,
  name,
  tags,
  tagOptions,
  isPublic,
  adult,
  chapterCount,
}: {
  id: string;
  name: string;
  tags: string[];
  tagOptions: TagOptions;
  isPublic: boolean;
  adult: AdultState;
  chapterCount: number;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const t = useTranslations("menu");
  const tFolders = useTranslations("folders");
  const tTags = useTranslations("tags");
  const tCommon = useTranslations("common");
  const dialogProps = (dialogName: Dialog) => ({
    open: dialog === dialogName,
    onOpenChange: (open: boolean) => setDialog(open ? dialogName : null),
  });

  return (
    <>
      <PublicationStatus isPublic={isPublic} />
      <ActionMenu label={t("actionsFor", { name })}>
        <DropdownMenuItem onSelect={() => setDialog("tags")}>
          <TagIcon />
          {tTags("tags")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("rename")}>
          <PencilIcon />
          {tCommon("rename")}
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
      <AdultDialog
        {...dialogProps("adult")}
        kind="folder"
        name={name}
        adult={adult.adult}
        action={() => setFolderAdult(id, !adult.adult)}
      />
      <TagsDialog
        {...dialogProps("tags")}
        name={name}
        tags={tags}
        options={tagOptions}
        action={setFolderTags.bind(null, id)}
      />
      <RenameFolderDialog {...dialogProps("rename")} id={id} name={name} />
      <ConfirmDialog
        {...dialogProps("publish")}
        title={isPublic ? t("unpublishFolderTitle") : t("publishFolderTitle")}
        description={
          isPublic
            ? t("unpublishFolderDescription", { name })
            : t("publishFolderDescription", { name })
        }
        confirmLabel={isPublic ? tFolders("unpublish") : tFolders("publish")}
        action={() => setFolderPublished(id, !isPublic)}
      />
      <DeleteFolderDialog
        {...dialogProps("delete")}
        id={id}
        name={name}
        chapterCount={chapterCount}
        // deleteFolder does not refresh: on the folder's own page it redirects instead.
        onDeleted={() => router.refresh()}
      />
    </>
  );
}
