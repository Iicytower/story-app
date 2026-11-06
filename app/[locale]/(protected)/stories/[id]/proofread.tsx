"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { checkChapter } from "./proofread-actions";
import { useEditorTool } from "./tool-context";

type Phase =
  | { kind: "ask" }
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

// Asks before the check, so opening the tile sends nothing to LanguageTool. The proposals go
// to the chapter's editor (task 55); this dialog stays open, blocking edits, until they do.
export function Proofread() {
  const tool = useEditorTool();
  const t = useTranslations("proofread");
  const tCommon = useTranslations("common");
  const [phase, setPhase] = useState<Phase>({ kind: "ask" });
  // Closing the dialog unmounts this view; a late answer is then dropped.
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  async function check() {
    setPhase({ kind: "checking" });
    const notSaved = await tool.prepare();
    if (!open.current) return;
    if (notSaved) return setPhase({ kind: "error", message: notSaved });
    // A new deployment makes the action throw ("Failed to find Server Action").
    const result = await checkChapter(tool.storyId).catch(() => null);
    if (!open.current) return;
    if (!result) setPhase({ kind: "error", message: t("failed") });
    else if (!result.ok) setPhase({ kind: "error", message: result.message });
    else if (result.content !== tool.content())
      setPhase({ kind: "error", message: t("changed") });
    else if (tool.startProofreading(result.content, result.issues) === 0)
      setPhase({
        kind: "done",
        message: result.issues.length > 0 ? t("notShown") : t("noIssues"),
      });
  }

  return (
    <>
      <DialogDescription asChild>
        <div className="flex flex-col gap-2">
          <p className="text-foreground text-base">
            {tool.proofreading ? t("againQuestion") : t("question")}
          </p>
          <p className="text-muted-foreground text-xs">
            {tool.proofreading ? t("againDetails") : t("details")}
          </p>
        </div>
      </DialogDescription>
      {phase.kind !== "ask" && (
        <p
          role={phase.kind === "error" ? "alert" : "status"}
          className={
            phase.kind === "error"
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {phase.kind === "checking" ? t("checking") : phase.message}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">
            {phase.kind === "done" ? tCommon("close") : tCommon("cancel")}
          </Button>
        </DialogClose>
        {phase.kind !== "done" && (
          // aria-disabled, not disabled: the focus stays on the button during the check.
          <Button
            autoFocus
            aria-disabled={phase.kind === "checking" || undefined}
            onClick={() => phase.kind !== "checking" && void check()}
            className="aria-disabled:opacity-50"
          >
            {phase.kind === "error" ? t("checkAgain") : t("check")}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
