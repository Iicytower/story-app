"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/action-result";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
  action,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  destructive?: boolean;
  action: () => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  // Opened without a trigger of its own: the focus goes back to where it was, when still there.
  const returnTo = useRef<HTMLElement | null>(null);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setError(null);
  }

  function handleConfirm(event: React.MouseEvent) {
    // Keep the dialog open until the action finishes so errors can be shown.
    event.preventDefault();
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
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          returnTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          if (!returnTo.current?.isConnected) return;
          event.preventDefault();
          returnTo.current.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
