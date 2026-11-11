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
import { restoreContent } from "@/app/[locale]/(protected)/moderation/actions";
import {
  createPost,
  createThread,
  deletePost,
  editPost,
  followThread,
  type ForumRef,
  quotePost,
  unfollowThread,
} from "@/app/[locale]/forums/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MentionTextarea } from "@/components/mention-textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { MAX_POST_LENGTH, MAX_THREAD_TITLE_LENGTH } from "@/lib/limits";

function PostEditor({
  id,
  label,
  submitLabel,
  initial = "",
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  id?: string;
  label: string;
  submitLabel: string;
  initial?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<ActionResult>;
  onCancel?: () => void;
}) {
  const t = useTranslations("forums");
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
      <MentionTextarea
        id={fieldId}
        value={body}
        onValueChange={setBody}
        placeholder={t("placeholder")}
        maxLength={MAX_POST_LENGTH}
        autoFocus={autoFocus}
        rows={4}
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

export function NewPostForm({ threadId }: { threadId: string }) {
  const t = useTranslations("forums");
  return (
    <PostEditor
      label={t("newPost")}
      submitLabel={t("submitPost")}
      onSubmit={(body) => createPost(threadId, body)}
    />
  );
}

// A new thread opens once it is created; basePath is where the forum's threads live.
export function NewThreadForm({
  forum,
  basePath,
}: {
  forum: ForumRef;
  basePath: string;
}) {
  const t = useTranslations("forums");
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createThread(forum, title, body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`${basePath}/${result.id}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
    >
      <h2 id={`${id}-heading`} className="font-semibold">
        {t("newThread")}
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>{t("threadTitle")}</Label>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_THREAD_TITLE_LENGTH}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-body`}>{t("threadBody")}</Label>
        <MentionTextarea
          id={`${id}-body`}
          value={body}
          onValueChange={setBody}
          placeholder={t("placeholder")}
          maxLength={MAX_POST_LENGTH}
          rows={5}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="self-start"
        disabled={pending || !title.trim() || !body.trim()}
      >
        {t("submitThread")}
      </Button>
    </form>
  );
}

type Mode = "view" | "edit" | "quote";

// The post, rendered on the server, with the writer's Edit and Delete and everyone's Quote.
// Closing a form gives the focus back to the button that opened it.
export function PostControls({
  id,
  body,
  nickname,
  headerId,
  editable,
  own,
  canQuote,
  children,
}: {
  id: string;
  body: string;
  nickname: string;
  headerId: string;
  editable: boolean;
  own: boolean;
  canQuote: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("forums");
  const tCommon = useTranslations("common");
  const quoteFormId = useId();
  const [mode, setMode] = useState<Mode>("view");
  const [confirm, setConfirm] = useState(false);
  const closed = useRef<Mode | null>(null);
  const quoteButton = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode !== "view" || !closed.current) return;
    const button =
      closed.current === "edit" ? editButton.current : quoteButton.current;
    closed.current = null;
    (button ?? quoteButton.current)?.focus();
  }, [mode]);

  function close() {
    closed.current = mode;
    setMode("view");
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {mode === "edit" ? (
        <PostEditor
          label={t("editLabel")}
          submitLabel={tCommon("save")}
          initial={body}
          autoFocus
          onSubmit={(text) => editPost(id, text)}
          onCancel={close}
        />
      ) : (
        children
      )}
      {mode !== "edit" && (canQuote || own) && (
        <div className="flex flex-wrap gap-1">
          {canQuote && (
            <Button
              ref={quoteButton}
              size="sm"
              variant="ghost"
              aria-label={t("quoteFrom", { nickname })}
              aria-expanded={mode === "quote"}
              aria-controls={mode === "quote" ? quoteFormId : undefined}
              onClick={() => (mode === "quote" ? close() : setMode("quote"))}
            >
              {t("quote")}
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
      {mode === "quote" && (
        <PostEditor
          id={quoteFormId}
          label={t("quoteFrom", { nickname })}
          submitLabel={t("submitPost")}
          autoFocus
          onSubmit={(text) => quotePost(id, text)}
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
        action={() => deletePost(id)}
      />
    </div>
  );
}

export function FollowThreadButton({
  threadId,
  followed,
}: {
  threadId: string;
  followed: boolean;
}) {
  const t = useTranslations("forums");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="outline"
        size="sm"
        aria-pressed={followed}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await (followed ? unfollowThread : followThread)(
              threadId,
            );
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {followed ? t("unfollow") : t("follow")}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function RestoreButton({
  kind,
  id,
  label,
}: {
  kind: "post" | "thread";
  id: string;
  label: string;
}) {
  const t = useTranslations("moderation");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        aria-label={label}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await restoreContent(kind, id);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {t("restore")}
      </Button>
      {error && (
        <span role="alert" className="text-destructive text-sm">
          {error}
        </span>
      )}
    </span>
  );
}
