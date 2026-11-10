"use client";

import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { MAX_COMMENT_LENGTH } from "@/lib/limits";
import {
  addComment,
  deleteComment,
  editComment,
  replyToComment,
} from "./comment-actions";

function CommentEditor({
  id,
  label,
  placeholder,
  submitLabel,
  initial = "",
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  id?: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  initial?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<ActionResult>;
  onCancel?: () => void;
}) {
  const tCommon = useTranslations("common");
  const fieldId = useId();
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody("");
      onCancel?.();
    });
  }

  return (
    <form id={id} onSubmit={submit} className="flex min-w-0 flex-col gap-2">
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <Textarea
        id={fieldId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        maxLength={MAX_COMMENT_LENGTH}
        autoFocus={autoFocus}
        rows={3}
        required
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

export function NewCommentForm({
  place,
}: {
  place: { storyId: string } | { folderId: string };
}) {
  const t = useTranslations("comments");
  return (
    <CommentEditor
      label={t("newLabel")}
      placeholder={t("placeholder")}
      submitLabel={t("submit")}
      onSubmit={(body) => addComment(place, body)}
    />
  );
}

type Mode = "view" | "edit" | "reply";

// The text, rendered on the server, with the writer's Edit and Delete and everyone's Reply.
// Closing a form gives the focus back to the button that opened it.
export function CommentControls({
  id,
  body,
  nickname,
  headerId,
  editable,
  own,
  canReply,
  children,
}: {
  id: string;
  body: string;
  nickname: string;
  // The comment's author and date, which name what Edit and Delete act on.
  headerId: string;
  editable: boolean;
  own: boolean;
  canReply: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("comments");
  const tCommon = useTranslations("common");
  const replyFormId = useId();
  const [mode, setMode] = useState<Mode>("view");
  const [confirm, setConfirm] = useState(false);
  const closed = useRef<Mode | null>(null);
  const replyButton = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode !== "view" || !closed.current) return;
    const button =
      closed.current === "edit" ? editButton.current : replyButton.current;
    closed.current = null;
    // An edit window that ended meanwhile leaves Reply or nothing to come back to.
    (button ?? replyButton.current)?.focus();
  }, [mode]);

  function close() {
    closed.current = mode;
    setMode("view");
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {mode === "edit" ? (
        <CommentEditor
          label={t("editLabel")}
          placeholder={t("placeholder")}
          submitLabel={tCommon("save")}
          initial={body}
          autoFocus
          onSubmit={(text) => editComment(id, text)}
          onCancel={close}
        />
      ) : (
        children
      )}
      {mode !== "edit" && (canReply || own) && (
        <div className="flex flex-wrap gap-1">
          {canReply && (
            <Button
              ref={replyButton}
              size="sm"
              variant="ghost"
              aria-label={t("replyTo", { nickname })}
              aria-expanded={mode === "reply"}
              aria-controls={mode === "reply" ? replyFormId : undefined}
              onClick={() => (mode === "reply" ? close() : setMode("reply"))}
            >
              {t("reply")}
            </Button>
          )}
          {own && editable && (
            <Button
              ref={editButton}
              size="sm"
              variant="ghost"
              aria-describedby={headerId}
              onClick={() => setMode("edit")}
            >
              {t("edit")}
            </Button>
          )}
          {own && (
            <Button
              size="sm"
              variant="ghost"
              aria-describedby={headerId}
              onClick={() => setConfirm(true)}
            >
              {tCommon("delete")}
            </Button>
          )}
        </div>
      )}
      {mode === "reply" && (
        <CommentEditor
          id={replyFormId}
          label={t("replyTo", { nickname })}
          placeholder={t("replyPlaceholder")}
          submitLabel={t("submitReply")}
          autoFocus
          onSubmit={(text) => replyToComment(id, text)}
          onCancel={close}
        />
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        confirmLabel={tCommon("delete")}
        destructive
        action={() => deleteComment(id)}
      />
    </div>
  );
}
