"use client";

import { FlagIcon } from "lucide-react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { type RefObject, useId, useRef, useState } from "react";
import { AuthDialog } from "@/app/[locale]/auth/auth-dialog";
import { report } from "@/app/[locale]/p/[nickname]/report-actions";
import { ErrorText, SELECT, useAction } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_REPORT_LENGTH } from "@/lib/limits";
import {
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from "@/lib/social/reports";

export type ReportTargetRef = {
  type: Exclude<ReportTarget, "post">;
  // The nickname for a profile, the id otherwise.
  id: string;
};

// The reason and details of one report (D80), then a thank-you in place of the form.
export function ReportDialog({
  open,
  onOpenChange,
  target,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportTargetRef;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("reports");
  const tCommon = useTranslations("common");
  const id = useId();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const { error, pending, run, reset } = useAction();
  // A report sent leaves an empty form for the next one.
  const change = (next: boolean) => {
    onOpenChange(next);
    if (next) return;
    reset();
    if (sent) {
      setSent(false);
      setReason("");
      setDetails("");
    }
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("title", { target: target.type })}</DialogTitle>
              <DialogDescription role="status">{t("sent")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => change(false)}>
                {tCommon("close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () =>
                  report(
                    target.type,
                    target.id,
                    reason as ReportReason,
                    details,
                  ),
                () => setSent(true),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("title", { target: target.type })}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
              <select
                id={`${id}-reason`}
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as ReportReason)
                }
                className={SELECT}
                required
              >
                <option value="" disabled>
                  {t("choose")}
                </option>
                {REPORT_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {t("reasons", { reason: value })}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-details`}>{t("details")}</Label>
              <Textarea
                id={`${id}-details`}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={MAX_REPORT_LENGTH}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                rows={3}
              />
            </div>
            <ErrorText id={`${id}-error`} error={error} />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => change(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t("send")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// "Report" on a chapter, a book or a profile. A guest gets the sign-in dialog (D42).
export function ReportButton({
  target,
  label,
  callbackUrl,
  className,
}: {
  // null for a guest.
  target: ReportTargetRef | null;
  label: string;
  callbackUrl: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={button}
        type="button"
        variant="ghost"
        size="sm"
        className={cn("text-muted-foreground self-start", className)}
        onClick={() => setOpen(true)}
      >
        <FlagIcon />
        {label}
      </Button>
      {target ? (
        <ReportDialog
          open={open}
          onOpenChange={setOpen}
          target={target}
          returnFocus={button}
        />
      ) : (
        <AuthDialog
          callbackUrl={callbackUrl}
          trigger={null}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) requestAnimationFrame(() => button.current?.focus());
          }}
        />
      )}
    </>
  );
}
