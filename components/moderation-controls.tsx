"use client";

import { useTranslations } from "next-intl";
import { type RefObject, useId, useRef, useState } from "react";
import { ErrorText, SELECT, useAction } from "@/components/action-form";
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
import { MAX_BAN_REASON_LENGTH } from "@/lib/limits";
import {
  banFromCommunity,
  type BanDuration,
  hideContent,
} from "@/app/[locale]/(protected)/moderation/actions";
import { AuthDialog } from "@/app/[locale]/auth/auth-dialog";
import { ReportDialog } from "@/components/report-dialog";

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

// The ⋮ menu next to a comment: Report for other readers and guests (task 80), Hide and Ban for
// the community's author and moderators (task 79). Nothing to do, no menu.
export function CommentMenu({
  commentId,
  nickname,
  date,
  authorId,
  canHide,
  canBan,
  canReport,
  signedIn,
  callbackUrl,
}: {
  commentId: string;
  nickname: string;
  // When it was written, so each comment's menu has its own name.
  date: string;
  // The community the viewer moderates, for banning the writer.
  authorId: string | null;
  canHide: boolean;
  canBan: boolean;
  canReport: boolean;
  signedIn: boolean;
  callbackUrl: string;
}) {
  const t = useTranslations("moderation");
  const tComments = useTranslations("comments");
  const tReports = useTranslations("reports");
  const [dialog, setDialog] = useState<"hide" | "ban" | "report" | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const setOpen = (kind: "hide" | "ban" | "report") => (open: boolean) =>
    setDialog(open ? kind : null);
  const moderates = authorId !== null && (canHide || canBan);
  if (!moderates && !canReport) return null;
  return (
    <>
      <ActionMenu
        label={
          moderates
            ? t("menuFor", { nickname, date })
            : tComments("menuFor", { nickname, date })
        }
        triggerRef={trigger}
      >
        {canReport && (
          <DropdownMenuItem onSelect={() => setDialog("report")}>
            {tReports("report")}
          </DropdownMenuItem>
        )}
        {moderates && canHide && (
          <DropdownMenuItem onSelect={() => setDialog("hide")}>
            {t("hide")}
          </DropdownMenuItem>
        )}
        {moderates && canBan && (
          <DropdownMenuItem onSelect={() => setDialog("ban")}>
            {t("banUser", { nickname })}
          </DropdownMenuItem>
        )}
      </ActionMenu>
      {canReport &&
        (signedIn ? (
          <ReportDialog
            open={dialog === "report"}
            onOpenChange={setOpen("report")}
            target={{ type: "comment", id: commentId }}
            returnFocus={trigger}
          />
        ) : (
          <AuthDialog
            callbackUrl={callbackUrl}
            trigger={null}
            open={dialog === "report"}
            onOpenChange={(open) => {
              setOpen("report")(open);
              if (!open) requestAnimationFrame(() => trigger.current?.focus());
            }}
          />
        ))}
      {moderates && (
        <>
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
      )}
    </>
  );
}

// Hide and Ban buttons on a report in the moderation panel (task 80).
export function ReportModerationButtons({
  commentId,
  nickname,
  authorId,
  canHide,
  canBan,
  hideLabel,
  banLabel,
}: {
  commentId: string;
  nickname: string | null;
  authorId: string;
  canHide: boolean;
  canBan: boolean;
  hideLabel: string;
  banLabel: string;
}) {
  const t = useTranslations("moderation");
  const [dialog, setDialog] = useState<"hide" | "ban" | null>(null);
  const hideButton = useRef<HTMLButtonElement>(null);
  const banButton = useRef<HTMLButtonElement>(null);
  const setOpen = (kind: "hide" | "ban") => (open: boolean) =>
    setDialog(open ? kind : null);
  return (
    <>
      {canHide && (
        <>
          <Button
            ref={hideButton}
            size="sm"
            variant="outline"
            aria-label={hideLabel}
            onClick={() => setDialog("hide")}
          >
            {t("hide")}
          </Button>
          <HideDialog
            open={dialog === "hide"}
            onOpenChange={setOpen("hide")}
            commentId={commentId}
            returnFocus={hideButton}
          />
        </>
      )}
      {canBan && nickname && (
        <>
          <Button
            ref={banButton}
            size="sm"
            variant="outline"
            aria-label={banLabel}
            onClick={() => setDialog("ban")}
          >
            {t("banUser", { nickname })}
          </Button>
          <BanDialog
            open={dialog === "ban"}
            onOpenChange={setOpen("ban")}
            authorId={authorId}
            nickname={nickname}
            returnFocus={banButton}
          />
        </>
      )}
    </>
  );
}
