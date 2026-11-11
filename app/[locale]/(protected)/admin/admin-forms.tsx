"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ErrorText, useAction } from "@/components/action-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BanFields, useBanState } from "@/components/moderation-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { MAX_CATEGORY_LABEL_LENGTH } from "@/lib/limits";
import { MAX_TAG_LENGTH } from "@/lib/tags/tags";
import { resolveReport } from "../moderation/actions";
import {
  addCategoryModerator,
  adminHide,
  deleteCategory,
  liftGlobalBan,
  moveCategory,
  removeCategoryModerator,
  removeTag,
  saveCategory,
  saveTag,
  setAdminAdult,
  setGlobalBan,
} from "./actions";

export type AdminButtonKind =
  | { action: "resolved" | "dismissed"; reportId: string }
  | { action: "hide"; targetType: "comment" | "post"; id: string }
  | { action: "lift"; nickname: string }
  | { action: "adult"; address: string; value: boolean | null }
  | { action: "up" | "down" | "deleteCategory"; key: string }
  | { action: "removeModerator"; key: string; nickname: string }
  | { action: "removeTag"; key: string };

function run(kind: AdminButtonKind): Promise<ActionResult> {
  switch (kind.action) {
    case "resolved":
    case "dismissed":
      return resolveReport(kind.reportId, kind.action);
    case "hide":
      return adminHide(kind.targetType, kind.id);
    case "lift":
      return liftGlobalBan(kind.nickname);
    case "adult":
      return setAdminAdult(kind.address, kind.value);
    case "up":
    case "down":
      return moveCategory(kind.key, kind.action);
    case "deleteCategory":
      return deleteCategory(kind.key);
    case "removeModerator":
      return removeCategoryModerator(kind.key, kind.nickname);
    case "removeTag":
      return removeTag(kind.key);
  }
}

// One action, optionally after a confirmation, with its error under it.
export function AdminButton({
  kind,
  label,
  ariaLabel,
  confirm,
  variant = "outline",
  disabled,
}: {
  kind: AdminButtonKind;
  label: string;
  ariaLabel?: string;
  confirm?: { title: string; description: string };
  variant?: "outline" | "ghost" | "default" | "destructive";
  disabled?: boolean;
}) {
  const { error, pending, run: start } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant={variant}
        aria-label={ariaLabel}
        disabled={pending || disabled}
        onClick={() => (confirm ? setOpen(true) : start(() => run(kind)))}
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
          action={() => run(kind)}
        />
      )}
    </div>
  );
}

const FORM = "flex min-w-0 flex-col gap-3 rounded-lg border p-4";

function Field({
  id,
  label,
  value,
  onChange,
  maxLength,
  errorId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  errorId?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        autoComplete="off"
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        required
      />
    </div>
  );
}

export function GlobalBanForm({
  initialNickname,
}: {
  initialNickname: string;
}) {
  const t = useTranslations("admin");
  const tModeration = useTranslations("moderation");
  const id = useId();
  const [nickname, setNickname] = useState(initialNickname);
  const ban = useBanState();
  const { error, pending, run: start } = useAction();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <form
      aria-labelledby={`${id}-title`}
      className={FORM}
      onSubmit={(event) => {
        event.preventDefault();
        start(
          () => setGlobalBan(nickname, ban.duration, ban.reason),
          () => {
            setNickname("");
            ban.clear();
          },
        );
      }}
    >
      <h2 id={`${id}-title`} className="font-medium">
        {t("banTitle")}
      </h2>
      <p className="text-muted-foreground text-sm">{t("banHint")}</p>
      <Field
        id={`${id}-nickname`}
        label={tModeration("nickname")}
        value={nickname}
        onChange={setNickname}
        errorId={errorId}
      />
      <BanFields {...ban.fields} errorId={errorId} />
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

export function CategoryForm({
  category,
}: {
  category?: {
    key: string;
    labels: { en: string; pl: string };
    adminOnly: boolean;
  };
}) {
  const t = useTranslations("admin");
  const id = useId();
  const [en, setEn] = useState(category?.labels.en ?? "");
  const [pl, setPl] = useState(category?.labels.pl ?? "");
  const [adminOnly, setAdminOnly] = useState(category?.adminOnly ?? false);
  const { error, pending, run: start } = useAction();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <form
      aria-label={
        category
          ? t("editCategory", { name: category.labels.en })
          : t("newCategory")
      }
      className={category ? "flex min-w-0 flex-col gap-3" : FORM}
      onSubmit={(event) => {
        event.preventDefault();
        start(
          () => saveCategory(category?.key ?? null, { en, pl }, adminOnly),
          category
            ? undefined
            : () => {
                setEn("");
                setPl("");
                setAdminOnly(false);
              },
        );
      }}
    >
      {!category && <h2 className="font-medium">{t("newCategory")}</h2>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`${id}-en`}
          label={t("labelEn")}
          value={en}
          onChange={setEn}
          maxLength={MAX_CATEGORY_LABEL_LENGTH}
          errorId={errorId}
        />
        <Field
          id={`${id}-pl`}
          label={t("labelPl")}
          value={pl}
          onChange={setPl}
          maxLength={MAX_CATEGORY_LABEL_LENGTH}
          errorId={errorId}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={adminOnly}
          onChange={(event) => setAdminOnly(event.target.checked)}
          className="accent-primary size-4"
        />
        {t("adminOnly")}
      </label>
      <ErrorText id={`${id}-error`} error={error} />
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={pending || !en.trim() || !pl.trim()}
      >
        {category ? t("save") : t("add")}
      </Button>
    </form>
  );
}

export function CategoryModeratorForm({
  categoryKey,
  name,
}: {
  categoryKey: string;
  name: string;
}) {
  const t = useTranslations("admin");
  const tModeration = useTranslations("moderation");
  const id = useId();
  const [nickname, setNickname] = useState("");
  const { error, pending, run: start } = useAction();
  return (
    <form
      aria-label={t("addModeratorTo", { name })}
      className="flex min-w-0 flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        start(
          () => addCategoryModerator(categoryKey, nickname),
          () => setNickname(""),
        );
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Field
          id={`${id}-nickname`}
          label={tModeration("nickname")}
          value={nickname}
          onChange={setNickname}
          errorId={error ? `${id}-error` : undefined}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending || !nickname.trim()}>
        {t("addModerator")}
      </Button>
      <div className="basis-full">
        <ErrorText id={`${id}-error`} error={error} />
      </div>
    </form>
  );
}

export function TagForm({
  tag,
}: {
  tag?: { key: string; labels: { en: string; pl: string } };
}) {
  const t = useTranslations("admin");
  const id = useId();
  const [key, setKey] = useState(tag?.key ?? "");
  const [en, setEn] = useState(tag?.labels.en ?? "");
  const [pl, setPl] = useState(tag?.labels.pl ?? "");
  const { error, pending, run: start } = useAction();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <form
      aria-label={tag ? t("editTag", { key: tag.key }) : t("newTag")}
      className={tag ? "flex min-w-0 flex-col gap-3" : FORM}
      onSubmit={(event) => {
        event.preventDefault();
        start(
          () => saveTag(key, en, pl),
          tag
            ? undefined
            : () => {
                setKey("");
                setEn("");
                setPl("");
              },
        );
      }}
    >
      {!tag && <h2 className="font-medium">{t("newTag")}</h2>}
      <div className="grid gap-3 sm:grid-cols-3">
        {!tag && (
          <Field
            id={`${id}-key`}
            label={t("tagKey")}
            value={key}
            onChange={setKey}
            maxLength={MAX_TAG_LENGTH}
            errorId={errorId}
          />
        )}
        <Field
          id={`${id}-en`}
          label={t("labelEn")}
          value={en}
          onChange={setEn}
          maxLength={MAX_TAG_LENGTH}
          errorId={errorId}
        />
        <Field
          id={`${id}-pl`}
          label={t("labelPl")}
          value={pl}
          onChange={setPl}
          maxLength={MAX_TAG_LENGTH}
          errorId={errorId}
        />
      </div>
      {!tag && (
        <p className="text-muted-foreground text-xs">{t("tagKeyHint")}</p>
      )}
      <ErrorText id={`${id}-error`} error={error} />
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={pending || !key.trim() || !en.trim() || !pl.trim()}
      >
        {tag ? t("save") : t("add")}
      </Button>
    </form>
  );
}
