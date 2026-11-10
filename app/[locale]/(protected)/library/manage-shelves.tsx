"use client";

import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import type { ShelfView } from "@/lib/library/queries";
import { MAX_SHELF_NAME_LENGTH, MAX_SHELVES } from "@/lib/limits";
import {
  createShelf,
  deleteShelf,
  renameShelf,
  reorderShelves,
} from "./actions";

export function ManageShelves({ shelves }: { shelves: ShelfView[] }) {
  const t = useTranslations("library");
  const tErrors = useTranslations("errors");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<ShelfView | null>(null);
  const content = useRef<HTMLDivElement>(null);

  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.message);
        else onDone?.();
      } catch {
        setError(tErrors("offline"));
      }
    });
  }

  function move(index: number, by: -1 | 1) {
    const ids = shelves.map(({ id }) => id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    run(() => reorderShelves(ids));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{t("manage")}</Button>
      </DialogTrigger>
      <DialogContent
        ref={content}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        // Focus on the dialog itself, so the keyboard does not open over the first name on a phone.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("manage")}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {t("shelfCount", { count: shelves.length, max: MAX_SHELVES })}
        </p>
        <ul className="flex flex-col gap-2">
          {shelves.map((shelf, index) => (
            <ShelfRow
              key={`${shelf.id}:${shelf.name}`}
              shelf={shelf}
              busy={busy}
              first={index === 0}
              last={index === shelves.length - 1}
              onRename={(next) => run(() => renameShelf(shelf.id, next))}
              onMove={(by) => move(index, by)}
              onDelete={() => setDeleting(shelf)}
            />
          ))}
        </ul>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => createShelf(name),
              () => setName(""),
            );
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="new-shelf">{t("newShelf")}</Label>
            <Input
              id="new-shelf"
              value={name}
              maxLength={MAX_SHELF_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {t("addShelf")}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </DialogContent>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle", { name: deleting?.name ?? "" })}
        description={t("deleteDescription")}
        confirmLabel={t("deleteShelf", { name: deleting?.name ?? "" })}
        destructive
        action={() => deleteShelf(deleting!.id)}
      />
    </Dialog>
  );
}

function ShelfRow({
  shelf,
  busy,
  first,
  last,
  onRename,
  onMove,
  onDelete,
}: {
  shelf: ShelfView;
  busy: boolean;
  first: boolean;
  last: boolean;
  onRename: (name: string) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(shelf.name);

  return (
    <li>
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          onRename(name);
        }}
      >
        <Input
          aria-label={t("nameOf", { name: shelf.name })}
          value={name}
          maxLength={MAX_SHELF_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1"
        />
        {name !== shelf.name && (
          <Button type="submit" variant="outline" disabled={busy}>
            {tCommon("rename")}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("moveUp", { name: shelf.name })}
          disabled={busy || first}
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("moveDown", { name: shelf.name })}
          disabled={busy || last}
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("deleteShelf", { name: shelf.name })}
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </form>
    </li>
  );
}
