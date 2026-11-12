"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
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
import {
  COVER_HEIGHT,
  COVER_SIZE,
  COVER_WIDTH,
  INPUT_TYPES,
} from "@/lib/covers/covers";
import {
  removeFolderCover,
  setCoverAdult,
  setFolderCover,
} from "./cover-actions";

export interface FolderCover {
  id: string;
  manualAdult: boolean;
  autoAdult: boolean;
  // The admin's mark (task 88): true locks it, false overrides the others until marked again.
  adminAdult: boolean | null;
}

const PREVIEW_SCALE = 1 / 3;

export function CoverDialog({
  open,
  onOpenChange,
  folderId,
  folderName,
  cover,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderName: string;
  cover: FolderCover | null;
  pending: boolean;
}) {
  const t = useTranslations("covers");
  const tErrors = useTranslations("errors");
  const crop = useImageCrop(COVER_SIZE);
  const image = crop.image;
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [busy, startTransition] = useTransition();
  const [manualAdult, setManualAdult] = useOptimistic(
    cover?.adminAdult === false ? false : (cover?.manualAdult ?? false),
  );

  function reset() {
    crop.clear();
    setMessage(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
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
      { ok: boolean; message?: string } & Record<string, unknown>
    >,
    done?: (result: Record<string, unknown>) => string | null,
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
        setMessage({ text: String(result.message), error: true });
        return;
      }
      const text = done?.(result) ?? null;
      setMessage(text ? { text, error: false } : null);
    });
  }

  function save() {
    if (!image) return;
    run(
      async () => {
        const form = new FormData();
        form.set("cover", await crop.render());
        return setFolderCover(folderId, form);
      },
      (result) => {
        crop.clear();
        if (result.state === "pending") return t("pending");
        return result.adult ? t("savedAdult") : t("saved");
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name: folderName })}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {image ? (
            <CropFrame
              crop={crop}
              scale={PREVIEW_SCALE}
              frameLabel={t("frame")}
              zoomLabel={t("zoom")}
            />
          ) : cover ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own handler, already 600x900 */}
              <img
                src={`/covers/${cover.id}`}
                alt={t("current", { name: folderName })}
                width={COVER_WIDTH * PREVIEW_SCALE}
                height={COVER_HEIGHT * PREVIEW_SCALE}
                className="rounded-md border"
              />
              {cover.adminAdult === true ? (
                <p className="text-muted-foreground text-sm">
                  {t("adminAdult")}
                </p>
              ) : cover.autoAdult && cover.adminAdult === null ? (
                <p className="text-muted-foreground text-sm">
                  {t("autoAdult")}
                </p>
              ) : (
                <Label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={manualAdult}
                    disabled={busy}
                    onChange={(event) => {
                      const adult = event.target.checked;
                      run(() => {
                        setManualAdult(adult);
                        return setCoverAdult(folderId, adult);
                      });
                    }}
                  />
                  {t("markAdult")}
                </Label>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("none")}</p>
          )}
          {pending && !image && (
            <p className="text-muted-foreground text-sm">{t("pending")}</p>
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
            {cover && !image && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(() => removeFolderCover(folderId))}
              >
                {t("remove")}
              </Button>
            )}
            {image && (
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
