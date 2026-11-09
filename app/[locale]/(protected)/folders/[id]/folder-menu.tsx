"use client";

import {
  FileDownIcon,
  FilePlusIcon,
  FileUpIcon,
  GlobeIcon,
  GlobeLockIcon,
  ImageIcon,
  LanguagesIcon,
  ListChecksIcon,
  PencilIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import {
  ActionMenu,
  RadioSubmenu,
  SortSubmenu,
} from "@/components/action-menu";
import { AdultDialog, AdultMenuItem } from "@/components/adult";
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
  setFolderAdult,
  setFolderLanguage,
  setFolderPublished,
  setFolderTags,
} from "../actions";
import {
  FOLDER_LANGUAGES,
  type FolderOption,
  folderLanguage,
} from "@/lib/languages";
import type { AdultState } from "@/lib/adult/adult";
import { CoverDialog, type FolderCover } from "./cover-dialog";
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
  | "adult"
  | "cover"
  | "delete";

export function FolderMenu({
  folder,
  folders,
  userTags,
  isPublic,
  adult,
  unpublishedCount,
  cover,
}: {
  folder: {
    id: string;
    name: string;
    tags: string[];
    chapterSort: string;
    language: string;
    chapterCount: number;
  };
  folders: FolderOption[];
  userTags: string[];
  isPublic: boolean;
  adult: AdultState;
  unpublishedCount: number;
  // Missing while covers are off (no tools server, D56).
  cover?: { current: FolderCover | null; pending: boolean };
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [sort, setOptimisticSort] = useOptimistic(folder.chapterSort);
  const [language, setOptimisticLanguage] = useOptimistic(folder.language);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useTranslations("menu");
  const tFolders = useTranslations("folders");
  const tLanguages = useTranslations("languages");
  const tTags = useTranslations("tags");
  const tCommon = useTranslations("common");
  const tChapters = useTranslations("chapters");
  const tExport = useTranslations("export");
  const tImport = useTranslations("import");
  const tCovers = useTranslations("covers");
  const dialogProps = (name: Dialog) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  function changeSort(mode: string) {
    setMenuError(null);
    startTransition(async () => {
      setOptimisticSort(mode);
      const result = await setChapterSort(folder.id, mode);
      if (!result.ok) setMenuError(result.message);
    });
  }

  function changeLanguage(value: string) {
    setMenuError(null);
    startTransition(async () => {
      setOptimisticLanguage(value);
      const result = await setFolderLanguage(folder.id, value);
      if (!result.ok) setMenuError(result.message);
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
        <RadioSubmenu
          icon={<LanguagesIcon />}
          label={t("language")}
          value={language}
          options={FOLDER_LANGUAGES.map((value) => ({
            value,
            label: tLanguages(value),
          }))}
          onChange={changeLanguage}
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
        {cover && (
          <DropdownMenuItem onSelect={() => setDialog("cover")}>
            <ImageIcon />
            {tCovers("cover")}
          </DropdownMenuItem>
        )}
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
        <p role="alert" className="text-destructive order-last w-full text-sm">
          {menuError}
        </p>
      )}
      <CreateStoryDialog
        {...dialogProps("newChapter")}
        folders={folders}
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
      <ImportDialog
        {...dialogProps("import")}
        folderId={folder.id}
        folders={[{ name: folder.name, language: folderLanguage(language) }]}
        defaultFolder={folder.name}
      />
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
      <AdultDialog
        {...dialogProps("adult")}
        kind="folder"
        name={folder.name}
        adult={adult.adult}
        action={() => setFolderAdult(folder.id, !adult.adult)}
      />
      {cover && (
        <CoverDialog
          {...dialogProps("cover")}
          folderId={folder.id}
          folderName={folder.name}
          cover={cover.current}
          pending={cover.pending}
        />
      )}
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
