"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NICKNAME_REQUIREMENT, passwordChecklist } from "@/lib/credentials";
import { register } from "./actions";

export function RegisterForm() {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== repeatedPassword) {
      setError("The passwords do not match.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await register(nickname, password, repeatedPassword);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">Nickname</Label>
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
          {NICKNAME_REQUIREMENT}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
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
          aria-label="Password requirements"
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
                <span className="sr-only">{met ? "Met: " : "Missing: "}</span>
                {requirement}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="repeated-password">Repeat password</Label>
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
      <p className="text-sm">
        There is no password recovery. If you forget your password, you lose
        access to your account and stories.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
