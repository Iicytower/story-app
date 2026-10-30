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
  SearchIcon,
  Undo2Icon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FindPanel } from "@/components/find-panel";
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
  compileFind,
  expandMatch,
  findMatches,
  type FindOptions,
  type Match,
  nearestMatch,
  replacementTemplate,
  replaceMatches,
} from "@/lib/editor/find";
import {
  CURRENT_MATCH_CLASS,
  docMatches,
  FindHighlight,
  MATCH_CLASS,
  replaceInDoc,
  showMatches,
} from "@/lib/editor/find-highlight";
import {
  type Anchor,
  recallScroll,
  rememberScroll,
} from "@/lib/editor/scroll-memory";
import { blockStarts } from "@/lib/editor/source-blocks";

type Mode = "preview" | "source";

// Measuring Source copies the whole text, so the position is read once scrolling pauses.
const SCROLL_READ_DELAY_MS = 200;

// Shared by the textarea and the highlights under it, which must wrap the same way.
const sourceTextClass = (compact: boolean) =>
  cn(
    "px-4 font-mono text-base leading-relaxed md:px-6 md:text-sm",
    compact && "md:px-4",
  );

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
  const [find, setFind] = useState<"find" | "replace" | null>(null);
  const [findOptions, setFindOptions] = useState<FindOptions>({
    query: "",
    matchCase: false,
    wholeWord: false,
    regex: false,
  });
  const [replacement, setReplacement] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const focusFind = useRef(false);
  // Edits keep the view where it is; only finding moves it to the current match.
  const revealMatch = useRef(false);
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
      FindHighlight,
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

  // Compares by identity: the default deep comparison would walk the document on every transaction.
  const doc = useEditorState({
    editor,
    selector: ({ editor }) => editor?.state.doc ?? null,
    equalityFn: Object.is,
  });
  const compiled = useMemo(() => compileFind(findOptions), [findOptions]);
  const regex = find && compiled instanceof RegExp ? compiled : null;
  const matches = useMemo(
    () =>
      !regex
        ? []
        : mode === "source"
          ? findMatches(value, regex)
          : doc
            ? docMatches(doc, regex)
            : [],
    [regex, mode, value, doc],
  );
  // Modulo: replacing the last match moves on to the first.
  const current = matches.length > 0 ? matchIndex % matches.length : -1;

  useLayoutEffect(() => {
    if (editor && mode === "preview")
      showMatches(editor.view, matches, current);
  }, [editor, mode, matches, current]);

  useLayoutEffect(() => {
    if (!revealMatch.current) return;
    revealMatch.current = false;
    rootRef.current
      ?.querySelector("[data-find-current]")
      ?.scrollIntoView({ block: "center" });
  });

  useEffect(() => {
    if (!focusFind.current) return;
    focusFind.current = false;
    findInputRef.current?.focus();
    findInputRef.current?.select();
  });

  const textMatches = (pattern: RegExp) =>
    mode === "source"
      ? findMatches(value, pattern)
      : docMatches(editor!.state.doc, pattern);

  function caret() {
    if (mode === "source") return textareaRef.current?.selectionStart ?? 0;
    return editor?.state.selection.from ?? 0;
  }

  function selectedText() {
    const textarea = textareaRef.current;
    if (mode === "source" && textarea)
      return value.slice(textarea.selectionStart, textarea.selectionEnd);
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n", "\n");
  }

  function updateFind(next: FindOptions) {
    setFindOptions(next);
    const pattern = compileFind(next);
    if (!(pattern instanceof RegExp)) return;
    setMatchIndex(nearestMatch(textMatches(pattern), caret()));
    revealMatch.current = true;
  }

  function openFind(kind: "find" | "replace") {
    const selected = selectedText();
    if (selected && !selected.includes("\n"))
      updateFind({ ...findOptions, query: selected });
    setFind((open) => (open === "replace" ? open : kind));
    focusFind.current = true;
  }

  // Leaves the current match selected, so typing continues from there.
  function closeFind() {
    const match = matches[current];
    setFind(null);
    if (mode === "source") {
      const textarea = textareaRef.current!;
      textarea.focus({ preventScroll: true });
      if (match) textarea.setSelectionRange(match.from, match.to);
    } else if (match) {
      editor?.chain().setTextSelection(match).focus().run();
    } else {
      editor?.commands.focus();
    }
  }

  function stepMatch(direction: 1 | -1) {
    if (matches.length === 0) return;
    setMatchIndex((current + direction + matches.length) % matches.length);
    revealMatch.current = true;
  }

  function handleFindKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    // Events from the link dialog bubble through its portal.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (event.key === "Escape" && find) {
      event.preventDefault();
      closeFind();
    }
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey)
      return;
    const key = event.key.toLowerCase();
    if (key !== "f" && key !== "h") return;
    event.preventDefault();
    openFind(key === "f" ? "find" : "replace");
  }

  // Goes through the browser's editing command, which keeps native Undo in the textarea.
  function replaceInTextarea(from: number, to: number, text: string) {
    const textarea = textareaRef.current!;
    const scroller = sourceScroller(textarea);
    const { scrollTop } = scroller;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(from, to);
    document.execCommand(text ? "insertText" : "delete", false, text);
    scroller.scrollTop = scrollTop;
  }

  function replaceCurrent() {
    const match = matches[current];
    if (!match || !regex) return;
    const template = replacementTemplate(findOptions, replacement);
    let end: number;
    let next: Match[];
    if (mode === "source") {
      const text = expandMatch(value, match, regex, template);
      replaceInTextarea(match.from, match.to, text);
      end = match.from + text.length;
      next = findMatches(
        value.slice(0, match.from) + text + value.slice(match.to),
        regex,
      );
    } else {
      const { view, state } = editor!;
      const single = docMatches(state.doc, regex).filter(
        ({ from }) => from === match.from,
      );
      const tr = replaceInDoc(state.tr, single, regex, template);
      end = tr.mapping.map(match.to);
      view.dispatch(tr);
      next = docMatches(view.state.doc, regex);
    }
    // Past the new text, so a replacement that contains the query is not found again.
    setMatchIndex(nearestMatch(next, end));
    revealMatch.current = true;
    findInputRef.current?.focus({ preventScroll: true });
  }

  function replaceAll() {
    if (!regex || matches.length === 0) return;
    const template = replacementTemplate(findOptions, replacement);
    if (mode === "source") {
      replaceInTextarea(
        0,
        value.length,
        replaceMatches(value, matches, regex, template),
      );
    } else {
      const { view, state } = editor!;
      view.dispatch(
        replaceInDoc(state.tr, docMatches(state.doc, regex), regex, template),
      );
    }
    setMatchIndex(0);
    // The button gets disabled with no matches left, which would drop the focus.
    findInputRef.current?.focus({ preventScroll: true });
  }

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
      onKeyDown={handleFindKeys}
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Find and replace"
          title="Find and replace"
          aria-pressed={find !== null}
          onClick={() => (find ? closeFind() : openFind("replace"))}
          className="aria-pressed:bg-muted"
        >
          <SearchIcon />
        </Button>
      </div>
      {find && (
        <FindPanel
          options={findOptions}
          onOptionsChange={updateFind}
          replacement={replacement}
          onReplacementChange={setReplacement}
          showReplace={find === "replace"}
          matchCount={matches.length}
          current={current}
          invalid={compiled === "invalid"}
          findInputRef={findInputRef}
          onStep={stepMatch}
          onReplace={replaceCurrent}
          onReplaceAll={replaceAll}
          onClose={closeFind}
        />
      )}
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
          <div className="relative py-(--scroll-gap)">
            {matches.length > 0 && (
              <SourceHighlights
                text={value}
                matches={matches}
                current={current}
                className={sourceTextClass(compact)}
              />
            )}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-label={label}
              placeholder={placeholder}
              lang="pl"
              spellCheck
              className={cn(
                "relative block field-sizing-content w-full resize-none overflow-hidden bg-transparent outline-none",
                sourceTextClass(compact),
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

// A textarea cannot style parts of its text, so a copy under it, with invisible text, marks them.
function SourceHighlights({
  text,
  matches,
  current,
  className,
}: {
  text: string;
  matches: Match[];
  current: number;
  className: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-(--scroll-gap) break-words whitespace-pre-wrap text-transparent",
        className,
      )}
    >
      {matches.map((match, index) => (
        <span key={match.from}>
          {text.slice(index === 0 ? 0 : matches[index - 1].to, match.from)}
          <mark
            data-find-current={index === current ? "" : undefined}
            className={cn(
              "text-transparent",
              index === current ? CURRENT_MATCH_CLASS : MATCH_CLASS,
            )}
          >
            {text.slice(match.from, match.to)}
          </mark>
        </span>
      ))}
      {text.slice(matches.at(-1)!.to)}
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
