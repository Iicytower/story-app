"use client";

import { ShieldAlertIcon, ShieldOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { AdultState } from "@/lib/adult/adult";
import type { ActionResult } from "@/lib/action-result";

export function AdultBadge() {
  const t = useTranslations("adult");
  return (
    // Not focusable: it often sits inside a link.
    <span
      role="img"
      aria-label={t("label")}
      title={t("label")}
      className="border-destructive/60 text-destructive shrink-0 rounded-sm border px-1 text-xs leading-4 font-semibold"
    >
      {t("badge")}
    </span>
  );
}

// A locked mark keeps the item visible but disabled, with the reason under it.
export function AdultMenuItem({
  state,
  onSelect,
}: {
  state: AdultState;
  onSelect: () => void;
}) {
  const t = useTranslations("adult");
  const locked = state.adult && state.lock !== null;
  return (
    <DropdownMenuItem disabled={locked} onSelect={onSelect}>
      {state.adult ? <ShieldOffIcon /> : <ShieldAlertIcon />}
      <span className="flex flex-col">
        {state.adult ? t("unmark") : t("mark")}
        {locked && (
          <span className="text-muted-foreground text-xs">
            {state.lock === "admin"
              ? t("lockedByAdmin")
              : state.lock === "auto"
                ? t("lockedByImage")
                : t("lockedByFolder")}
          </span>
        )}
      </span>
    </DropdownMenuItem>
  );
}

export function AdultDialog({
  open,
  onOpenChange,
  kind,
  name,
  adult,
  action,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "folder" | "chapter";
  name: string;
  adult: boolean;
  action: () => Promise<ActionResult>;
}) {
  const t = useTranslations("adult");
  const key =
    `${adult ? "unmark" : "mark"}${kind === "folder" ? "Folder" : "Chapter"}` as const;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`${key}Title`)}
      description={t(`${key}Description`, { name })}
      confirmLabel={adult ? t("unmark") : t("mark")}
      action={action}
    />
  );
}
