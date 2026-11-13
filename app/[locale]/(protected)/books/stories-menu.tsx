"use client";

import { FilePlusIcon, FileUpIcon, FolderPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { ActionMenu, SortSubmenu } from "@/components/action-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setFolderSort } from "./actions";
import type { FolderOption } from "@/lib/languages";
import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateStoryDialog } from "../chapters/create-story-dialog";
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
        <p role="alert" className="text-destructive order-last w-full text-sm">
          {sortError}
        </p>
      )}
      {/* one group, so on narrow screens all actions wrap together under the title */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setDialog("newFolder")}>
          <FolderPlusIcon />
          {tFolders("newFolder")}
        </Button>
        <Button variant="outline" onClick={() => setDialog("newStory")}>
          <FilePlusIcon />
          {tStories("newStory")}
        </Button>
        <ActionMenu label={t("actions")}>
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
      </div>
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
