"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  LinkIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import {
  MarkdownEditor,
  type MarkdownEditorApi,
} from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { AUTOSAVE_DELAY_MS, onTabHidden } from "@/lib/autosave";
import { flushScrollSave } from "@/lib/editor/scroll-memory";
import { SIDE_PANELS, type SidePanel } from "@/lib/editor-layout";
import type { EditorFolder } from "@/lib/folders/queries";
import {
  countCharacters,
  countWords,
  readAloudMinutes,
} from "@/lib/stories/count";
import type { MobileView, UserSettings } from "@/lib/settings/settings";
import type { EditorStory } from "@/lib/stories/queries";
import {
  FolderNotesField,
  useFolderNotes,
} from "../../books/[id]/folder-notes";
import { DEFAULT_FOLDER_LANGUAGE } from "@/lib/languages";
import type { StoredProofreading } from "@/lib/proofreading/stored";
import { saveStory, setChapterPublished } from "../actions";
import { ChaptersPanel } from "./chapters-panel";
import { EditorMenu } from "./editor-menu";
import { AdultBadge } from "@/components/adult";
import {
  flushLayoutSave,
  setMobileView,
  updateEditorLayout,
  useEditorSettings,
  useIsDesktop,
} from "./layout-store";
import { type EditorTool, EditorToolContext } from "./tool-context";
import type { Tool } from "./tools";
import { ToolDialog, ToolsPanel } from "./tools-panel";
import { lengthError, MAX_CONTENT_LENGTH, MAX_NAME_LENGTH } from "@/lib/limits";

// proofreading: the chapter's open proofreading as JSON (task 55), "" when there is none.
type Values = {
  title: string;
  content: string;
  notes: string;
  proofreading: string;
};

const MOBILE_VIEWS: MobileView[] = ["story", "notes", "chapters", "tools"];

type SaveState =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; message: string };

function isSame(a: Values, b: Values) {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.notes === b.notes &&
    a.proofreading === b.proofreading
  );
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
  settings: UserSettings["editor"];
}) {
  const router = useRouter();
  const t = useTranslations("editor");
  const tErrors = useTranslations("errors");
  const tSave = useTranslations("save");
  const tFolders = useTranslations("folders");
  const lang = folder?.language ?? DEFAULT_FOLDER_LANGUAGE;
  const [title, setTitle] = useState(story.title);
  const [content, setContent] = useState(story.content);
  const [notes, setNotes] = useState(story.notes);
  const initial: Values = {
    title: story.title,
    content: story.content,
    notes: story.notes,
    proofreading: story.proofreading ? JSON.stringify(story.proofreading) : "",
  };
  const [proofreading, setProofreading] = useState(initial.proofreading);
  const { layout, mobileView } = useEditorSettings(userId, settings);
  const isDesktop = useIsDesktop();
  // Without a folder the hook still runs (hooks cannot be conditional) but never saves.
  const folderNotes = useFolderNotes(
    folder?.id ?? "",
    folder?.notes ?? "",
    folder?.notesUpdatedAt ?? "",
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [publicPath, setPublicPath] = useState(story.publicPath);
  const [copied, setCopied] = useState(false);
  // Here, not in ToolsPanel: the dialog must outlive the desktop and mobile trees.
  const [openTool, setOpenTool] = useState<Tool | null>(null);
  // Empty during SSR, so the absolute link is only rendered after hydration.
  const origin = useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
  const publicUrl = publicPath && origin + publicPath;
  const latest = useRef<Values>(initial);
  const saved = useRef<Values>(initial);
  const updatedAt = useRef(story.updatedAt);
  const queue = useRef(Promise.resolve());
  const contentApi = useRef<MarkdownEditorApi | null>(null);
  // Set when a check placed proposals: the editor takes the focus once the dialog has closed.
  const showProofreading = useRef(false);
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
        // Not sent at all: the text stays in the editor until the user shortens it.
        const tooLong =
          lengthError("title", values.title.trim()) ??
          lengthError("content", values.content) ??
          lengthError("notes", values.notes);
        if (tooLong) {
          setSaveState({
            status: "error",
            message: tErrors(tooLong.key, tooLong.values),
          });
          return false;
        }
        setSaveState({ status: "saving" });
        try {
          const result = await saveStory(
            story.id,
            values.title,
            values.content,
            values.notes,
            updatedAt.current,
            values.proofreading ? JSON.parse(values.proofreading) : null,
          );
          if (result.ok) {
            saved.current = values;
            updatedAt.current = result.updatedAt;
            setSaveState({ status: "saved" });
            return true;
          }
          setSaveState({ status: "error", message: result.message });
        } catch {
          setSaveState({ status: "error", message: tErrors("offline") });
        }
        return false;
      });
      queue.current = run.then(() => {});
      return run;
    },
    [story.id, tErrors],
  );

  async function saveForExport(): Promise<boolean> {
    if (!latest.current.title.trim()) {
      setSaveState({ status: "error", message: tErrors("titleRequired") });
      return false;
    }
    return Boolean(await save(true));
  }

  async function beforeLeave(): Promise<string | null> {
    if (!latest.current.title.trim()) {
      const message = tErrors("titleRequired");
      setSaveState({ status: "error", message });
      return message;
    }
    const [storySaved, notesSaved] = await Promise.all([
      save(),
      folderNotes.flush(),
    ]);
    if (!notesSaved.ok) {
      const message = t("notSavedNotes", { message: notesSaved.message });
      setSaveState({ status: "error", message });
      return message;
    }
    // save() has already put its error into the status.
    return storySaved ? null : t("notSavedChapter");
  }

  const editorTool: EditorTool = {
    storyId: story.id,
    lang,
    proofreading: proofreading !== "",
    // Saves before the check (task 23); the open dialog then blocks editing.
    async prepare() {
      if (!latest.current.title.trim()) {
        const message = tErrors("titleRequired");
        setSaveState({ status: "error", message });
        return message;
      }
      const [storySaved] = await Promise.all([save(), folderNotes.flush()]);
      return storySaved ? null : t("notSavedBeforeCheck");
    },
    content: () => latest.current.content,
    startProofreading(markdown, issues) {
      const placed =
        contentApi.current?.startProofreading(markdown, issues) ?? 0;
      if (placed > 0) {
        showProofreading.current = true;
        setOpenTool(null);
      }
      return placed;
    },
  };

  // The modal dialog keeps the focus until it has closed.
  function focusProofreading(event: Event) {
    if (!showProofreading.current) return;
    showProofreading.current = false;
    event.preventDefault();
    // A field under visibility: hidden cannot take focus.
    if (!isDesktop) flushSync(() => setMobileView("story"));
    contentApi.current?.showProofreading();
  }

  async function togglePublished() {
    const result = await setChapterPublished(story.id, !publicPath);
    if (result.ok) {
      setPublicPath(result.publicPath);
      setCopied(false);
    }
    return result;
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    latest.current = { title, content, notes, proofreading };
    if (!title.trim() || isSame(latest.current, saved.current)) return;
    const timer = setTimeout(() => save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [title, content, notes, proofreading, save]);

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

  useEffect(() => onTabHidden(flushScrollSave), []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isSame(latest.current, saved.current)) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const sideOpen = !layout.collapsed[layout.tab];
  const sideName = t(`panelNames.${layout.tab}`);

  function setCollapsed(panel: SidePanel, collapsed: boolean) {
    updateEditorLayout((current) => ({
      ...current,
      collapsed: { ...current.collapsed, [panel]: collapsed },
    }));
  }

  // Set at once, so a save right after a change includes it. The content and the
  // proofreading come from one transaction of the editor and are saved together.
  function changeContent(value: string) {
    latest.current = { ...latest.current, content: value };
    setContent(value);
  }

  function changeProofreading(value: StoredProofreading | null) {
    const json = value ? JSON.stringify(value) : "";
    latest.current = { ...latest.current, proofreading: json };
    setProofreading(json);
  }

  const storyEditor = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <MarkdownEditor
        value={content}
        onChange={changeContent}
        label={t("content")}
        placeholder={t("contentPlaceholder")}
        lang={lang}
        className="flex-1"
        scrollMemory={{ storyId: story.id, field: "content" }}
        apiRef={contentApi}
        proofreading={{
          initial: story.proofreading ?? null,
          onChange: changeProofreading,
        }}
      />
      <p className="text-muted-foreground border-t px-4 py-2 text-xs md:px-6">
        {t("stats", {
          words,
          characters: countCharacters(content),
          minutes: readAloudMinutes(words),
        })}
        {content.length > MAX_CONTENT_LENGTH && (
          <span className="text-destructive block">
            {tErrors("contentTooLong", { max: MAX_CONTENT_LENGTH })}
          </span>
        )}
      </p>
    </div>
  );

  const chapterNotes = (className: string) => (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <h3 className="border-b px-4 py-2 text-sm font-medium">{t("notes")}</h3>
      <MarkdownEditor
        value={notes}
        onChange={setNotes}
        label={t("notes")}
        placeholder={t("notesPlaceholder")}
        lang={lang}
        className="flex-1"
        compact
        scrollMemory={{ storyId: story.id, field: "notes" }}
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
        <FolderNotesField
          state={folderNotes}
          lang={lang}
          className="h-full"
          scrollMemory={{ storyId: story.id, field: "folderNotes" }}
        />
      </ResizablePanel>
      <ResizableHandle withHandle aria-label={t("resizeFolderNotes")} />
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

  const sidePanels: Record<SidePanel, React.ReactNode> = {
    notes: desktopNotes,
    chapters: chaptersPanel,
    tools: <ToolsPanel onOpen={setOpenTool} />,
  };

  return (
    // Below md the app's top bar takes 2.5rem.
    <div className="flex h-[calc(100dvh-2.5rem)] flex-col md:h-dvh">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 md:flex-nowrap md:gap-3 md:px-9">
        {story.folderName !== null && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/books/${story.folderId}`}
              className="max-w-48"
              title={t("backTo", { folder: story.folderName })}
            >
              <ArrowLeftIcon />
              <span className="truncate">{story.folderName}</span>
            </Link>
          </Button>
        )}
        <Input
          value={title}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={t("title")}
          placeholder={t("title")}
          lang={lang}
          spellCheck
          className="h-9 w-full text-lg font-semibold md:w-auto md:flex-1 md:text-lg"
        />
        {story.adult.adult && <AdultBadge />}
        <span
          role="status"
          className={
            saveState.status === "error"
              ? "text-destructive mr-auto max-w-md text-sm md:mr-0"
              : "text-muted-foreground mr-auto text-sm md:mr-0"
          }
        >
          {saveState.status === "saving" && tSave("saving")}
          {saveState.status === "saved" && tSave("saved")}
          {saveState.status === "error" && saveState.message}
        </span>
        <EditorMenu
          id={story.id}
          title={title}
          isPublic={Boolean(publicPath)}
          adult={story.adult}
          commentsDisabled={story.commentsDisabled}
          beforeExport={saveForExport}
          togglePublished={togglePublished}
          onDeleted={() =>
            router.push(
              story.folderName === null
                ? "/books"
                : `/books/${story.folderId}`,
            )
          }
        />
      </div>
      {publicUrl && (
        <div className="flex items-center gap-2 border-b px-4 py-2 text-sm md:px-6">
          <LinkIcon className="text-muted-foreground size-4 shrink-0" />
          <span className="text-muted-foreground hidden md:inline">
            {t("isPublic")}
          </span>
          <Input
            readOnly
            value={publicUrl}
            aria-label={tFolders("publicLink")}
            onFocus={(event) => event.target.select()}
            className="h-8 max-w-xl min-w-0"
          />
          <WithTooltip
            label={copied ? tFolders("copied") : tFolders("copyLink")}
            className="md:hidden"
          >
            <Button variant="outline" size="sm" onClick={copyPublicUrl}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span className="sr-only md:not-sr-only">
                {copied ? tFolders("copied") : tFolders("copyLink")}
              </span>
            </Button>
          </WithTooltip>
        </div>
      )}
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <ResizablePanelGroup
            // defaultLayout is read on mount only: remount when the side panel is shown or hidden.
            // Not for another tab, though: that would remount the story editor and lose its scroll.
            key={sideOpen ? "side" : "story"}
            id="editor-columns"
            defaultLayout={sideOpen ? (layout.widths ?? undefined) : undefined}
            onLayoutChanged={(_, meta) => {
              const sizes = meta.requestedLayout;
              if (!meta.isUserInteraction || !sizes) return;
              updateEditorLayout((current) => ({ ...current, widths: sizes }));
            }}
            className="min-w-0 flex-1"
          >
            <ResizablePanel
              id="story-column"
              minSize="30%"
              defaultSize={sideOpen ? "70%" : "100%"}
            >
              <div className="flex h-full">{storyEditor}</div>
            </ResizablePanel>
            {sideOpen && (
              <>
                <ResizableHandle
                  withHandle
                  aria-label={t("resizeColumn", { panel: sideName })}
                />
                <ResizablePanel
                  // Not a bare name: the library also sets it as the DOM id, which labels point to.
                  id="side-column"
                  minSize="15%"
                  defaultSize="30%"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-center gap-1 border-b px-2 py-1">
                      <div
                        role="tablist"
                        aria-label={t("sidePanel")}
                        className="bg-muted text-muted-foreground mr-auto grid min-w-0 grid-cols-3 gap-1 rounded-lg p-1"
                      >
                        {SIDE_PANELS.map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={layout.tab === tab}
                            onClick={() =>
                              updateEditorLayout((current) => ({
                                ...current,
                                tab,
                              }))
                            }
                            className="aria-selected:bg-background aria-selected:text-foreground truncate rounded-md px-2 py-1 text-sm font-medium aria-selected:shadow-sm"
                          >
                            {t(`views.${tab}`)}
                          </button>
                        ))}
                      </div>
                      <WithTooltip label={t("hide", { panel: sideName })}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("hide", { panel: sideName })}
                          onClick={() => setCollapsed(layout.tab, true)}
                        >
                          <PanelRightCloseIcon />
                        </Button>
                      </WithTooltip>
                    </div>
                    <div className="relative min-h-0 flex-1">
                      {SIDE_PANELS.map((side) => (
                        <KeptView key={side} active={layout.tab === side}>
                          {sidePanels[side]}
                        </KeptView>
                      ))}
                    </div>
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
          {!sideOpen && (
            <div className="flex flex-col gap-1 border-l p-1">
              <WithTooltip label={t("show", { panel: sideName })} side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("show", { panel: sideName })}
                  onClick={() => setCollapsed(layout.tab, false)}
                >
                  <PanelRightOpenIcon />
                </Button>
              </WithTooltip>
            </div>
          )}
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={t("view")}
            className="bg-muted text-muted-foreground mx-4 mt-3 grid grid-cols-4 gap-1 rounded-lg p-1"
          >
            {MOBILE_VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={mobileView === view}
                onClick={() => setMobileView(view)}
                className="aria-selected:bg-background aria-selected:text-foreground rounded-md px-2 py-1.5 text-sm font-medium aria-selected:shadow-sm"
              >
                {t(`views.${view}`)}
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1">
            <KeptView active={mobileView === "story"}>{storyEditor}</KeptView>
            <KeptView
              active={mobileView === "notes"}
              className="overflow-y-auto"
            >
              {folder && (
                <FolderNotesField
                  state={folderNotes}
                  lang={lang}
                  className="min-h-64 border-b"
                  scrollMemory={{ storyId: story.id, field: "folderNotes" }}
                />
              )}
              {chapterNotes("min-h-64 flex-1")}
            </KeptView>
            <KeptView active={mobileView === "chapters"}>
              {chaptersPanel}
            </KeptView>
            <KeptView active={mobileView === "tools"}>
              {sidePanels.tools}
            </KeptView>
          </div>
        </>
      )}
      <EditorToolContext value={editorTool}>
        <ToolDialog
          tool={openTool}
          onClose={() => setOpenTool(null)}
          onCloseAutoFocus={focusProofreading}
        />
      </EditorToolContext>
    </div>
  );
}

// Views behind tabs stay mounted, so they keep their scroll position, mode and undo history.
// Hidden with visibility, not display: none, which may reset the scroll offset.
function KeptView({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col",
        !active && "invisible",
        className,
      )}
    >
      {children}
    </div>
  );
}
