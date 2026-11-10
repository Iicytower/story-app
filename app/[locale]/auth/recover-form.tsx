"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recoverAccount } from "./recover-actions";

export function RecoverForm({
  onReset,
}: {
  onReset: (codes: string[], signedIn: boolean) => void;
}) {
  const t = useTranslations("recovery");
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== repeatedPassword) {
      setError(tErrors("passwordsDoNotMatch"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recoverAccount(
        nickname,
        code,
        password,
        repeatedPassword,
      );
      if (result.ok) onReset(result.recoveryCodes, result.signedIn);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="recover-nickname">{tAuth("nickname")}</Label>
        <Input
          id="recover-nickname"
          autoComplete="username"
          spellCheck={false}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="recover-code">{t("code")}</Label>
        <Input
          id="recover-code"
          autoComplete="one-time-code"
          spellCheck={false}
          aria-describedby="recover-code-hint"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />
        <p id="recover-code-hint" className="text-muted-foreground text-xs">
          {t("codeHint")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="recover-password">{t("newPassword")}</Label>
        <Input
          id="recover-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="recover-repeated">{t("repeatPassword")}</Label>
        <Input
          id="recover-repeated"
          type="password"
          autoComplete="new-password"
          value={repeatedPassword}
          onChange={(event) => setRepeatedPassword(event.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
