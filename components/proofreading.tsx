"use client";

// Proofreading in the chapter's editor (task 55): the bar above the text and the bubble with
// the current proposal's details.

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useState, useTransition } from "react";
import { addToDictionary } from "@/app/[locale]/(protected)/actions";
import { Button } from "@/components/ui/button";
import { parseDictionaryWord } from "@/lib/proofreading/dictionary";
import {
  applyProposal,
  chooseSuggestion,
  clearProposals,
  currentProposal,
  dismissWord,
  proposalsState,
  rejectProposal,
  selectProposal,
} from "@/lib/proofreading/proposals";

// How the bubble was opened: a click on the text keeps the editor's focus, the bar moves it in.
export type Bubble = "closed" | "pointer" | "keyboard";

export function useProposals(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor }) => (editor ? proposalsState(editor.state) : null),
    equalityFn: Object.is,
  });
}

const revealCurrent = (editor: Editor) =>
  requestAnimationFrame(() =>
    editor.view.dom
      .querySelector("[data-proposal-current]")
      ?.scrollIntoView({ block: "nearest" }),
  );

export function ProofreadingBar({
  editor,
  onBubble,
}: {
  editor: Editor;
  onBubble: (bubble: Bubble) => void;
}) {
  const t = useTranslations("proofread");
  const state = useProposals(editor);
  if (!state || state.proposals.length === 0) return null;
  const { proposals } = state;
  const index = proposals.indexOf(currentProposal(state)!);
  const step = (direction: 1 | -1) => {
    const next =
      proposals[(index + direction + proposals.length) % proposals.length];
    selectProposal(editor.view, next.id);
    revealCurrent(editor);
    onBubble("keyboard");
  };
  return (
    <div
      role="toolbar"
      aria-label={t("bar")}
      data-proofreading-bar=""
      className="bg-muted/50 flex items-center gap-1 border-b px-2 py-1 text-sm"
    >
      <span className="px-1 font-medium">{t("bar")}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("previous")}
        onClick={() => step(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="text-muted-foreground">
        {t("position", { index: index + 1, count: proposals.length })}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("next")}
        onClick={() => step(1)}
      >
        <ChevronRightIcon />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        onClick={() => {
          onBubble("closed");
          clearProposals(editor.view);
          editor.commands.focus();
        }}
      >
        {t("finish")}
      </Button>
    </div>
  );
}

export function ProofreadingBubble({
  editor,
  bubble,
  onBubble,
  lang,
}: {
  editor: Editor;
  bubble: Bubble;
  onBubble: (bubble: Bubble) => void;
  lang: string;
}) {
  const t = useTranslations("proofread");
  const state = useProposals(editor);
  const current = state && currentProposal(state);
  const [adding, startAdding] = useTransition();
  // Kept with its proposal, so it does not stay under the next one.
  const [dictionaryError, setDictionaryError] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const open = bubble !== "closed" && Boolean(current);

  // Measured on every layout, as the highlight's element is redrawn with the decorations.
  const anchor = {
    current: {
      getBoundingClientRect: () =>
        editor.view.dom
          .querySelector("[data-proposal-current]")
          ?.getBoundingClientRect() ?? new DOMRect(),
      contextElement: editor.view.dom,
    },
  };

  // The next proposal becomes current; after the last one the focus goes back to the text.
  const decided = () => {
    if (proposalsState(editor.state).proposals.length > 0)
      revealCurrent(editor);
    else editor.commands.focus();
  };
  const word =
    current?.issue.kind === "spelling"
      ? parseDictionaryWord(current.original)
      : null;
  function addWord(id: number, word: string) {
    setDictionaryError(null);
    startAdding(async () => {
      const result = await addToDictionary(word).catch(() => null);
      if (!result) setDictionaryError({ id, message: t("dictionaryFailed") });
      else if (!result.ok) setDictionaryError({ id, message: result.message });
      // The editor may be gone after a move to another chapter.
      else if (!editor.isDestroyed) {
        dismissWord(editor.view, word);
        decided();
      }
    });
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => !next && onBubble("closed")}
      modal={false}
    >
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Portal>
        {current && (
          <Popover.Content
            aria-label={t("panel")}
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            hideWhenDetached
            onOpenAutoFocus={(event) => {
              if (bubble !== "keyboard") event.preventDefault();
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onEscapeKeyDown={() => editor.commands.focus()}
            onInteractOutside={(event) => {
              // A click on another proposal's text, or a step in the bar, moves the bubble.
              const target = event.target as Element | null;
              if (target?.closest?.("[data-proposal], [data-proofreading-bar]"))
                event.preventDefault();
            }}
            className="bg-popover text-popover-foreground ring-foreground/10 z-40 flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-lg p-3 text-sm shadow-md ring-1 outline-none"
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 text-xs font-medium tracking-wide uppercase">
                {t(`kinds.${current.issue.kind}`)}
              </p>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("closeBubble")}
                onClick={() => {
                  onBubble("closed");
                  editor.commands.focus();
                }}
              >
                <XIcon />
              </Button>
            </div>
            <p lang={lang}>{current.issue.message}</p>
            <p lang={lang}>
              <span className="bg-diff-removed rounded-xs">
                {current.original}
              </span>
            </p>
            {current.issue.replacements.length > 0 ? (
              <div
                role="group"
                aria-label={t("suggestions")}
                className="flex flex-wrap gap-1"
              >
                {current.issue.replacements.map((replacement, choice) => (
                  <Button
                    key={choice}
                    variant="outline"
                    size="sm"
                    lang={lang}
                    aria-pressed={current.choice === choice}
                    onClick={() =>
                      chooseSuggestion(editor.view, current.id, choice)
                    }
                    className="aria-pressed:bg-diff-added dark:aria-pressed:bg-diff-added aria-pressed:border-transparent"
                  >
                    {replacement || t("remove")}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{t("noSuggestion")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {current.issue.replacements.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    applyProposal(editor.view, current.id);
                    decided();
                  }}
                >
                  {t("apply")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  rejectProposal(editor.view, current.id);
                  decided();
                }}
              >
                {t("reject")}
              </Button>
              {word !== null && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={adding}
                  onClick={() => addWord(current.id, word)}
                >
                  {t("addToDictionary")}
                </Button>
              )}
            </div>
            {dictionaryError?.id === current.id && (
              <p role="alert" className="text-destructive">
                {dictionaryError.message}
              </p>
            )}
          </Popover.Content>
        )}
      </Popover.Portal>
    </Popover.Root>
  );
}
