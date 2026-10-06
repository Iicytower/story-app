"use client";

import {
  DownloadIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Share2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countCharacters,
  countWords,
  formatReadAloudTime,
} from "@/lib/stories/count";
import type { EditorStory } from "@/lib/stories/queries";
import { DeleteStoryButton } from "../delete-story-button";

export function Editor({ story }: { story: EditorStory }) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [content, setContent] = useState(story.content);
  const [notes, setNotes] = useState(story.notes);
  const [notesOpen, setNotesOpen] = useState(true);
  const words = countWords(content);

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
        <span className="text-muted-foreground text-sm" role="status">
          {/* Save state is implemented in task 10. */}
        </span>
        <Button variant="outline" disabled>
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
