"use client";

import { cn } from "cn";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { AUTOSAVE_DELAY_MS, onTabHidden } from "@/lib/autosave";
import { saveFolderNotes } from "../actions";

type SaveState =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; message: string };

type FlushResult = { ok: true } | { ok: false; message: string };

// Lives in the component that owns the notes, so they survive the panels around them remounting.
export function useFolderNotes(
  folderId: string,
  initialNotes: string,
  initialNotesUpdatedAt: string,
) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const latest = useRef(initialNotes);
  const saved = useRef(initialNotes);
  const notesUpdatedAt = useRef(initialNotesUpdatedAt);
  const queue = useRef(Promise.resolve());

  // Saves run one at a time, so each one sends the notesUpdatedAt returned by the previous one.
  // Resolves once the notes typed so far are saved, e.g. before leaving the page.
  const flush = useCallback((): Promise<FlushResult> => {
    const run = queue.current.then(async (): Promise<FlushResult> => {
      const value = latest.current;
      if (value === saved.current) return { ok: true };
      setSaveState({ status: "saving" });
      try {
        const result = await saveFolderNotes(
          folderId,
          value,
          notesUpdatedAt.current,
        );
        if (result.ok) {
          saved.current = value;
          notesUpdatedAt.current = result.notesUpdatedAt;
          setSaveState({ status: "saved" });
          return { ok: true };
        }
        setSaveState({ status: "error", message: result.message });
        return { ok: false, message: result.message };
      } catch {
        const message = "Could not reach the server. Check your connection.";
        setSaveState({ status: "error", message });
        return { ok: false, message };
      }
    });
    queue.current = run.then(() => {});
    return run;
  }, [folderId]);

  useEffect(() => {
    latest.current = notes;
    if (notes === saved.current) return;
    const timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [notes, flush]);

  useEffect(() => onTabHidden(flush), [flush]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (latest.current !== saved.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return { notes, setNotes, saveState, flush };
}

export type FolderNotesState = ReturnType<typeof useFolderNotes>;

export function FolderNotesField({
  state,
  className,
}: {
  state: FolderNotesState;
  className?: string;
}) {
  const { notes, setNotes, saveState } = state;
  return (
    <section className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h3 className="text-sm font-medium">Folder notes</h3>
        {/* Not role="status": the editor already has one for the chapter, and tests rely on it being unique. */}
        <span
          id="folder-notes-status"
          aria-live="polite"
          className={
            saveState.status === "error"
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {saveState.status === "saving" && "Saving…"}
          {saveState.status === "saved" && "Saved"}
          {saveState.status === "error" && saveState.message}
        </span>
      </div>
      <MarkdownEditor
        value={notes}
        onChange={setNotes}
        label="Folder notes"
        placeholder="Notes for this folder…"
        className="flex-1"
        compact
      />
    </section>
  );
}
