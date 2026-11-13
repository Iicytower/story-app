"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { lengthError, MAX_FOLDER_DESCRIPTION_LENGTH } from "@/lib/limits";
import { saveFolderDescription } from "../actions";

export function FolderDescription({
  folderId,
  initialDescription,
}: {
  folderId: string;
  initialDescription: string;
}) {
  const [value, setValue] = useState(initialDescription);
  const [saved, setSaved] = useState(initialDescription);
  const [status, setStatus] = useState<
    { kind: "saved" } | { kind: "error"; message: string } | null
  >(null);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const t = useTranslations("folders");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const changed = value.trim() !== saved;

  function save() {
    const tooLong = lengthError("folderDescription", value.trim());
    if (tooLong) {
      setStatus({
        kind: "error",
        message: tErrors(tooLong.key, tooLong.values),
      });
      return;
    }
    startTransition(async () => {
      const result = await saveFolderDescription(folderId, value).catch(
        () => null,
      );
      if (!result) {
        setStatus({ kind: "error", message: t("descriptionFailed") });
      } else if (result.ok) {
        setSaved(result.description);
        setValue(result.description);
        setStatus({ kind: "saved" });
      } else {
        setStatus({ kind: "error", message: result.message });
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {t("description")}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setStatus(null);
        }}
        maxLength={MAX_FOLDER_DESCRIPTION_LENGTH}
        placeholder={t("descriptionPlaceholder")}
        rows={2}
        className="min-h-14"
      />
      <div className="flex min-h-8 items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!changed || pending}
          onClick={save}
        >
          {tCommon("save")}
        </Button>
        {status?.kind === "saved" && !changed && (
          <p role="status" className="text-muted-foreground text-sm">
            {t("descriptionSaved")}
          </p>
        )}
        {status?.kind === "error" && (
          <p role="alert" className="text-destructive text-sm">
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
