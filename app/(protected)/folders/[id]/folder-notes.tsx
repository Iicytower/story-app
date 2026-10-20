"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveFolderNotes } from "../actions";

const AUTOSAVE_DELAY_MS = 3000;

type SaveState =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; message: string };

export function FolderNotes({
  folderId,
  initialNotes,
  initialNotesUpdatedAt,
}: {
  folderId: string;
  initialNotes: string;
  initialNotesUpdatedAt: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const latest = useRef(initialNotes);
  const saved = useRef(initialNotes);
  const notesUpdatedAt = useRef(initialNotesUpdatedAt);
  const queue = useRef(Promise.resolve());

  // Saves run one at a time, so each one sends the notesUpdatedAt returned by the previous one.
  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const value = latest.current;
      if (value === saved.current) return;
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
        } else {
          setSaveState({ status: "error", message: result.message });
        }
      } catch {
        setSaveState({
          status: "error",
          message: "Could not reach the server. Check your connection.",
        });
      }
    });
  }, [folderId]);

  useEffect(() => {
    latest.current = notes;
    if (notes === saved.current) return;
    const timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [notes, save]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (latest.current !== saved.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <section className="flex flex-col rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <label htmlFor="folder-notes" className="text-sm font-medium">
          Folder notes
        </label>
        <span
          role="status"
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
      <textarea
        id="folder-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes for this folder…"
        className="min-h-64 resize-y bg-transparent px-4 py-3 text-base outline-none md:text-sm"
      />
    </section>
  );
}
