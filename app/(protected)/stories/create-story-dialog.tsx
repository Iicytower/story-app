"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStory } from "./actions";

export function CreateStoryDialog({
  folderNames,
  defaultFolder,
}: {
  folderNames: string[];
  defaultFolder: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>New story</Button>
      </DialogTrigger>
      <DialogContent>
        <CreateStoryForm
          folderNames={folderNames}
          defaultFolder={defaultFolder}
        />
      </DialogContent>
    </Dialog>
  );
}

// Separate component so its state resets each time the dialog content mounts.
function CreateStoryForm({
  folderNames,
  defaultFolder,
}: {
  folderNames: string[];
  defaultFolder: string;
}) {
  const router = useRouter();
  const [folder, setFolder] = useState(defaultFolder);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        <DialogTitle>New story</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-story-folder">Folder</Label>
        {/* Pick an existing folder or type a new name; a new name creates the folder. */}
        <Input
          id="new-story-folder"
          list="new-story-folders"
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          placeholder="Choose or type a new folder"
          autoComplete="off"
        />
        <datalist id="new-story-folders">
          {folderNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-story-title">Title</Label>
        <Input
          id="new-story-title"
          value={title}
          lang="pl"
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
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
