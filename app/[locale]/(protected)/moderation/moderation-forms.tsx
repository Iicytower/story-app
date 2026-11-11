"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  BanFields,
  ErrorText,
  useAction,
  useBanState,
} from "@/components/moderation-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import {
  acceptModeratorInvite,
  banFromCommunity,
  declineModeratorInvite,
  inviteModerator,
  liftCommunityBan,
  removeModerator,
  resignModerator,
  restoreContent,
} from "./actions";

// A button that runs one action, optionally after a confirmation.
export function ModerationButton({
  kind,
  label,
  ariaLabel,
  confirm,
  variant = "outline",
}: {
  kind:
    | { action: "restore"; commentId: string }
    | { action: "lift"; authorId: string; nickname: string }
    | { action: "remove"; nickname: string }
    | { action: "accept" | "decline" | "resign"; authorId: string };
  label: string;
  ariaLabel?: string;
  confirm?: { title: string; description: string };
  variant?: "outline" | "ghost" | "default";
}) {
  const { error, pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const action = (): Promise<ActionResult> => {
    switch (kind.action) {
      case "restore":
        return restoreContent("comment", kind.commentId);
      case "lift":
        return liftCommunityBan(kind.authorId, kind.nickname);
      case "remove":
        return removeModerator(kind.nickname);
      case "accept":
        return acceptModeratorInvite(kind.authorId);
      case "decline":
        return declineModeratorInvite(kind.authorId);
      case "resign":
        return resignModerator(kind.authorId);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant={variant}
        aria-label={ariaLabel}
        disabled={pending}
        onClick={() => (confirm ? setOpen(true) : run(action))}
      >
        {label}
      </Button>
      <ErrorText error={error} />
      {confirm && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={label}
          destructive
          action={action}
        />
      )}
    </div>
  );
}

export function BanForm({ authorId }: { authorId: string }) {
  const t = useTranslations("moderation");
  const id = useId();
  const [nickname, setNickname] = useState("");
  const ban = useBanState();
  const { error, pending, run } = useAction();
  return (
    <form
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => banFromCommunity(authorId, nickname, ban.duration, ban.reason),
          () => {
            setNickname("");
            ban.clear();
          },
        );
      }}
    >
      <h3 id={`${id}-title`} className="font-medium">
        {t("banSomeone")}
      </h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-nickname`}>{t("nickname")}</Label>
        <Input
          id={`${id}-nickname`}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          required
        />
      </div>
      <BanFields {...ban.fields} errorId={error ? `${id}-error` : undefined} />
      <ErrorText id={`${id}-error`} error={error} />
      <Button
        type="submit"
        variant="destructive"
        className="self-start"
        disabled={pending || !nickname.trim() || !ban.reason.trim()}
      >
        {t("ban")}
      </Button>
    </form>
  );
}

export function InviteForm() {
  const t = useTranslations("moderation");
  const id = useId();
  const [nickname, setNickname] = useState("");
  const { error, pending, run } = useAction();
  return (
    <form
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => inviteModerator(nickname),
          () => setNickname(""),
        );
      }}
    >
      <h3 id={`${id}-title`} className="font-medium">
        {t("inviteLabel")}
      </h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-nickname`}>{t("nickname")}</Label>
        <Input
          id={`${id}-nickname`}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          required
        />
      </div>
      <ErrorText id={`${id}-error`} error={error} />
      <Button
        type="submit"
        className="self-start"
        disabled={pending || !nickname.trim()}
      >
        {t("invite")}
      </Button>
    </form>
  );
}
