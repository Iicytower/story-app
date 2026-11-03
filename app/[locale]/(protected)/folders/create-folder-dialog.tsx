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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFolder } from "./actions";

export function CreateFolderDialog() {
  const t = useTranslations("folders");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{t("newFolder")}</Button>
      </DialogTrigger>
      <DialogContent>
        <CreateFolderForm />
      </DialogContent>
    </Dialog>
  );
}

// Separate component so its state resets each time the dialog content mounts.
function CreateFolderForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("folders");
  const tCommon = useTranslations("common");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createFolder(name);
      if (result.ok) router.push(`/folders/${result.id}`);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("newFolder")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-folder-name">{t("name")}</Label>
        <Input
          id="new-folder-name"
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
          {pending ? tCommon("creating") : tCommon("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
