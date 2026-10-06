"use client";

import {
  DownloadIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Share2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countCharacters,
  countWords,
  formatReadAloudTime,
} from "@/lib/stories/count";
import type { EditorStory } from "@/lib/stories/queries";
import { saveStory } from "../actions";
import { DeleteStoryButton } from "../delete-story-button";

const AUTOSAVE_DELAY_MS = 3000;

type Values = { title: string; content: string; notes: string };

type SaveState =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; message: string };

function isSame(a: Values, b: Values) {
  return a.title === b.title && a.content === b.content && a.notes === b.notes;
}

export function Editor({ story }: { story: EditorStory }) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [content, setContent] = useState(story.content);
  const [notes, setNotes] = useState(story.notes);
  const [notesOpen, setNotesOpen] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const latest = useRef<Values>(story);
  const saved = useRef<Values>(story);
  const updatedAt = useRef(story.updatedAt);
  const queue = useRef(Promise.resolve());
  const words = countWords(content);

  // Saves run one at a time, so each one sends the updatedAt returned by the previous one.
  // Resolves to true when the editor state is saved. `force` saves unchanged
  // values too, so export still detects a conflict with another tab.
  const save = useCallback(
    (force = false) => {
      const run = queue.current.then(async () => {
        const values = latest.current;
        if (!values.title.trim()) return false;
        if (!force && isSame(values, saved.current)) return true;
        setSaveState({ status: "saving" });
        try {
          const result = await saveStory(
            story.id,
            values.title,
            values.content,
            values.notes,
            updatedAt.current,
          );
          if (result.ok) {
            saved.current = values;
            updatedAt.current = result.updatedAt;
            setSaveState({ status: "saved" });
            return true;
          }
          setSaveState({ status: "error", message: result.message });
        } catch {
          setSaveState({
            status: "error",
            message: "Could not reach the server. Check your connection.",
          });
        }
        return false;
      });
      queue.current = run.then(() => {});
      return run;
    },
    [story.id],
  );

  async function exportStory() {
    if (!latest.current.title.trim()) {
      setSaveState({ status: "error", message: "Title is required." });
      return;
    }
    if (!(await save(true))) return;
    const link = document.createElement("a");
    link.href = `/stories/${story.id}/export`;
    link.download = "";
    link.click();
  }

  useEffect(() => {
    latest.current = { title, content, notes };
    if (!title.trim() || isSame(latest.current, saved.current)) return;
    const timer = setTimeout(() => save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [title, content, notes, save]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isSame(latest.current, saved.current)) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <div className="flex h-[calc(100dvh-3.5rem-1px)] flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Title"
          placeholder="Title"
          className="h-9 flex-1 text-lg font-semibold md:text-lg"
        />
        <span
          role="status"
          className={
            saveState.status === "error"
              ? "text-destructive max-w-md text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {saveState.status === "saving" && "Saving…"}
          {saveState.status === "saved" && "Saved"}
          {saveState.status === "error" && saveState.message}
        </span>
        <Button variant="outline" onClick={exportStory}>
          <DownloadIcon />
          Export .md
        </Button>
        <Button variant="outline" disabled>
          <Share2Icon />
          Share
        </Button>
        <DeleteStoryButton
          id={story.id}
          title={title}
          onDeleted={() => router.push("/stories")}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={notesOpen ? "Hide notes" : "Show notes"}
          aria-expanded={notesOpen}
          aria-controls="notes-panel"
          onClick={() => setNotesOpen((open) => !open)}
        >
          {notesOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col border-r">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            aria-label="Content"
            placeholder="Write your story in markdown…"
            className="min-h-0 flex-1 resize-none bg-transparent px-6 py-4 font-mono text-sm leading-relaxed outline-none"
          />
          <p className="text-muted-foreground border-t px-6 py-2 text-xs">
            {words} words · {countCharacters(content)} characters ·{" "}
            {formatReadAloudTime(words)} read aloud
          </p>
        </div>
        <section
          aria-label="Preview"
          className="min-w-0 flex-1 overflow-y-auto px-6 py-4"
        >
          <MarkdownPreview content={content} />
        </section>
        {notesOpen && (
          <aside
            id="notes-panel"
            className="flex w-80 shrink-0 flex-col border-l"
          >
            <label
              htmlFor="notes"
              className="border-b px-4 py-2 text-sm font-medium"
            >
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes for this story…"
              className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
            />
          </aside>
        )}
      </div>
    </div>
  );
}
