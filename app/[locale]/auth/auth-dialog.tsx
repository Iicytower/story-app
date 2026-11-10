"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoginForm } from "./login-form";
import { RecoverForm } from "./recover-form";
import { RecoveryCodesView } from "./recovery-codes-view";
import { RegisterForm } from "./register-form";

type Mode = "login" | "register" | "recover";

type Codes = { codes: string[]; replaced: boolean; signedIn: boolean };

export function AuthDialog({
  defaultOpen = false,
  callbackUrl,
  initialMode = "login",
  trigger,
}: {
  defaultOpen?: boolean;
  callbackUrl: string;
  initialMode?: Mode;
  // Defaults to the "Log in / Create account" button.
  trigger?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [codes, setCodes] = useState<Codes | null>(null);
  const t = useTranslations("auth");
  const tRecovery = useTranslations("recovery");
  const title = codes
    ? tRecovery("title")
    : {
        login: t("signIn"),
        register: t("createAccount"),
        recover: tRecovery("resetTitle"),
      }[mode];
  // The codes are shown only once: the dialog stays open until they are saved.
  const keepOpen = (event: Event) => {
    if (codes) event.preventDefault();
  };

  return (
    <Dialog
      defaultOpen={defaultOpen}
      onOpenChange={(open) => {
        if (open) setMode(initialMode);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">{t("openDialog")}</Button>}
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!codes}
        onEscapeKeyDown={keepOpen}
        onInteractOutside={keepOpen}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {codes ? (
          <RecoveryCodesView {...codes} />
        ) : mode === "register" ? (
          <RegisterForm
            onRegistered={(list, signedIn) =>
              setCodes({ codes: list, replaced: false, signedIn })
            }
          />
        ) : mode === "recover" ? (
          <RecoverForm
            onReset={(list, signedIn) =>
              setCodes({ codes: list, replaced: true, signedIn })
            }
          />
        ) : (
          <LoginForm callbackUrl={callbackUrl} />
        )}
        {!codes && mode === "login" && (
          <button
            type="button"
            className="text-muted-foreground self-start text-sm underline"
            onClick={() => setMode("recover")}
          >
            {tRecovery("forgot")}
          </button>
        )}
        {!codes && mode === "recover" && (
          <button
            type="button"
            className="text-muted-foreground self-start text-sm underline"
            onClick={() => setMode("login")}
          >
            {tRecovery("back")}
          </button>
        )}
        {!codes && mode !== "recover" && (
          <p className="text-muted-foreground text-sm">
            {mode === "login" ? t("noAccount") : t("haveAccount")}
            <button
              type="button"
              className="underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? t("createOne") : t("signIn")}
            </button>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
