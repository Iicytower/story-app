"use client";

import { useTranslations } from "next-intl";
import { type RefObject, useId, useRef, useState, useTransition } from "react";
import { ActionMenu } from "@/components/action-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { MAX_BAN_REASON_LENGTH } from "@/lib/limits";
import {
  banFromCommunity,
  type BanDuration,
  hideContent,
} from "@/app/[locale]/(protected)/moderation/actions";

const SELECT =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2 text-base outline-none focus-visible:ring-3 md:text-sm";

// Runs an action, keeps its error next to the form and reports success.
export function useAction() {
  const tErrors = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action();
      } catch {
        setError(tErrors("offline"));
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone?.();
    });
  }
  return { error, pending, run, reset: () => setError(null) };
}

export function ErrorText({
  id,
  error,
}: {
  id?: string;
  error: string | null;
}) {
  return error ? (
    <p id={id} role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

const DURATION_VALUES = ["1", "7", "30", "forever"] as const;

export function BanFields({
  duration,
  onDuration,
  reason,
  onReason,
  errorId,
}: {
  duration: string;
  onDuration: (value: string) => void;
  reason: string;
  onReason: (value: string) => void;
  // The form's error, which may be about the reason.
  errorId?: string;
}) {
  const t = useTranslations("moderation");
  const id = useId();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-duration`}>{t("duration")}</Label>
        <select
          id={`${id}-duration`}
          value={duration}
          onChange={(event) => onDuration(event.target.value)}
          className={SELECT}
        >
          {DURATION_VALUES.map((value) => (
            <option key={value} value={value}>
              {value === "forever"
                ? t("forever")
                : t("days", { count: Number(value) })}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-reason`}>{t("banReason")}</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          maxLength={MAX_BAN_REASON_LENGTH}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={[`${id}-hint`, errorId].filter(Boolean).join(" ")}
          rows={3}
          required
        />
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {t("banReasonHint")}
        </p>
      </div>
    </>
  );
}

const durationOf = (value: string): BanDuration =>
  value === "forever" ? null : (Number(value) as 1 | 7 | 30);

export function useBanState() {
  const [duration, setDuration] = useState("7");
  const [reason, setReason] = useState("");
  return {
    fields: {
      duration,
      onDuration: setDuration,
      reason,
      onReason: setReason,
    },
    duration: durationOf(duration),
    reason,
    clear: () => setReason(""),
  };
}

function BanDialog({
  open,
  onOpenChange,
  authorId,
  nickname,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorId: string;
  nickname: string;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("moderation");
  const tCommon = useTranslations("common");
  const ban = useBanState();
  const errorId = useId();
  const { error, pending, run, reset } = useAction();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      {/* Opened from the menu, so the focus goes back to its ⋮ button. */}
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                banFromCommunity(authorId, nickname, ban.duration, ban.reason),
              () => {
                ban.clear();
                onOpenChange(false);
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle className="[overflow-wrap:anywhere]">
              {t("banTitle", { nickname })}
            </DialogTitle>
            <DialogDescription className="[overflow-wrap:anywhere]">
              {t("banDescription", { nickname })}
            </DialogDescription>
          </DialogHeader>
          <BanFields
            {...ban.fields}
            errorId={error ? `${errorId}-error` : undefined}
          />
          <ErrorText id={`${errorId}-error`} error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || !ban.reason.trim()}
            >
              {t("ban")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HideDialog({
  open,
  onOpenChange,
  commentId,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commentId: string;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("moderation");
  const tCommon = useTranslations("common");
  const id = useId();
  const [reason, setReason] = useState("");
  const { error, pending, run, reset } = useAction();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      {/* Opened from the menu, so the focus goes back to its ⋮ button. */}
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => hideContent("comment", commentId, reason),
              () => onOpenChange(false),
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("hideTitle")}</DialogTitle>
            <DialogDescription>{t("hideDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-reason`}>{t("hideReason")}</Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_BAN_REASON_LENGTH}
              rows={2}
            />
          </div>
          <ErrorText error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {t("hide")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// The ⋮ menu next to a comment for the community's author and moderators (task 79).
export function CommentModerationMenu({
  commentId,
  nickname,
  date,
  authorId,
  canHide,
  canBan,
}: {
  commentId: string;
  nickname: string;
  // When it was written, so each comment's menu has its own name.
  date: string;
  authorId: string;
  canHide: boolean;
  canBan: boolean;
}) {
  const t = useTranslations("moderation");
  const [dialog, setDialog] = useState<"hide" | "ban" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const setOpen = (kind: "hide" | "ban") => (open: boolean) =>
    setDialog(open ? kind : null);
  return (
    <>
      <ActionMenu label={t("menuFor", { nickname, date })} triggerRef={trigger}>
        {canHide && (
          <DropdownMenuItem onSelect={() => setDialog("hide")}>
            {t("hide")}
          </DropdownMenuItem>
        )}
        {canBan && (
          <DropdownMenuItem onSelect={() => setDialog("ban")}>
            {t("banUser", { nickname })}
          </DropdownMenuItem>
        )}
      </ActionMenu>
      <HideDialog
        open={dialog === "hide"}
        onOpenChange={setOpen("hide")}
        commentId={commentId}
        returnFocus={trigger}
      />
      <BanDialog
        open={dialog === "ban"}
        onOpenChange={setOpen("ban")}
        authorId={authorId}
        nickname={nickname}
        returnFocus={trigger}
      />
    </>
  );
}
