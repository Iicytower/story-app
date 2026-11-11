"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { startConversation } from "@/app/[locale]/(protected)/messages/actions";
import { MentionTextarea } from "@/components/mention-textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { profilePath } from "@/components/user-link";
import { useRouter } from "@/i18n/navigation";
import { MAX_DM_LENGTH } from "@/lib/limits";
import { AuthDialog } from "../../auth/auth-dialog";

// The first message to nickname, or the next one of the conversation the two already have; the
// server decides which (task 85). A guest signs in first (D42).
export function MessageButton({
  nickname,
  signedIn,
}: {
  nickname: string;
  signedIn: boolean;
}) {
  const t = useTranslations("profile");
  const tMessages = useTranslations("messages");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const fieldId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      const result = await startConversation(nickname, body);
      if (!result.ok) {
        setError(result.message);
        setSending(false);
        return;
      }
      router.push(`/messages/${result.id}`);
    } catch {
      setError(tErrors("offline"));
      setSending(false);
    }
  }

  const trigger = (
    <Button
      ref={button}
      variant="outline"
      className="self-start"
      onClick={() => setOpen(true)}
    >
      {t("message")}
    </Button>
  );

  if (!signedIn) {
    return (
      <>
        {trigger}
        <AuthDialog
          callbackUrl={`/${locale}${profilePath(nickname)}`}
          trigger={null}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) requestAnimationFrame(() => button.current?.focus());
          }}
        />
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="[overflow-wrap:anywhere]">
              {t("messageTo", { nickname })}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-w-0 flex-col gap-2">
            <label htmlFor={fieldId} className="sr-only">
              {tMessages("newLabel")}
            </label>
            <MentionTextarea
              id={fieldId}
              value={body}
              onValueChange={setBody}
              placeholder={tMessages("placeholder")}
              maxLength={MAX_DM_LENGTH}
              rows={4}
              required
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={sending || !body.trim()}>
                {tMessages("send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
