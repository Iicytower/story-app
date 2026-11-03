"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

export function AuthDialog({
  defaultOpen,
  callbackUrl,
}: {
  defaultOpen: boolean;
  callbackUrl: string;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const registering = mode === "register";
  const t = useTranslations("auth");

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{t("openDialog")}</Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {registering ? t("createAccount") : t("signIn")}
          </DialogTitle>
        </DialogHeader>
        {registering ? (
          <RegisterForm />
        ) : (
          <LoginForm callbackUrl={callbackUrl} />
        )}
        <p className="text-muted-foreground text-sm">
          {registering ? t("haveAccount") : t("noAccount")}
          <button
            type="button"
            className="underline"
            onClick={() => setMode(registering ? "login" : "register")}
          >
            {registering ? t("signIn") : t("createOne")}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
