"use client";

import { FilePlusIcon, FileUpIcon, FolderPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { ActionMenu, SortSubmenu } from "@/components/action-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setFolderSort } from "../folders/actions";
import type { FolderOption } from "@/lib/languages";
import { CreateFolderDialog } from "../folders/create-folder-dialog";
import { CreateStoryDialog } from "./create-story-dialog";
import { ImportDialog } from "./import-dialog";

type Dialog = "newStory" | "newFolder" | "import";

export function StoriesMenu({
  sort,
  folders,
  defaultFolder,
}: {
  sort: string;
  folders: FolderOption[];
  defaultFolder: string;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [optimisticSort, setOptimisticSort] = useOptimistic(sort);
  const [sortError, setSortError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useTranslations("menu");
  const tFolders = useTranslations("folders");
  const tStories = useTranslations("stories");
  const tImport = useTranslations("import");
  const dialogProps = (name: Dialog) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  function changeSort(mode: string) {
    setSortError(null);
    startTransition(async () => {
      setOptimisticSort(mode);
      const result = await setFolderSort(mode);
      if (!result.ok) setSortError(result.message);
    });
  }

  return (
    <>
      {sortError && (
        <p role="alert" className="text-destructive text-sm">
          {sortError}
        </p>
      )}
      <ActionMenu label={t("actions")}>
        <DropdownMenuItem onSelect={() => setDialog("newStory")}>
          <FilePlusIcon />
          {tStories("newStory")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("newFolder")}>
          <FolderPlusIcon />
          {tFolders("newFolder")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SortSubmenu
          value={optimisticSort}
          options={[
            { value: "updated", label: tFolders("sortUpdated") },
            { value: "manual", label: tFolders("sortManual") },
            { value: "alpha", label: tFolders("sortAlpha") },
          ]}
          onChange={changeSort}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setDialog("import")}>
          <FileUpIcon />
          {tImport("import")}
        </DropdownMenuItem>
      </ActionMenu>
      <CreateStoryDialog
        {...dialogProps("newStory")}
        folders={folders}
        defaultFolder={defaultFolder}
      />
      <CreateFolderDialog {...dialogProps("newFolder")} />
      <ImportDialog
        {...dialogProps("import")}
        folders={folders}
        defaultFolder={defaultFolder}
      />
    </>
  );
}
