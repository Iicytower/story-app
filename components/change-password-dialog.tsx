"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { changePassword } from "@/app/[locale]/(protected)/actions";
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
import {
  PASSWORD_REQUIREMENT_VALUES,
  PASSWORD_REQUIREMENTS,
} from "@/lib/credentials";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ChangePasswordForm />
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("changePassword");
  const tCommon = useTranslations("common");
  const tPassword = useTranslations("password");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await changePassword(
        data.get("currentPassword"),
        data.get("newPassword"),
        data.get("repeatedPassword"),
      );
      if (result.ok) setChanged(true);
      else setError(result.message);
    });
  }

  if (changed) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <p role="status" className="text-sm">
          {t("changed")}
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button>{tCommon("close")}</Button>
          </DialogClose>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">{t("current")}</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">{t("new")}</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          aria-describedby="new-password-requirements"
          required
        />
        <div
          id="new-password-requirements"
          className="text-muted-foreground text-xs break-words"
        >
          <p>{tPassword("mustContain")}</p>
          <ul className="list-disc pl-4">
            {PASSWORD_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>
                {tPassword(
                  `requirements.${requirement}`,
                  PASSWORD_REQUIREMENT_VALUES,
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="repeated-password">{t("repeat")}</Label>
        <Input
          id="repeated-password"
          name="repeatedPassword"
          type="password"
          autoComplete="new-password"
          required
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
