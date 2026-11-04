"use client";

import { HistoryIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { LocalDate } from "@/components/local-date";
import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VersionListItem } from "@/lib/versions/queries";
import { VERSION_NAME_MAX_LENGTH } from "@/lib/versions/versions";
import {
  createFolderVersion,
  deleteFolderVersion,
  restoreEntireVersion,
} from "./actions";

export function FolderVersions({
  folderId,
  versions,
}: {
  folderId: string;
  versions: VersionListItem[];
}) {
  const t = useTranslations("versions");
  const tFolders = useTranslations("folders");
  return (
    <section aria-labelledby="versions-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="versions-heading" className="text-sm font-medium">
          {t("title")}
        </h2>
        <SaveVersionDialog folderId={folderId} />
      </div>
      {versions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul
          aria-label={t("title")}
          className="flex flex-col divide-y rounded-lg border"
        >
          {versions.map((version) => (
            <li key={version.number} className="flex items-center gap-1 pr-2">
              <Link
                href={`/folders/${folderId}/versions/${version.number}`}
                className="hover:bg-muted/50 flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2"
              >
                <span className="truncate text-sm font-medium">
                  {t("versionName", {
                    number: version.number,
                    name: version.name,
                  })}
                </span>
                <span className="text-muted-foreground text-xs">
                  <LocalDate iso={version.createdAt} withTime /> ·{" "}
                  {tFolders("chapterCount", { count: version.chapterCount })}
                </span>
              </Link>
              <VersionMenu folderId={folderId} version={version} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SaveVersionDialog({ folderId }: { folderId: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("versions");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon />
          {t("save")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <SaveVersionForm folderId={folderId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SaveVersionForm({
  folderId,
  onDone,
}: {
  folderId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("versions");
  const tCommon = useTranslations("common");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createFolderVersion(folderId, name);
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("save")}</DialogTitle>
      </DialogHeader>
      <p className="text-muted-foreground text-sm">{t("saveDescription")}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="version-name">{t("name")}</Label>
        <Input
          id="version-name"
          value={name}
          maxLength={VERSION_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error !== null}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function VersionMenu({
  folderId,
  version,
}: {
  folderId: string;
  version: VersionListItem;
}) {
  const [dialog, setDialog] = useState<"restore" | "delete" | null>(null);
  const t = useTranslations("versions");
  const tMenu = useTranslations("menu");
  const tCommon = useTranslations("common");
  const label = t("label", { number: version.number });
  const dialogProps = (name: "restore" | "delete") => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  return (
    <>
      <ActionMenu label={tMenu("actionsFor", { name: label })}>
        <DropdownMenuItem onSelect={() => setDialog("restore")}>
          <RotateCcwIcon />
          {t("restore")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setDialog("delete")}
        >
          <Trash2Icon />
          {tCommon("delete")}
        </DropdownMenuItem>
      </ActionMenu>
      <ConfirmDialog
        {...dialogProps("restore")}
        title={tMenu("restoreVersion", { number: version.number })}
        description={t("restoreEntireDescription")}
        confirmLabel={t("restore")}
        pendingLabel={t("restoring")}
        action={() => restoreEntireVersion(folderId, version.number)}
      />
      <ConfirmDialog
        {...dialogProps("delete")}
        title={t("deleteTitle")}
        description={t("deleteDescription", {
          number: version.number,
          name: version.name,
        })}
        confirmLabel={tCommon("delete")}
        pendingLabel={tCommon("deleting")}
        destructive
        action={() => deleteFolderVersion(folderId, version.number)}
      />
    </>
  );
}
