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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameFolder } from "../actions";

export function RenameFolderDialog({
  open,
  onOpenChange,
  id,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  name: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <RenameFolderForm
          id={id}
          name={name}
          onDone={() => onOpenChange(false)}
        />
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
  const t = useTranslations("folders");
  const tCommon = useTranslations("common");

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
        <DialogTitle>{t("renameTitle")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="rename-folder-name">{t("name")}</Label>
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
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
