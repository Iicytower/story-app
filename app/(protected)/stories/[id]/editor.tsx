"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Columns3Icon,
  CopyIcon,
  DownloadIcon,
  LinkIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Share2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { AUTOSAVE_DELAY_MS, onTabHidden } from "@/lib/autosave";
import {
  collapsedColumns,
  columnsKey,
  moveColumn,
  type SidePanel,
  visibleColumns,
} from "@/lib/editor-layout";
import type { EditorFolder } from "@/lib/folders/queries";
import {
  countCharacters,
  countWords,
  formatReadAloudTime,
} from "@/lib/stories/count";
import type { MobileView, UserSettings } from "@/lib/settings/settings";
import type { EditorStory } from "@/lib/stories/queries";
import {
  FolderNotesField,
  useFolderNotes,
} from "../../folders/[id]/folder-notes";
import { saveStory, setSharing } from "../actions";
import { DeleteStoryButton } from "../delete-story-button";
import { ChaptersPanel } from "./chapters-panel";
import {
  flushLayoutSave,
  setMobileView,
  updateEditorLayout,
  useEditorSettings,
  useIsDesktop,
} from "./layout-store";

type Values = { title: string; content: string; notes: string };

const MOBILE_VIEWS: { value: MobileView; label: string }[] = [
  { value: "story", label: "Story" },
  { value: "notes", label: "Notes" },
  { value: "chapters", label: "Chapters" },
];

const PANEL_LABELS: Record<SidePanel, string> = {
  notes: "Notes",
  chapters: "Chapters",
};

type SaveState =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; message: string };

function isSame(a: Values, b: Values) {
  return a.title === b.title && a.content === b.content && a.notes === b.notes;
}

const subscribeNever = () => () => {};

export function Editor({
  story,
  folder,
  userId,
  settings,
}: {
  story: EditorStory;
  folder: EditorFolder | null;
  userId: string;
  settings: Pick<UserSettings, "editorLayout" | "mobileView">;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [content, setContent] = useState(story.content);
  const [notes, setNotes] = useState(story.notes);
  const { editorLayout: layout, mobileView } = useEditorSettings(
    userId,
    settings,
  );
  const isDesktop = useIsDesktop();
  // Without a folder the hook still runs (hooks cannot be conditional) but never saves.
  const folderNotes = useFolderNotes(
    folder?.id ?? "",
    folder?.notes ?? "",
    folder?.notesUpdatedAt ?? "",
  );
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

  async function beforeLeave(): Promise<string | null> {
    if (!latest.current.title.trim()) {
      const message = "Title is required.";
      setSaveState({ status: "error", message });
      return message;
    }
    const [storySaved, notesSaved] = await Promise.all([
      save(),
      folderNotes.flush(),
    ]);
    if (!notesSaved.ok) {
      const message = `Folder notes were not saved: ${notesSaved.message}`;
      setSaveState({ status: "error", message });
      return message;
    }
    // save() has already put its error into the status.
    return storySaved
      ? null
      : "The chapter was not saved. See the message above.";
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

  useEffect(() => onTabHidden(() => save()), [save]);

  useEffect(() => onTabHidden(flushLayoutSave), []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isSame(latest.current, saved.current)) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const columns = visibleColumns(layout);
  const hiddenColumns = collapsedColumns(layout);
  const columnKey = columnsKey(columns);
  const sideSize = columns.length === 2 ? 25 : 30;

  function setCollapsed(panel: SidePanel, collapsed: boolean) {
    updateEditorLayout((current) => ({
      ...current,
      collapsed: { ...current.collapsed, [panel]: collapsed },
    }));
  }

  const storyEditor = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <MarkdownEditor
        value={content}
        onChange={setContent}
        label="Content"
        placeholder="Write your story…"
        className="flex-1"
      />
      <p className="text-muted-foreground border-t px-4 py-2 text-xs md:px-6">
        {words} words · {countCharacters(content)} characters ·{" "}
        {formatReadAloudTime(words)} read aloud
      </p>
    </div>
  );

  const chapterNotes = (className: string) => (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <h3 className="border-b px-4 py-2 text-sm font-medium">Notes</h3>
      <MarkdownEditor
        value={notes}
        onChange={setNotes}
        label="Notes"
        placeholder="Notes for this chapter…"
        className="flex-1"
        compact
      />
    </div>
  );

  const desktopNotes = folder ? (
    <ResizablePanelGroup
      id="editor-notes"
      orientation="vertical"
      defaultLayout={layout.notesHeights ?? undefined}
      onLayoutChanged={(_, meta) => {
        const sizes = meta.requestedLayout;
        if (!meta.isUserInteraction || !sizes) return;
        updateEditorLayout((current) => ({ ...current, notesHeights: sizes }));
      }}
      className="min-h-0 flex-1"
    >
      <ResizablePanel id="folder-notes-panel" minSize="15%" defaultSize="40%">
        <FolderNotesField state={folderNotes} className="h-full" />
      </ResizablePanel>
      <ResizableHandle withHandle aria-label="Resize folder notes" />
      <ResizablePanel id="chapter-notes-panel" minSize="15%" defaultSize="60%">
        {chapterNotes("h-full")}
      </ResizablePanel>
    </ResizablePanelGroup>
  ) : (
    chapterNotes("flex-1")
  );

  const chaptersPanel = (
    <ChaptersPanel
      folder={folder}
      currentId={story.id}
      beforeLeave={beforeLeave}
    />
  );

  function sideHeader(panel: SidePanel, index: number) {
    const label = PANEL_LABELS[panel];
    return (
      <div className="flex items-center gap-1 border-b px-2 py-1">
        {layout.split ? (
          <>
            <h2 className="mr-auto px-2 text-sm font-medium">{label}</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${label.toLowerCase()} left`}
              title="Move left"
              disabled={index === 0}
              onClick={() =>
                updateEditorLayout((current) => ({
                  ...current,
                  order: moveColumn(current.order, panel, "left"),
                }))
              }
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${label.toLowerCase()} right`}
              title="Move right"
              disabled={index === columns.length - 1}
              onClick={() =>
                updateEditorLayout((current) => ({
                  ...current,
                  order: moveColumn(current.order, panel, "right"),
                }))
              }
            >
              <ArrowRightIcon />
            </Button>
          </>
        ) : (
          <div
            role="tablist"
            aria-label="Side panel"
            className="bg-muted text-muted-foreground mr-auto grid grid-cols-2 gap-1 rounded-lg p-1"
          >
            {(["notes", "chapters"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={layout.tab === tab}
                onClick={() =>
                  updateEditorLayout((current) => ({ ...current, tab }))
                }
                className="aria-selected:bg-background aria-selected:text-foreground rounded-md px-3 py-1 text-sm font-medium aria-selected:shadow-sm"
              >
                {PANEL_LABELS[tab]}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Hide ${label.toLowerCase()}`}
          title={`Hide ${label.toLowerCase()}`}
          onClick={() => setCollapsed(panel, true)}
        >
          <PanelRightCloseIcon />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem-1px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:flex-nowrap md:gap-3 md:px-6">
        {story.folderName !== null && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/folders/${story.folderId}`}
              className="max-w-48"
              title={`Back to ${story.folderName}`}
            >
              <ArrowLeftIcon />
              <span className="truncate">{story.folderName}</span>
            </Link>
          </Button>
        )}
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Title"
          placeholder="Title"
          lang="pl"
          spellCheck
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
          onDeleted={() =>
            router.push(
              story.folderName === null
                ? "/stories"
                : `/folders/${story.folderId}`,
            )
          }
        />
        <Button
          variant="outline"
          aria-pressed={layout.split}
          className="hidden md:inline-flex"
          onClick={() =>
            updateEditorLayout((current) => ({
              ...current,
              split: !current.split,
            }))
          }
        >
          <Columns3Icon />
          Split
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
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <ResizablePanelGroup
            // defaultLayout is read on mount only: remount whenever the set of columns changes.
            key={columnKey}
            id="editor-columns"
            defaultLayout={layout.widths[columnKey]}
            onLayoutChanged={(_, meta) => {
              const sizes = meta.requestedLayout;
              if (!meta.isUserInteraction || !sizes) return;
              updateEditorLayout((current) => ({
                ...current,
                widths: { ...current.widths, [columnKey]: sizes },
              }));
            }}
            className="min-w-0 flex-1"
          >
            <ResizablePanel
              id="story-column"
              minSize="30%"
              defaultSize={`${100 - columns.length * sideSize}%`}
            >
              <div className="flex h-full">{storyEditor}</div>
            </ResizablePanel>
            {columns.map((panel, index) => (
              <Fragment key={panel}>
                <ResizableHandle
                  withHandle
                  aria-label={`Resize ${PANEL_LABELS[panel].toLowerCase()} column`}
                />
                <ResizablePanel
                  // Not the bare panel name: the library also sets it as the DOM id, which labels point to.
                  id={`${panel}-column`}
                  minSize="15%"
                  defaultSize={`${sideSize}%`}
                >
                  <div className="flex h-full flex-col">
                    {sideHeader(panel, index)}
                    {panel === "notes" ? desktopNotes : chaptersPanel}
                  </div>
                </ResizablePanel>
              </Fragment>
            ))}
          </ResizablePanelGroup>
          {hiddenColumns.length > 0 && (
            <div className="flex flex-col gap-1 border-l p-1">
              {hiddenColumns.map((panel) => (
                <Button
                  key={panel}
                  variant="ghost"
                  size="icon"
                  aria-label={`Show ${PANEL_LABELS[panel].toLowerCase()}`}
                  title={`Show ${PANEL_LABELS[panel].toLowerCase()}`}
                  onClick={() => setCollapsed(panel, false)}
                >
                  <PanelRightOpenIcon />
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="View"
            className="bg-muted text-muted-foreground mx-4 mt-3 grid grid-cols-3 gap-1 rounded-lg p-1"
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
          {mobileView === "story" && storyEditor}
          {mobileView === "notes" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {folder && (
                <FolderNotesField
                  state={folderNotes}
                  className="min-h-64 border-b"
                />
              )}
              {chapterNotes("min-h-64 flex-1")}
            </div>
          )}
          {mobileView === "chapters" && chaptersPanel}
        </>
      )}
    </div>
  );
}
