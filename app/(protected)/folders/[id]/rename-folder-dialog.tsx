"use client";

import { PencilIcon } from "lucide-react";
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
import { renameFolder } from "../actions";

export function RenameFolderDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PencilIcon />
          Rename
        </Button>
      </DialogTrigger>
      <DialogContent>
        <RenameFolderForm id={id} name={name} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RenameFolderForm({
  id,
  name: currentName,
  onDone,
}: {
  id: string;
  name: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameFolder(id, name);
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Rename folder</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="rename-folder-name">Name</Label>
        <Input
          id="rename-folder-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
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
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
