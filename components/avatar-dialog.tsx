"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  removeAvatar,
  uploadAvatar,
} from "@/app/[locale]/(protected)/profile/actions";
import { CropFrame, useImageCrop } from "@/components/image-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { AVATAR_SIZE, INPUT_TYPES } from "@/lib/covers/covers";

const PREVIEW_SCALE = 3 / 4;

// The cover dialog's frame, square (task 70). An 18+ verdict refuses the image outright.
export function AvatarDialog({
  open,
  onOpenChange,
  nickname,
  avatar,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nickname: string;
  avatar: string | null;
  onChange: (avatar: string | null) => void;
}) {
  const t = useTranslations("avatar");
  const tErrors = useTranslations("errors");
  const crop = useImageCrop(AVATAR_SIZE);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [busy, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      crop.clear();
      setMessage(null);
    }
  }

  async function choose(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    if (!(await crop.choose(file))) {
      setMessage({ text: t("inputInvalid"), error: true });
    }
  }

  function run(
    action: () => Promise<
      { ok: true; avatar?: string } | { ok: false; message: string }
    >,
    done: string,
  ) {
    setMessage(null);
    startTransition(async () => {
      let result;
      try {
        result = await action();
      } catch {
        setMessage({ text: tErrors("offline"), error: true });
        return;
      }
      if (!result.ok) {
        setMessage({ text: result.message, error: true });
        return;
      }
      crop.clear();
      onChange(result.avatar ?? null);
      setMessage({ text: done, error: false });
    });
  }

  function save() {
    run(async () => {
      const form = new FormData();
      form.set("avatar", await crop.render());
      return uploadAvatar(form);
    }, t("saved"));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {crop.image ? (
            <CropFrame
              crop={crop}
              scale={PREVIEW_SCALE}
              frameLabel={t("frame")}
              zoomLabel={t("zoom")}
            />
          ) : avatar ? (
            <div className="flex justify-center">
              <UserAvatar
                nickname={nickname}
                src={avatar}
                alt={t("current")}
                size={AVATAR_SIZE.width * PREVIEW_SCALE}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("none")}</p>
          )}
          <Label className="flex flex-col items-start gap-2">
            {t("choose")}
            <Input
              type="file"
              accept={INPUT_TYPES.join(",")}
              disabled={busy}
              onChange={(event) => {
                void choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </Label>
          {message && (
            <p
              role={message.error ? "alert" : "status"}
              className={message.error ? "text-destructive text-sm" : "text-sm"}
            >
              {message.text}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {avatar && !crop.image && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(removeAvatar, t("removed"))}
              >
                {t("remove")}
              </Button>
            )}
            {crop.image && (
              <Button disabled={busy} onClick={save}>
                {busy ? t("saving") : t("save")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
