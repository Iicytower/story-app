"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/[locale]/(protected)/actions";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Shown inside the settings dialog; onDone goes back to the settings. Success signs out and
// leaves the page from the action itself.
export function DeleteAccountForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deleteAccount");
  const tCommon = useTranslations("common");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await deleteAccount(
        data.get("password"),
        data.get("nickname"),
      );
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-account-password">{t("password")}</Label>
        <Input
          id="delete-account-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-account-nickname">{t("nickname")}</Label>
        <Input
          id="delete-account-nickname"
          name="nickname"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? t("deleting") : t("confirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}
