"use client";

import { ExportDialog } from "@/components/export-dialog";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Columns3Icon,
  CopyIcon,
  GlobeIcon,
  LinkIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
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
import { flushScrollSave } from "@/lib/editor/scroll-memory";
import {
  collapsedColumns,
  moveColumn,
  SIDE_PANELS,
  type SidePanel,
  visibleColumns,
  widthsKey,
} from "@/lib/editor-layout";
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
} from "../../folders/[id]/folder-notes";
import { saveStory, setChapterPublished } from "../actions";
import { DeleteStoryButton } from "../delete-story-button";
import { ChaptersPanel } from "./chapters-panel";
import {
  flushLayoutSave,
  setMobileView,
  updateEditorLayout,
  useEditorSettings,
  useIsDesktop,
} from "./layout-store";
import type { Tool } from "./tools";
import { ToolDialog, ToolsPanel } from "./tools-panel";

type Values = { title: string; content: string; notes: string };

const MOBILE_VIEWS: MobileView[] = ["story", "notes", "chapters", "tools"];

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
  settings: UserSettings["editor"];
}) {
  const router = useRouter();
  const t = useTranslations("editor");
  const tErrors = useTranslations("errors");
  const tSave = useTranslations("save");
  const tFolders = useTranslations("folders");
  const [title, setTitle] = useState(story.title);
  const [content, setContent] = useState(story.content);
  const [notes, setNotes] = useState(story.notes);
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
  const [publishPending, setPublishPending] = useState(false);
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

  async function togglePublished() {
    setPublishPending(true);
    try {
      const result = await setChapterPublished(story.id, !publicPath);
      if (result.ok) {
        setPublicPath(result.publicPath);
        setCopied(false);
      } else {
        setSaveState({ status: "error", message: result.message });
      }
    } catch {
      setSaveState({ status: "error", message: tErrors("offline") });
    }
    setPublishPending(false);
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
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

  useEffect(() => onTabHidden(flushScrollSave), []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isSame(latest.current, saved.current)) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const columns = visibleColumns(layout);
  const hiddenColumns = collapsedColumns(layout);
  const columnKey = widthsKey(layout);
  const sideSize = columns.length === 3 ? 20 : columns.length === 2 ? 25 : 30;

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
        label={t("content")}
        placeholder={t("contentPlaceholder")}
        className="flex-1"
        scrollMemory={{ storyId: story.id, field: "content" }}
      />
      <p className="text-muted-foreground border-t px-4 py-2 text-xs md:px-6">
        {t("stats", {
          words,
          characters: countCharacters(content),
          minutes: readAloudMinutes(words),
        })}
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

  function sideHeader(panel: SidePanel, index: number) {
    const label = t(`views.${panel}`);
    const name = t(`panelNames.${panel}`);
    return (
      <div className="flex items-center gap-1 border-b px-2 py-1">
        {layout.split ? (
          <>
            <h2 className="mr-auto px-2 text-sm font-medium">{label}</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("moveLeft", { panel: name })}
              title={t("moveLeftShort")}
              disabled={index === 0}
              onClick={() =>
                updateEditorLayout((current) => ({
                  ...current,
                  order: moveColumn(
                    current.order,
                    panel,
                    "left",
                    current.collapsed,
                  ),
                }))
              }
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("moveRight", { panel: name })}
              title={t("moveRightShort")}
              disabled={index === columns.length - 1}
              onClick={() =>
                updateEditorLayout((current) => ({
                  ...current,
                  order: moveColumn(
                    current.order,
                    panel,
                    "right",
                    current.collapsed,
                  ),
                }))
              }
            >
              <ArrowRightIcon />
            </Button>
          </>
        ) : (
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
                  updateEditorLayout((current) => ({ ...current, tab }))
                }
                className="aria-selected:bg-background aria-selected:text-foreground truncate rounded-md px-2 py-1 text-sm font-medium aria-selected:shadow-sm"
              >
                {t(`views.${tab}`)}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("hide", { panel: name })}
          title={t("hide", { panel: name })}
          onClick={() => setCollapsed(panel, true)}
        >
          <PanelRightCloseIcon />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-9 py-3 md:flex-nowrap md:gap-3">
        {story.folderName !== null && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/folders/${story.folderId}`}
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
          onChange={(event) => setTitle(event.target.value)}
          aria-label={t("title")}
          placeholder={t("title")}
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
          {saveState.status === "saving" && tSave("saving")}
          {saveState.status === "saved" && tSave("saved")}
          {saveState.status === "error" && saveState.message}
        </span>
        <ExportDialog
          dataUrl={`/stories/${story.id}/export/data`}
          fallbackName="story"
          beforeExport={saveForExport}
        />
        <Button
          variant="outline"
          onClick={togglePublished}
          disabled={publishPending}
        >
          <GlobeIcon />
          <span className="sr-only md:not-sr-only">
            {publicPath ? tFolders("unpublish") : tFolders("publish")}
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
          {t("split")}
        </Button>
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
          <Button variant="outline" size="sm" onClick={copyPublicUrl}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span className="sr-only md:not-sr-only">
              {copied ? tFolders("copied") : tFolders("copyLink")}
            </span>
          </Button>
        </div>
      )}
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <ResizablePanelGroup
            // defaultLayout is read on mount only: remount whenever the set of columns changes.
            // Not for another tab, though: that would remount the story editor and lose its scroll.
            // Tabs share one panel id and one width.
            key={layout.split ? columnKey : columns.length}
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
              <Fragment key={layout.split ? panel : "side"}>
                <ResizableHandle
                  withHandle
                  aria-label={t("resizeColumn", {
                    panel: t(`panelNames.${panel}`),
                  })}
                />
                <ResizablePanel
                  // Not the bare panel name: the library also sets it as the DOM id, which labels point to.
                  id={layout.split ? `${panel}-column` : "side-column"}
                  minSize="15%"
                  defaultSize={`${sideSize}%`}
                >
                  <div className="flex h-full flex-col">
                    {sideHeader(panel, index)}
                    {layout.split ? (
                      sidePanels[panel]
                    ) : (
                      <div className="relative min-h-0 flex-1">
                        {SIDE_PANELS.map((side) => (
                          <KeptView key={side} active={panel === side}>
                            {sidePanels[side]}
                          </KeptView>
                        ))}
                      </div>
                    )}
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
                  aria-label={t("show", { panel: t(`panelNames.${panel}`) })}
                  title={t("show", { panel: t(`panelNames.${panel}`) })}
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
      <ToolDialog tool={openTool} onClose={() => setOpenTool(null)} />
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
