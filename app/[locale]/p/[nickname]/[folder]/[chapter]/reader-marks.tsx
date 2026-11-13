"use client";

import { BookmarkIcon, NotebookPenIcon, StickyNoteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import {
  MAX_BOOKMARK_NAME_LENGTH,
  MAX_QUOTE_CONTEXT_LENGTH,
  MAX_READER_NOTE_LENGTH,
} from "@/lib/limits";
import type { ReaderMarkView } from "@/lib/reading/marks";
import { anchorQuote, type TextSpan } from "@/lib/social/anchor";
import {
  addBookmark,
  addNote,
  deleteReaderMark,
  updateReaderMark,
  type NoteInput,
} from "./actions";

// Styled in globals.css with ::highlight(reader-note).
const HIGHLIGHT = "reader-note";

export const TOOLBAR_CLASS =
  "bg-background/95 sticky bottom-4 z-10 flex max-w-full flex-wrap gap-2 self-start rounded-lg border p-1";

type Selected = Omit<NoteInput, "text">;

function maxScroll(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

// The same measure as the reading position (reading-tracker.tsx).
function scrolled(): number {
  const max = maxScroll();
  if (max <= 0) return 0;
  return (
    Math.round((Math.min(max, Math.max(0, window.scrollY)) / max) * 1000) / 1000
  );
}

// Offsets in the text content, which is the text the quote and its context come from.
function offsetIn(container: Node, node: Node, offset: number): number {
  const before = document.createRange();
  before.selectNodeContents(container);
  before.setEnd(node, offset);
  return before.toString().length;
}

function rangeIn(container: Node, { start, end }: TextSpan): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let at = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && start <= at + length) {
      range.setStart(node, start - at);
      started = true;
    }
    if (started && end <= at + length) {
      range.setEnd(node, end - at);
      return range;
    }
    at += length;
  }
  return null;
}

function selectedRange(container: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  return container.contains(range.commonAncestorContainer) ? range : null;
}

// The selected passage without surrounding whitespace, with up to 50 characters around it.
function selectedIn(container: HTMLElement): Selected | null {
  const range = selectedRange(container);
  if (!range) return null;
  const text = container.textContent ?? "";
  let start = offsetIn(container, range.startContainer, range.startOffset);
  let end = offsetIn(container, range.endContainer, range.endOffset);
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (start === end) return null;
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - MAX_QUOTE_CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + MAX_QUOTE_CONTEXT_LENGTH),
    position: Math.round((start / text.length) * 1000) / 1000,
  };
}

function scrollToRange(range: Range) {
  const { top } = range.getBoundingClientRect();
  window.scrollTo({
    top: window.scrollY + top - window.innerHeight / 3,
    behavior: "instant",
  });
}

// The anchoring of a note depends only on these fields while the chapter text stays the same.
const anchorKey = ({ quote, prefix, suffix, position }: ReaderMarkView) =>
  JSON.stringify([quote, prefix, suffix, position]);

type Editing =
  | { kind: "newBookmark"; position: number }
  | { kind: "newNote"; selected: Selected }
  | { kind: "edit"; mark: ReaderMarkView };

// Bookmarks and notes of the signed-in reader on a chapter page (task 74). Notes are found again in
// the rendered text (lib/social/anchor.ts) and highlighted without changing the DOM.
export function ReaderMarks({
  initialMarks,
  storyId,
  focusId,
  children,
}: {
  initialMarks: ReaderMarkView[];
  storyId: string;
  focusId: string | null;
  children: ReactNode;
}) {
  const t = useTranslations("marks");
  const textRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState(initialMarks);
  // Null until the page is interactive, so the buttons wait for it.
  const [ranges, setRanges] = useState<Map<string, Range> | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<ReaderMarkView | null>(null);
  const target = useRef<ReaderMarkView | null>(null);
  const focused = useRef(false);
  // Focus goes back to the button that opened a dialog, or to the panel button when it is gone.
  const opener = useRef<HTMLElement | null>(null);
  const panelButton = useRef<HTMLButtonElement>(null);
  const spans = useRef(
    new Map<string, { key: string; span: TextSpan | null }>(),
  );

  useEffect(() => {
    const container = textRef.current;
    if (!container) return;
    const text = container.textContent ?? "";
    const found = new Map<string, Range>();
    for (const mark of marks) {
      if (mark.kind !== "note") continue;
      const key = anchorKey(mark);
      let cached = spans.current.get(mark.id);
      if (cached?.key !== key) {
        cached = { key, span: anchorQuote(text, mark) };
        spans.current.set(mark.id, cached);
      }
      const range = cached.span && rangeIn(container, cached.span);
      if (range) found.set(mark.id, range);
    }
    setRanges(found);
    if (typeof CSS === "undefined" || !CSS.highlights) return;
    CSS.highlights.set(HIGHLIGHT, new Highlight(...found.values()));
    return () => {
      CSS.highlights.delete(HIGHLIGHT);
    };
  }, [marks]);

  useEffect(() => {
    // Only whether there is a selection; the passage is read when the button is pressed.
    const onChange = () =>
      setSelecting(
        textRef.current !== null && selectedRange(textRef.current) !== null,
      );
    document.addEventListener("selectionchange", onChange);
    // A passage selected before the page became interactive.
    onChange();
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  const goTo = useCallback(
    (mark: ReaderMarkView) => {
      const range = ranges?.get(mark.id);
      if (range) scrollToRange(range);
      else if (mark.kind === "bookmark") {
        window.scrollTo({
          top: mark.position * maxScroll(),
          behavior: "instant",
        });
      }
    },
    [ranges],
  );

  // A bookmark or note opened from the library.
  useEffect(() => {
    if (focused.current || !focusId) return;
    const mark = marks.find(({ id }) => id === focusId);
    if (!ranges || !mark || (mark.kind === "note" && !ranges.has(mark.id))) {
      return;
    }
    focused.current = true;
    goTo(mark);
  }, [focusId, marks, ranges, goTo]);

  const sorted = [...marks].sort((a, b) => a.position - b.position);

  function startEditing(next: Editing, button: HTMLElement) {
    opener.current = button;
    setEditing(next);
  }

  function returnFocus() {
    const button = opener.current?.isConnected
      ? opener.current
      : panelButton.current;
    button?.focus({ preventScroll: true });
  }

  function saved(mark: ReaderMarkView) {
    setMarks((current) => [
      ...current.filter(({ id }) => id !== mark.id),
      mark,
    ]);
  }

  return (
    <div className="flex flex-col gap-8">
      <div ref={textRef}>{children}</div>
      <div role="toolbar" aria-label={t("toolbar")} className={TOOLBAR_CLASS}>
        {selecting && (
          <Button
            variant="secondary"
            size="sm"
            // Keeps the selection until the click reads it, also on touch screens.
            onPointerDown={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              const selected = textRef.current && selectedIn(textRef.current);
              if (selected) {
                startEditing(
                  { kind: "newNote", selected },
                  event.currentTarget,
                );
              }
            }}
          >
            <NotebookPenIcon />
            {t("addNote")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={!ranges}
          onClick={(event) =>
            startEditing(
              { kind: "newBookmark", position: scrolled() },
              event.currentTarget,
            )
          }
        >
          <BookmarkIcon />
          {t("addBookmark")}
        </Button>
        <Button
          ref={panelButton}
          variant="ghost"
          size="sm"
          disabled={!ranges}
          onClick={() => setPanelOpen(true)}
        >
          <StickyNoteIcon />
          {t("open", { count: marks.length })}
        </Button>
      </div>

      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          onCloseAutoFocus={(event) => {
            const mark = target.current;
            if (!mark) return;
            event.preventDefault();
            target.current = null;
            panelButton.current?.focus({ preventScroll: true });
            // After the dialog gives the page its scrolling back.
            requestAnimationFrame(() => goTo(mark));
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("panel")}</DialogTitle>
          </DialogHeader>
          {sorted.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <ul aria-label={t("panel")} className="flex flex-col gap-3">
              {sorted.map((mark) => (
                <MarkItem
                  key={mark.id}
                  mark={mark}
                  orphan={
                    mark.kind === "note" &&
                    ranges !== null &&
                    !ranges.has(mark.id)
                  }
                  onGoTo={() => {
                    target.current = mark;
                    setPanelOpen(false);
                  }}
                  onEdit={(button) =>
                    startEditing({ kind: "edit", mark }, button)
                  }
                  onDelete={() => setDeleting(mark)}
                />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {editing && (
        <MarkDialog
          key={editing.kind === "edit" ? editing.mark.id : editing.kind}
          editing={editing}
          onClose={() => setEditing(null)}
          returnFocus={returnFocus}
          onSave={(value) => {
            if (editing.kind === "newBookmark") {
              return addBookmark(storyId, editing.position, value);
            }
            if (editing.kind === "newNote") {
              return addNote(storyId, { ...editing.selected, text: value });
            }
            return updateReaderMark(editing.mark.id, value);
          }}
          onSaved={(mark) => {
            saved(mark);
            setEditing(null);
            if (editing.kind === "newNote")
              window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t(deleting?.kind === "note" ? "deleteNote" : "deleteBookmark")}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        destructive
        action={() => deleteReaderMark(deleting!.id)}
        onDone={() => {
          const id = deleting?.id;
          setMarks((current) => current.filter((mark) => mark.id !== id));
        }}
      />
    </div>
  );
}

function MarkItem({
  mark,
  orphan,
  onGoTo,
  onEdit,
  onDelete,
}: {
  mark: ReaderMarkView;
  orphan: boolean;
  onGoTo: () => void;
  onEdit: (button: HTMLElement) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("marks");
  const label =
    mark.kind === "bookmark"
      ? mark.name || t("bookmarkAt", { position: mark.position })
      : mark.quote;
  return (
    <li
      aria-label={label}
      className="flex min-w-0 flex-col gap-2 rounded-md border p-3 text-sm"
    >
      <span className="text-muted-foreground text-xs font-medium">
        {t(mark.kind === "bookmark" ? "bookmarkKind" : "noteKind")}
      </span>
      {mark.kind === "bookmark" ? (
        <p className="font-medium [overflow-wrap:anywhere]">{label}</p>
      ) : (
        <>
          <blockquote className="line-clamp-4 border-l-2 pl-3 [overflow-wrap:anywhere] italic">
            {mark.quote}
          </blockquote>
          {mark.text && (
            <p className="line-clamp-6 [overflow-wrap:anywhere] whitespace-pre-wrap">
              {mark.text}
            </p>
          )}
          {orphan && <p className="text-muted-foreground">{t("orphan")}</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {!orphan && (
          <Button variant="outline" size="sm" onClick={onGoTo}>
            {t("goTo")}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => onEdit(event.currentTarget)}
        >
          {t("edit")}
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          {t("delete")}
        </Button>
      </div>
    </li>
  );
}

function MarkDialog({
  editing,
  onClose,
  returnFocus,
  onSave,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  returnFocus: () => void;
  onSave: (value: string) => Promise<ActionResult<{ mark: ReaderMarkView }>>;
  onSaved: (mark: ReaderMarkView) => void;
}) {
  const t = useTranslations("marks");
  const tErrors = useTranslations("errors");
  const bookmark =
    editing.kind === "newBookmark" ||
    (editing.kind === "edit" && editing.mark.kind === "bookmark");
  const [value, setValue] = useState(
    editing.kind === "edit" ? editing.mark[bookmark ? "name" : "text"] : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const quote =
    editing.kind === "newNote"
      ? editing.selected.quote
      : editing.kind === "edit"
        ? editing.mark.quote
        : "";
  const title = {
    newBookmark: t("newBookmark"),
    newNote: t("newNote"),
    edit: t(bookmark ? "editBookmark" : "editNote"),
  }[editing.kind];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        // Also when the dialog is unmounted on save.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                const result = await onSave(value);
                if (result.ok) onSaved(result.mark);
                else setError(result.message);
              } catch {
                setError(tErrors("offline"));
              }
            });
          }}
        >
          {quote && (
            <figure className="flex min-w-0 flex-col gap-1">
              <figcaption className="text-muted-foreground text-xs font-medium">
                {t("passage")}
              </figcaption>
              <blockquote className="line-clamp-6 border-l-2 pl-3 text-sm [overflow-wrap:anywhere] italic">
                {quote}
              </blockquote>
            </figure>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reader-mark-value">
              {bookmark ? t("name") : t("text")}
            </Label>
            {bookmark ? (
              <Input
                id="reader-mark-value"
                value={value}
                maxLength={MAX_BOOKMARK_NAME_LENGTH}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <Textarea
                id="reader-mark-value"
                value={value}
                rows={5}
                className="max-h-60 overflow-y-auto"
                maxLength={MAX_READER_NOTE_LENGTH}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="self-end">
            {pending ? t("saving") : t("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
