"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { moveStory } from "../../chapters/actions";

type FolderOption = { id: string; name: string };

export function MoveStoryDialog({
  open,
  onOpenChange,
  id,
  title,
  folders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  title: string;
  folders: FolderOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MoveStoryForm
          id={id}
          title={title}
          folders={folders}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function MoveStoryForm({
  id,
  title,
  folders,
  onDone,
}: {
  id: string;
  title: string;
  folders: FolderOption[];
  onDone: () => void;
}) {
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("folders");
  const tCommon = useTranslations("common");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await moveStory(id, folderId);
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("moveTo")}</DialogTitle>
      </DialogHeader>
      {folders.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noOtherFolders")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="move-story-folder">{t("folderFor", { title })}</Label>
          <select
            id="move-story-folder"
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2 text-base outline-none focus-visible:ring-3 md:text-sm"
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || folders.length === 0}>
          {pending ? t("moving") : t("move")}
        </Button>
      </DialogFooter>
    </form>
  );
}
