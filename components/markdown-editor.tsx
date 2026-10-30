"use client";

import { Extension } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { cn } from "cn";
import {
  BoldIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  contentExtensions,
  isAllowedLink,
  MARKED_OPTIONS,
  trimMarkdown,
} from "@/lib/editor/extensions";
import {
  type Anchor,
  recallScroll,
  rememberScroll,
} from "@/lib/editor/scroll-memory";
import { blockStarts } from "@/lib/editor/source-blocks";

type Mode = "preview" | "source";

// Measuring Source copies the whole text, so the position is read once scrolling pauses.
const SCROLL_READ_DELAY_MS = 200;

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  className,
  compact = false,
  scrollMemory,
}: {
  value: string;
  onChange: (value: string) => void;
  // Accessible name of the text field in both modes, e.g. "Content".
  label: string;
  placeholder?: string;
  className?: string;
  // Smaller text for the notes panels.
  compact?: boolean;
  // Remembers the scroll position under this chapter and field (see scroll-memory).
  scrollMemory?: { storyId: string; field: string };
}) {
  // Always Preview on open; the choice is not remembered.
  const [mode, setMode] = useState<Mode>("preview");
  const [linkOpen, setLinkOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  const openLinkRef = useRef(() => setLinkOpen(true));
  // The markdown the editor last produced or loaded; anything else in `value` came from Source.
  const synced = useRef(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Where the view that is being shown should scroll to, set on switching modes.
  const anchor = useRef<Anchor | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rememberRef = useRef(() => {});

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    // Rendered after hydration only, so the server HTML never disagrees with ProseMirror's.
    immediatelyRender: false,
    extensions: [
      ...contentExtensions,
      Markdown.configure({ markedOptions: MARKED_OPTIONS }),
      Extension.create({
        name: "linkShortcut",
        addKeyboardShortcuts: () => ({
          "Mod-k": () => {
            openLinkRef.current();
            return true;
          },
        }),
      }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        // Stories are Polish; the rest of the UI stays English.
        lang: "pl",
        spellcheck: "true",
        ...(placeholder && { "aria-placeholder": placeholder }),
        class: cn(
          "prose dark:prose-invert max-w-none min-h-full outline-none px-4 py-(--scroll-gap) md:px-6",
          compact && "prose-sm md:px-4",
        ),
      },
    },
    // Fires on edits only: loading the content does not change `value`, so opening never saves.
    onUpdate: ({ editor }) => {
      const markdown = trimMarkdown(editor.getMarkdown());
      synced.current = markdown;
      onChangeRef.current(markdown);
    },
  });

  const storyId = scrollMemory?.storyId;
  const field = scrollMemory?.field;

  useEffect(() => {
    rememberRef.current = () => {
      if (!storyId || !field || !editor) return;
      rememberScroll(
        storyId,
        field,
        mode === "preview"
          ? previewAnchor(editor)
          : textareaRef.current &&
              sourceAnchor(
                textareaRef.current,
                blockStarts(editor.markdown!, value),
              ),
      );
    };
  });

  function handleScroll() {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      rememberRef.current();
    }, SCROLL_READ_DELAY_MS);
  }

  // A layout cleanup still sees the DOM, so a remount (Split, Hide/Show) keeps the latest position.
  useLayoutEffect(
    () => () => {
      if (!scrollTimer.current) return;
      clearTimeout(scrollTimer.current);
      rememberRef.current();
    },
    [],
  );

  // Scrolling stops with the first or last line at the far edge of the view.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const scroller = textarea
      ? sourceScroller(textarea)
      : editor?.view.dom.parentElement;
    if (!scroller || !editor) return;
    return trackScrollGap(
      rootRef.current!,
      scroller,
      textarea ?? editor.view.dom,
    );
  }, [mode, editor]);

  // The editor opens in Preview once it exists (after hydration).
  useLayoutEffect(() => {
    if (!editor || !storyId || !field) return;
    const position = recallScroll(storyId, field);
    if (typeof position === "object" && position)
      scrollPreviewTo(editor, position);
  }, [editor, storyId, field]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "preview" && editor) {
      anchor.current =
        textareaRef.current &&
        sourceAnchor(textareaRef.current, blockStarts(editor.markdown!, value));
      if (value !== synced.current) {
        editor.commands.setContent(value, {
          contentType: "markdown",
          emitUpdate: false,
        });
        synced.current = value;
      }
    } else if (editor) {
      anchor.current = previewAnchor(editor);
    }
    setMode(next);
  }

  // Before paint, so the new view never shows its top first. Edits re-run it with no anchor.
  useLayoutEffect(() => {
    const target = anchor.current;
    anchor.current = null;
    if (!target || !editor) return;
    if (mode === "preview") scrollPreviewTo(editor, target);
    else
      scrollSourceTo(
        textareaRef.current!,
        blockStarts(editor.markdown!, value),
        target,
      );
  }, [mode, editor, value]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`${label} editor`}
      className={cn("flex min-h-0 flex-col", className)}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
        <div
          role="group"
          aria-label="Mode"
          className="bg-muted text-muted-foreground mr-1 flex gap-0.5 rounded-md p-0.5"
        >
          {(["preview", "source"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => switchMode(option)}
              className="aria-pressed:bg-background aria-pressed:text-foreground rounded px-2 py-0.5 text-xs font-medium aria-pressed:shadow-sm"
            >
              {option === "preview" ? "Preview" : "Source"}
            </button>
          ))}
        </div>
        {mode === "preview" && editor && (
          <Toolbar editor={editor} onLink={() => setLinkOpen(true)} />
        )}
      </div>
      {mode === "source" ? (
        // A box cannot be shorter than its padding, so the textarea grows with the text
        // and an outer element scrolls it, the same way as in Preview.
        <div
          onScroll={handleScroll}
          onClick={(event) => {
            if (event.target !== textareaRef.current)
              textareaRef.current?.focus({ preventScroll: true });
          }}
          className="min-h-0 flex-1 cursor-text overflow-y-auto"
        >
          <div className="py-(--scroll-gap)">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-label={label}
              placeholder={placeholder}
              lang="pl"
              spellCheck
              className={cn(
                "block field-sizing-content w-full resize-none overflow-hidden bg-transparent px-4 font-mono text-base leading-relaxed outline-none md:px-6 md:text-sm",
                compact && "md:px-4",
              )}
            />
          </div>
        </div>
      ) : (
        <EditorContent
          editor={editor}
          onScroll={handleScroll}
          className="min-h-0 flex-1 cursor-text overflow-y-auto [&>div]:min-h-full"
        />
      )}
      {editor && (
        <LinkDialog
          editor={editor}
          open={linkOpen}
          onOpenChange={setLinkOpen}
        />
      )}
    </div>
  );
}

function trackScrollGap(
  root: HTMLElement,
  scroller: HTMLElement,
  line: Element,
) {
  const update = () => {
    const gap = Math.max(
      scroller.clientHeight - parseFloat(getComputedStyle(line).lineHeight),
      0,
    );
    const previous = parseFloat(root.style.getPropertyValue("--scroll-gap"));
    root.style.setProperty("--scroll-gap", `${gap}px`);
    if (scroller.scrollTop > 0) scroller.scrollTop += gap - previous;
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(scroller);
  return () => observer.disconnect();
}

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

// Top-level block elements with their index in the document.
function* previewBlocks(editor: Editor) {
  const { doc } = editor.state;
  let pos = 0;
  for (let index = 0; index < doc.childCount; index++) {
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) yield { index, dom };
    pos += doc.child(index).nodeSize;
  }
}

function previewAnchor(editor: Editor): Anchor | null {
  const container = editor.view.dom.parentElement!;
  if (container.scrollTop === 0) return null;
  const top = container.getBoundingClientRect().top;
  for (const { index, dom } of previewBlocks(editor)) {
    const rect = dom.getBoundingClientRect();
    if (rect.bottom > top)
      return { index, fraction: clamp((top - rect.top) / rect.height) };
  }
  return null;
}

function scrollPreviewTo(editor: Editor, { index, fraction }: Anchor) {
  const container = editor.view.dom.parentElement!;
  let target: HTMLElement | null = null;
  // The editor may hold one more block than the source (an empty paragraph after a final comment or list).
  for (const block of previewBlocks(editor)) {
    if (block.index > index) break;
    target = block.dom;
  }
  if (!target) return;
  const rect = target.getBoundingClientRect();
  container.scrollTop +=
    rect.top - container.getBoundingClientRect().top + fraction * rect.height;
}

function sourceScroller(textarea: HTMLTextAreaElement) {
  return textarea.parentElement!.parentElement!;
}

function sourceAnchor(
  textarea: HTMLTextAreaElement,
  starts: number[],
): Anchor | null {
  const scroller = sourceScroller(textarea);
  if (scroller.scrollTop === 0 || starts.length === 0) return null;
  const tops = lineTops(textarea, [...starts, textarea.value.length]);
  const top =
    scroller.getBoundingClientRect().top - textarea.getBoundingClientRect().top;
  let index = 0;
  while (index < starts.length - 1 && tops[index + 1] <= top) index++;
  const height = tops[index + 1] - tops[index];
  return {
    index,
    fraction: height > 0 ? clamp((top - tops[index]) / height) : 0,
  };
}

function scrollSourceTo(
  textarea: HTMLTextAreaElement,
  starts: number[],
  { index, fraction }: Anchor,
) {
  if (starts.length === 0) return;
  const start = starts[Math.min(index, starts.length - 1)];
  const end = starts[index + 1] ?? textarea.value.length;
  const [from, to] = lineTops(textarea, [start, end]);
  const scroller = sourceScroller(textarea);
  scroller.scrollTop +=
    textarea.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    from +
    fraction * (to - from);
}

// Distance from the top of the textarea to the line holding
// each offset, wrapping counted. A textarea cannot measure that, so a hidden copy of it does.
function lineTops(textarea: HTMLTextAreaElement, offsets: number[]): number[] {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const property of [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ] as const)
    mirror.style[property] = style[property];
  Object.assign(mirror.style, {
    position: "absolute",
    top: "0",
    left: "0",
    visibility: "hidden",
    boxSizing: "border-box",
    // clientWidth leaves out the scrollbar, which takes no room from the text in the copy.
    width: `${textarea.clientWidth}px`,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  });
  const text = textarea.value;
  let last = 0;
  const markers = offsets.map((offset) => {
    mirror.append(text.slice(last, offset));
    last = offset;
    return mirror.appendChild(document.createElement("span"));
  });
  mirror.append(text.slice(last));
  document.body.append(mirror);
  const tops = markers.map((marker) => marker.offsetTop);
  mirror.remove();
  return tops;
}

function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  const buttons = [
    {
      label: "Bold",
      icon: BoldIcon,
      active: state.bold,
      run: () => chain().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: ItalicIcon,
      active: state.italic,
      run: () => chain().toggleItalic().run(),
    },
    {
      label: "Heading 1",
      icon: Heading1Icon,
      active: state.h1,
      run: () => chain().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      icon: Heading2Icon,
      active: state.h2,
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      icon: Heading3Icon,
      active: state.h3,
      run: () => chain().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bulleted list",
      icon: ListIcon,
      active: state.bulletList,
      run: () => chain().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrderedIcon,
      active: state.orderedList,
      run: () => chain().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: QuoteIcon,
      active: state.blockquote,
      run: () => chain().toggleBlockquote().run(),
    },
    {
      label: "Horizontal line",
      icon: MinusIcon,
      run: () => chain().setHorizontalRule().run(),
    },
    { label: "Link", icon: LinkIcon, active: state.link, run: onLink },
    {
      label: "Comment",
      icon: MessageSquareIcon,
      run: () => chain().insertComment().run(),
    },
    {
      label: "Undo",
      icon: Undo2Icon,
      disabled: !state.canUndo,
      run: () => chain().undo().run(),
    },
    {
      label: "Redo",
      icon: Redo2Icon,
      disabled: !state.canRedo,
      run: () => chain().redo().run(),
    },
  ];

  return (
    <>
      {buttons.map(({ label, icon: Icon, active, disabled, run }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          title={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={run}
          className="aria-pressed:bg-muted"
        >
          <Icon />
        </Button>
      ))}
    </>
  );
}

function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <LinkForm
            initialUrl={editor.getAttributes("link").href ?? ""}
            onSubmit={(url) => {
              const chain = editor.chain().focus().extendMarkRange("link");
              if (url) chain.setLink({ href: url }).run();
              else chain.unsetLink().run();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({
  initialUrl,
  onSubmit,
}: {
  initialUrl: string;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (trimmed && !isAllowedLink(trimmed)) {
      setError("Use an http, https or mailto link.");
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Link</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="link-url">URL</Label>
        <Input
          id="link-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
          aria-invalid={error !== null}
          autoComplete="off"
        />
        <p className="text-muted-foreground text-xs">
          Leave empty to remove the link.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit">Apply</Button>
      </DialogFooter>
    </form>
  );
}
