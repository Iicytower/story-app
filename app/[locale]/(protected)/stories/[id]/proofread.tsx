"use client";

import { Markdown } from "@tiptap/markdown";
import type { Node } from "@tiptap/pm/model";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Comment } from "@/lib/editor/comment";
import { contentExtensions, MARKED_OPTIONS } from "@/lib/editor/extensions";
import type { ProofreadIssue } from "@/lib/proofreading/languagetool";
import { placeIssues } from "@/lib/proofreading/map";
import {
  applyProposal,
  chooseSuggestion,
  currentProposal,
  loadProposals,
  patchSource,
  Proposals,
  proposalsState,
  rejectProposal,
  selectProposal,
} from "@/lib/proofreading/proposals";
import { trimMarkdown } from "@/lib/editor/extensions";
import { checkChapter } from "./proofread-actions";
import { useEditorTool } from "./tool-context";

type Phase =
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "review"; content: string; issues: ProofreadIssue[] };

export function Proofread() {
  const tool = useEditorTool();
  const t = useTranslations("proofread");
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  // Read once: the check starts when the dialog opens and never again.
  const start = useRef({ tool, t });

  useEffect(() => {
    const { tool, t } = start.current;
    // Closing the dialog unmounts this view; a late answer is then dropped.
    let open = true;
    void (async () => {
      const notSaved = await tool.prepare();
      if (!open) return;
      if (notSaved) return setPhase({ kind: "error", message: notSaved });
      // A new deployment makes the action throw ("Failed to find Server Action").
      const result = await checkChapter(tool.storyId).catch(() => null);
      if (!open) return;
      if (!result) setPhase({ kind: "error", message: t("failed") });
      else if (!result.ok) setPhase({ kind: "error", message: result.message });
      else if (result.content !== tool.content())
        setPhase({ kind: "error", message: t("changed") });
      else
        setPhase({
          kind: "review",
          content: result.content,
          issues: result.issues,
        });
    })();
    return () => {
      open = false;
    };
  }, []);

  if (phase.kind === "review")
    return <Review content={phase.content} issues={phase.issues} />;
  return (
    <>
      <p
        role={phase.kind === "error" ? "alert" : "status"}
        className={
          phase.kind === "error"
            ? "text-destructive text-sm"
            : "text-muted-foreground text-sm"
        }
      >
        {phase.kind === "error" ? phase.message : t("checking")}
      </p>
      <Footer />
    </>
  );
}

function Footer({ onAccept }: { onAccept?: () => void }) {
  const t = useTranslations("proofread");
  return (
    <DialogFooter className="mt-auto">
      <DialogClose asChild>
        <Button variant="outline">{t("cancel")}</Button>
      </DialogClose>
      {onAccept && <Button onClick={onAccept}>{t("accept")}</Button>}
    </DialogFooter>
  );
}

function Review({
  content,
  issues,
}: {
  content: string;
  issues: ProofreadIssue[];
}) {
  const tool = useEditorTool();
  const t = useTranslations("proofread");
  const tEditor = useTranslations("markdownEditor");
  const initial = useRef<Node | null>(null);
  const [found, setFound] = useState<number | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...contentExtensions.map((extension) =>
        extension.name === Comment.name
          ? Comment.configure({ label: tEditor("comment") })
          : extension,
      ),
      Markdown.configure({ markedOptions: MARKED_OPTIONS }),
      Proposals.configure({
        labels: { apply: t("apply"), reject: t("reject") },
      }),
    ],
    content,
    contentType: "markdown",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": t("text"),
        lang: tool.lang,
        spellcheck: "false",
        class: "prose dark:prose-invert max-w-none min-h-full outline-none p-4",
      },
    },
  });

  // EditorContent, a child, has mounted the view by the time this runs.
  useEffect(() => {
    if (!editor || initial.current) return;
    initial.current = editor.state.doc;
    const placed = placeIssues(content, editor.state.doc, issues);
    loadProposals(editor.view, placed);
    setFound(placed.length);
  }, [editor, content, issues]);

  const state = useEditorState({
    editor,
    selector: ({ editor }) => (editor ? proposalsState(editor.state) : null),
    equalityFn: Object.is,
  });
  const current = state && currentProposal(state);

  useLayoutEffect(() => {
    editor?.view.dom
      .querySelector("[data-proposal-current]")
      ?.scrollIntoView({ block: "nearest" });
  }, [editor, current?.id]);

  function accept() {
    const { applied, edited } = proposalsState(editor!.state);
    if (edited && !editor!.state.doc.eq(initial.current!))
      tool.apply(trimMarkdown(editor!.getMarkdown()));
    // Only ✓: the rest of the source stays exactly as written.
    else if (!edited && applied.length > 0)
      tool.apply(patchSource(content, applied));
    else tool.close();
  }

  if (found === 0)
    return (
      <>
        <p role="status" className="text-sm">
          {issues.length > 0 ? t("notShown") : t("noIssues")}
        </p>
        <Footer />
      </>
    );

  const index = current ? state!.proposals.indexOf(current) : -1;
  const step = (direction: 1 | -1) => {
    const { proposals } = state!;
    const next =
      proposals[(index + direction + proposals.length) % proposals.length];
    selectProposal(editor!.view, next.id);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <EditorContent
          editor={editor}
          className="min-h-0 flex-1 overflow-y-auto rounded-md border [&>div]:min-h-full"
        />
        <section
          aria-label={t("panel")}
          className="flex max-h-[40%] shrink-0 flex-col gap-3 overflow-y-auto md:max-h-none md:w-72"
        >
          {current ? (
            <>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("previous")}
                  onClick={() => step(-1)}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="text-muted-foreground text-sm">
                  {t("position", {
                    index: index + 1,
                    count: state!.proposals.length,
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("next")}
                  onClick={() => step(1)}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
              <p className="text-xs font-medium tracking-wide uppercase">
                {t(`kinds.${current.issue.kind}`)}
              </p>
              <p lang={tool.lang} className="text-sm">
                {current.issue.message}
              </p>
              <p lang={tool.lang} className="text-sm">
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
                      lang={tool.lang}
                      aria-pressed={current.choice === choice}
                      onClick={() =>
                        chooseSuggestion(editor!.view, current.id, choice)
                      }
                      className="aria-pressed:bg-diff-added dark:aria-pressed:bg-diff-added aria-pressed:border-transparent"
                    >
                      {replacement || t("remove")}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("noSuggestion")}
                </p>
              )}
              <div className="flex gap-2">
                {current.issue.replacements.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => applyProposal(editor!.view, current.id)}
                  >
                    {t("apply")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectProposal(editor!.view, current.id)}
                >
                  {t("reject")}
                </Button>
              </div>
            </>
          ) : (
            state && <p className="text-sm">{t("allDecided")}</p>
          )}
        </section>
      </div>
      <Footer onAccept={accept} />
    </>
  );
}
