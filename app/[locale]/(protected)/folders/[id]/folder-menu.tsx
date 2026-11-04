"use client";

import {
  FileDownIcon,
  FilePlusIcon,
  FileUpIcon,
  GlobeIcon,
  GlobeLockIcon,
  ListChecksIcon,
  PencilIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { ActionMenu, SortSubmenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { TagsDialog } from "@/components/tags-dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CreateStoryDialog } from "../../stories/create-story-dialog";
import { ImportDialog } from "../../stories/import-dialog";
import {
  publishAllChapters,
  setChapterSort,
  setFolderPublished,
  setFolderTags,
} from "../actions";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { RenameFolderDialog } from "./rename-folder-dialog";

type Dialog =
  | "newChapter"
  | "tags"
  | "rename"
  | "export"
  | "import"
  | "publish"
  | "publishAll"
  | "delete";

export function FolderMenu({
  folder,
  folderNames,
  userTags,
  isPublic,
  unpublishedCount,
}: {
  folder: {
    id: string;
    name: string;
    tags: string[];
    chapterSort: string;
    chapterCount: number;
  };
  folderNames: string[];
  userTags: string[];
  isPublic: boolean;
  unpublishedCount: number;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [sort, setOptimisticSort] = useOptimistic(folder.chapterSort);
  const [sortError, setSortError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useTranslations("menu");
  const tFolders = useTranslations("folders");
  const tTags = useTranslations("tags");
  const tCommon = useTranslations("common");
  const tChapters = useTranslations("chapters");
  const tExport = useTranslations("export");
  const tImport = useTranslations("import");
  const dialogProps = (name: Dialog) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  function changeSort(mode: string) {
    setSortError(null);
    startTransition(async () => {
      setOptimisticSort(mode);
      const result = await setChapterSort(folder.id, mode);
      if (!result.ok) setSortError(result.message);
    });
  }

  return (
    <>
      <ActionMenu label={t("actionsFor", { name: folder.name })}>
        <DropdownMenuItem onSelect={() => setDialog("newChapter")}>
          <FilePlusIcon />
          {tChapters("newChapter")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SortSubmenu
          value={sort}
          options={[
            { value: "created", label: tFolders("sortNewest") },
            { value: "manual", label: tFolders("sortManual") },
            { value: "alpha", label: tFolders("sortAlpha") },
          ]}
          onChange={changeSort}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setDialog("tags")}>
          <TagIcon />
          {tTags("tags")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("rename")}>
          <PencilIcon />
          {tCommon("rename")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setDialog("export")}>
          <FileDownIcon />
          {tExport("exportAs")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("import")}>
          <FileUpIcon />
          {tImport("import")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setDialog("publish")}>
          {isPublic ? <GlobeLockIcon /> : <GlobeIcon />}
          {isPublic ? tFolders("unpublish") : tFolders("publish")}
        </DropdownMenuItem>
        {isPublic && unpublishedCount > 0 && (
          <DropdownMenuItem onSelect={() => setDialog("publishAll")}>
            <ListChecksIcon />
            {tFolders("publishAll")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setDialog("delete")}
        >
          <Trash2Icon />
          {tCommon("delete")}
        </DropdownMenuItem>
      </ActionMenu>
      {sortError && (
        <p role="alert" className="text-destructive order-last w-full text-sm">
          {sortError}
        </p>
      )}
      <CreateStoryDialog
        {...dialogProps("newChapter")}
        folderNames={folderNames}
        defaultFolder={folder.name}
      />
      <TagsDialog
        {...dialogProps("tags")}
        name={folder.name}
        tags={folder.tags}
        suggestions={userTags}
        action={setFolderTags.bind(null, folder.id)}
      />
      <RenameFolderDialog
        {...dialogProps("rename")}
        id={folder.id}
        name={folder.name}
      />
      <ExportDialog
        {...dialogProps("export")}
        dataUrl={`/folders/${folder.id}/export/data`}
        fallbackName="folder"
        chapterFiles
      />
      <ImportDialog {...dialogProps("import")} folderId={folder.id} />
      <ConfirmDialog
        {...dialogProps("publish")}
        title={isPublic ? t("unpublishFolderTitle") : t("publishFolderTitle")}
        description={
          isPublic
            ? t("unpublishFolderDescription", { name: folder.name })
            : t("publishFolderDescription", { name: folder.name })
        }
        confirmLabel={isPublic ? tFolders("unpublish") : tFolders("publish")}
        action={() => setFolderPublished(folder.id, !isPublic)}
      />
      <ConfirmDialog
        {...dialogProps("publishAll")}
        title={tFolders("publishAllTitle")}
        description={tFolders("publishAllDescription", {
          count: unpublishedCount,
        })}
        confirmLabel={tFolders("publishAll")}
        action={() => publishAllChapters(folder.id)}
      />
      <DeleteFolderDialog
        {...dialogProps("delete")}
        id={folder.id}
        name={folder.name}
        chapterCount={folder.chapterCount}
        onDeleted={() => router.push("/stories")}
      />
    </>
  );
}
