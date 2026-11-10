"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import type { ShelfView } from "@/lib/library/queries";
import { addToLibrary, removeFromLibrary, setItemShelves } from "./actions";

export function LibraryPicker({
  folderId,
  shelves,
  shelfIds,
  bookName,
}: {
  folderId: string;
  shelves: ShelfView[];
  // null: the book is not in the library.
  shelfIds: string[] | null;
  // Given in the library list, where the trigger names the book's shelves.
  bookName?: string;
}) {
  const t = useTranslations("library");
  const tErrors = useTranslations("errors");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const saved = shelfIds !== null;

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.message);
      } catch {
        setError(tErrors("offline"));
      }
    });
  }

  function toggle(shelfId: string, checked: boolean) {
    const current = shelfIds ?? [];
    const next = checked
      ? [...current, shelfId]
      : current.filter((id) => id !== shelfId);
    run(() =>
      saved ? setItemShelves(folderId, next) : addToLibrary(folderId, next),
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={
              saved && !bookName ? "outline" : bookName ? "ghost" : "default"
            }
            size={bookName ? "sm" : "default"}
            disabled={busy}
            aria-label={
              bookName ? t("shelvesOf", { name: bookName }) : undefined
            }
          >
            {bookName ? t("shelves") : saved ? t("inLibrary") : t("add")}
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-w-[min(20rem,calc(100vw-2rem))]"
        >
          {!saved && (
            <>
              <DropdownMenuItem
                onSelect={() => run(() => addToLibrary(folderId, []))}
                className="min-w-0 break-words"
              >
                {t("saveWithoutShelf")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>{t("shelves")}</DropdownMenuLabel>
          {shelves.length === 0 && (
            <p className="text-muted-foreground px-1.5 py-1 text-sm">
              {t("noShelves")}
            </p>
          )}
          {shelves.map((shelf) => (
            <DropdownMenuCheckboxItem
              key={shelf.id}
              checked={shelfIds?.includes(shelf.id) ?? false}
              disabled={busy}
              // The menu stays open, so several shelves can be picked in a row.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => toggle(shelf.id, checked)}
              className="min-w-0 break-words"
            >
              {shelf.name}
            </DropdownMenuCheckboxItem>
          ))}
          {saved && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => run(() => removeFromLibrary(folderId))}
              >
                {t("remove")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
