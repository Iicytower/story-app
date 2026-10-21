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
import { useEffect, useRef, useState } from "react";
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

type Mode = "preview" | "source";

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  className,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  // Accessible name of the text field in both modes, e.g. "Content".
  label: string;
  placeholder?: string;
  className?: string;
  // Smaller text for the notes panels.
  compact?: boolean;
}) {
  // Always Preview on open; the choice is not remembered.
  const [mode, setMode] = useState<Mode>("preview");
  const [linkOpen, setLinkOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  const openLinkRef = useRef(() => setLinkOpen(true));
  // The markdown the editor last produced or loaded; anything else in `value` came from Source.
  const synced = useRef(value);

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
          "prose dark:prose-invert max-w-none min-h-full outline-none px-4 py-4 md:px-6",
          compact && "prose-sm py-3 md:px-4",
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

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "preview" && editor && value !== synced.current) {
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
      synced.current = value;
    }
    setMode(next);
  }

  return (
    <div
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
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          placeholder={placeholder}
          lang="pl"
          spellCheck
          className={cn(
            "min-h-0 flex-1 resize-none bg-transparent px-4 py-4 font-mono text-base leading-relaxed outline-none md:px-6 md:text-sm",
            compact && "py-3 md:px-4",
          )}
        />
      ) : (
        <EditorContent
          editor={editor}
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
