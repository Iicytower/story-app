"use client";

import { useRouter } from "@/i18n/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FolderOption, languageOfFolder } from "@/lib/languages";
import { createStory } from "./actions";

export function CreateStoryDialog({
  open,
  onOpenChange,
  folders,
  defaultFolder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderOption[];
  defaultFolder: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CreateStoryForm
          folders={folders}
          defaultFolder={defaultFolder}
        />
      </DialogContent>
    </Dialog>
  );
}

// Separate component so its state resets each time the dialog content mounts.
function CreateStoryForm({
  folders,
  defaultFolder,
}: {
  folders: FolderOption[];
  defaultFolder: string;
}) {
  const router = useRouter();
  const [folder, setFolder] = useState(defaultFolder);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("stories");
  const tCommon = useTranslations("common");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createStory(title, folder);
      if (result.ok) router.push(`/stories/${result.id}`);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("newStory")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-story-folder">{t("folder")}</Label>
        {/* Pick an existing folder or type a new name; a new name creates the folder. */}
        <Input
          id="new-story-folder"
          list="new-story-folders"
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          placeholder={t("folderPlaceholder")}
          autoComplete="off"
        />
        <datalist id="new-story-folders">
          {folders.map(({ name }) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-story-title">{t("title")}</Label>
        <Input
          id="new-story-title"
          value={title}
          lang={languageOfFolder(folders, folder)}
          spellCheck
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={error !== null}
        />
      </div>
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
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("creating") : tCommon("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
