"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PASSWORD_REQUIREMENT_VALUES,
  passwordChecklist,
} from "@/lib/credentials";
import { register } from "./register-actions";

export function RegisterForm({
  onRegistered,
}: {
  onRegistered: (codes: string[], signedIn: boolean) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const tPassword = useTranslations("password");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== repeatedPassword) {
      setError(tErrors("passwordsDoNotMatch"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await register(nickname, password, repeatedPassword);
      if (result.ok) onRegistered(result.recoveryCodes, result.signedIn);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">{t("nickname")}</Label>
        <Input
          id="nickname"
          name="nickname"
          type="text"
          autoComplete="username"
          spellCheck={false}
          aria-describedby="nickname-requirement"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          required
          autoFocus
        />
        <p id="nickname-requirement" className="text-muted-foreground text-xs">
          {tErrors("nicknameRequirement")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-requirements"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <ul
          id="password-requirements"
          aria-label={t("passwordRequirements")}
          className="flex flex-col gap-1 text-xs break-words"
        >
          {passwordChecklist(password).map(({ requirement, met }) => (
            <li
              key={requirement}
              data-met={met}
              className="text-muted-foreground data-[met=false]:text-destructive flex gap-1.5"
            >
              {met ? (
                <Check aria-hidden className="size-3.5 shrink-0" />
              ) : (
                <X aria-hidden className="size-3.5 shrink-0" />
              )}
              <span>
                <span className="sr-only">{met ? t("met") : t("missing")}</span>
                {tPassword(
                  `requirements.${requirement}`,
                  PASSWORD_REQUIREMENT_VALUES,
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="repeated-password">{t("repeatPassword")}</Label>
        <Input
          id="repeated-password"
          name="repeatedPassword"
          type="password"
          autoComplete="new-password"
          value={repeatedPassword}
          onChange={(event) => setRepeatedPassword(event.target.value)}
          required
        />
      </div>
      <p className="text-sm">{t("noRecovery")}</p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("creatingAccount") : t("createAccount")}
      </Button>
    </form>
  );
}
