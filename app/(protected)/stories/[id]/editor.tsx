"use client";

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  LinkIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Share2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countCharacters,
  countWords,
  formatReadAloudTime,
} from "@/lib/stories/count";
import type { EditorStory } from "@/lib/stories/queries";
import { saveStory, setSharing } from "../actions";
import { DeleteStoryButton } from "../delete-story-button";

const AUTOSAVE_DELAY_MS = 3000;

type Values = { title: string; content: string; notes: string };

// Below the md breakpoint only one panel is shown at a time.
type MobileView = "editor" | "preview" | "notes";

const MOBILE_VIEWS: { value: MobileView; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "preview", label: "Preview" },
  { value: "notes", label: "Notes" },
];

type SaveState =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; message: string };

function isSame(a: Values, b: Values) {
  return a.title === b.title && a.content === b.content && a.notes === b.notes;
}

const subscribeNever = () => () => {};

export function Editor({ story }: { story: EditorStory }) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [content, setContent] = useState(story.content);
  const [notes, setNotes] = useState(story.notes);
  const [notesOpen, setNotesOpen] = useState(true);
  const [mobileView, setMobileView] = useState<MobileView>("editor");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [sharePath, setSharePath] = useState(
    story.shareToken ? `/s/${story.shareToken}` : null,
  );
  const [sharingPending, setSharingPending] = useState(false);
  const [copied, setCopied] = useState(false);
  // Empty during SSR, so the absolute link is only rendered after hydration.
  const origin = useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
  const shareUrl = sharePath && origin + sharePath;
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

  async function toggleSharing() {
    setSharingPending(true);
    try {
      const result = await setSharing(story.id, !sharePath);
      if (result.ok) {
        setSharePath(result.sharePath);
        setCopied(false);
      } else {
        setSaveState({ status: "error", message: result.message });
      }
    } catch {
      setSaveState({
        status: "error",
        message: "Could not reach the server. Check your connection.",
      });
    }
    setSharingPending(false);
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:flex-nowrap md:gap-3 md:px-6">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Title"
          placeholder="Title"
          className="h-9 w-full text-lg font-semibold md:w-auto md:flex-1 md:text-lg"
        />
        <span
          role="status"
          className={
            saveState.status === "error"
              ? "text-destructive mr-auto max-w-md text-sm md:mr-0"
              : "text-muted-foreground mr-auto text-sm md:mr-0"
          }
        >
          {saveState.status === "saving" && "Saving…"}
          {saveState.status === "saved" && "Saved"}
          {saveState.status === "error" && saveState.message}
        </span>
        <Button variant="outline" onClick={exportStory}>
          <DownloadIcon />
          <span className="sr-only md:not-sr-only">Export .md</span>
        </Button>
        <Button
          variant="outline"
          onClick={toggleSharing}
          disabled={sharingPending}
        >
          <Share2Icon />
          <span className="sr-only md:not-sr-only">
            {sharePath ? "Stop sharing" : "Share"}
          </span>
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
          className="hidden md:inline-flex"
          onClick={() => setNotesOpen((open) => !open)}
        >
          {notesOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </Button>
      </div>
      {shareUrl && (
        <div className="flex items-center gap-2 border-b px-4 py-2 text-sm md:px-6">
          <LinkIcon className="text-muted-foreground size-4 shrink-0" />
          <span className="text-muted-foreground hidden md:inline">
            Anyone with this link can read the story:
          </span>
          <Input
            readOnly
            value={shareUrl}
            aria-label="Share link"
            onFocus={(event) => event.target.select()}
            className="h-8 max-w-xl min-w-0"
          />
          <Button variant="outline" size="sm" onClick={copyShareUrl}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span className="sr-only md:not-sr-only">
              {copied ? "Copied" : "Copy link"}
            </span>
          </Button>
        </div>
      )}
      <div
        role="tablist"
        aria-label="View"
        className="bg-muted text-muted-foreground mx-4 mt-3 grid grid-cols-3 gap-1 rounded-lg p-1 md:hidden"
      >
        {MOBILE_VIEWS.map((view) => (
          <button
            key={view.value}
            type="button"
            role="tab"
            aria-selected={mobileView === view.value}
            onClick={() => setMobileView(view.value)}
            className="aria-selected:bg-background aria-selected:text-foreground rounded-md px-3 py-1.5 text-sm font-medium aria-selected:shadow-sm"
          >
            {view.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className={`${mobileView === "editor" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex md:border-r`}
        >
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            aria-label="Content"
            placeholder="Write your story in markdown…"
            className="min-h-0 flex-1 resize-none bg-transparent px-4 py-4 font-mono text-base leading-relaxed outline-none md:px-6 md:text-sm"
          />
          <p className="text-muted-foreground border-t px-4 py-2 text-xs md:px-6">
            {words} words · {countCharacters(content)} characters ·{" "}
            {formatReadAloudTime(words)} read aloud
          </p>
        </div>
        <section
          aria-label="Preview"
          className={`${mobileView === "preview" ? "block" : "hidden"} min-w-0 flex-1 overflow-y-auto px-4 py-4 md:block md:px-6`}
        >
          <MarkdownPreview content={content} />
        </section>
        <aside
          id="notes-panel"
          className={`${mobileView === "notes" ? "flex" : "hidden"} ${notesOpen ? "md:flex" : "md:hidden"} w-full shrink-0 flex-col md:w-80 md:border-l`}
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
            className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-base outline-none md:text-sm"
          />
        </aside>
      </div>
    </div>
  );
}
