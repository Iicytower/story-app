import { getLocale, getTranslations } from "next-intl/server";
import { SocialMarkdown } from "@/components/social-markdown";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { UserLink } from "@/components/user-link";
import { Link } from "@/i18n/navigation";
import { formatPublishedAt } from "@/lib/publish/published-date";
import {
  commentAnchor,
  COMMENTS_PARAM,
  type CommentTarget,
  type CommentView,
  getCommentThread,
  parseCommentsCursor,
} from "@/lib/social/comments";
import { AuthDialog } from "../../../auth/auth-dialog";
import { CommentControls, NewCommentForm } from "./comment-form";

const SECTION_ID = "comments";

async function CommentItem({
  comment,
  canReply,
  now,
}: {
  comment: CommentView;
  canReply: boolean;
  now: Date;
}) {
  const t = await getTranslations("comments");
  const locale = await getLocale();
  const created = new Date(comment.createdAt);
  const time = (
    <time
      dateTime={comment.createdAt}
      title={new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeStyle: "long",
        timeZone: "UTC",
      }).format(created)}
      className="text-muted-foreground text-xs"
    >
      {formatPublishedAt(created, now, locale)}
    </time>
  );
  if (!comment.author || comment.body === null) {
    return (
      <p className="text-muted-foreground text-sm italic">
        {comment.state === "hidden" ? t("hidden") : t("deleted")}
      </p>
    );
  }
  return (
    <div className="flex min-w-0 gap-3">
      <UserAvatar
        nickname={comment.author.nickname}
        src={comment.author.avatar}
        alt=""
        size={32}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          id={`${commentAnchor(comment.id)}-by`}
          className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm"
        >
          <UserLink
            nickname={comment.author.nickname}
            className="[overflow-wrap:anywhere]"
          />
          {time}
          {comment.edited && (
            <span className="text-muted-foreground text-xs">{t("edited")}</span>
          )}
        </p>
        <CommentControls
          id={comment.id}
          body={comment.body}
          nickname={comment.author.nickname}
          headerId={`${commentAnchor(comment.id)}-by`}
          editable={comment.editableUntil !== null}
          own={comment.own}
          canReply={canReply}
        >
          <SocialMarkdown content={comment.body} />
        </CommentControls>
      </div>
    </div>
  );
}

// Under a public chapter or a book's contents. A guest reads and gets the sign-in dialog (D42);
// ids of the place go to signed-in readers only.
export async function Comments({
  viewerId,
  target,
  path,
  after,
}: {
  viewerId: string | null;
  target: CommentTarget;
  path: string;
  after: unknown;
}) {
  const cursor = parseCommentsCursor(after);
  const thread = await getCommentThread(viewerId, target, cursor);
  const t = await getTranslations("comments");
  const locale = await getLocale();
  const now = new Date();
  const signedIn = viewerId !== null;

  return (
    <section
      id={SECTION_ID}
      aria-labelledby="comments-title"
      className="flex min-w-0 scroll-mt-4 flex-col gap-4 border-t pt-6"
    >
      <h2 id="comments-title" className="text-xl font-semibold">
        {t("title", { count: thread.total })}
      </h2>
      {thread.disabled ? (
        <p className="text-muted-foreground">{t("disabled")}</p>
      ) : (
        <>
          {signedIn ? (
            <NewCommentForm
              place={
                target.storyId
                  ? { storyId: target.storyId }
                  : { folderId: target.folderId }
              }
            />
          ) : (
            <AuthDialog
              callbackUrl={`/${locale}${path}#${SECTION_ID}`}
              trigger={
                <Button variant="outline" className="self-start">
                  {t("signIn")}
                </Button>
              }
            />
          )}
          {thread.comments.length === 0 ? (
            <p className="text-muted-foreground">
              {cursor ? t("noOlder") : t("empty")}
            </p>
          ) : (
            <ol aria-label={t("list")} className="flex flex-col gap-6">
              {thread.comments.map((comment) => (
                <li
                  key={comment.id}
                  id={commentAnchor(comment.id)}
                  className="target:bg-muted/60 flex min-w-0 scroll-mt-4 flex-col gap-3 target:rounded-md"
                >
                  <CommentItem
                    comment={comment}
                    canReply={signedIn && comment.state !== "hidden"}
                    now={now}
                  />
                  {comment.replies.length > 0 && (
                    <ol
                      aria-label={t("replies", {
                        count: comment.replies.length,
                      })}
                      className="ml-4 flex min-w-0 flex-col gap-4 border-l pl-4"
                    >
                      {comment.replies.map((reply) => (
                        <li
                          key={reply.id}
                          id={commentAnchor(reply.id)}
                          className="target:bg-muted/60 min-w-0 scroll-mt-4 target:rounded-md"
                        >
                          <CommentItem
                            comment={reply}
                            canReply={signedIn}
                            now={now}
                          />
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          )}
          {(cursor || thread.next) && (
            <nav aria-label={t("pages")} className="flex flex-wrap gap-2">
              {cursor && (
                <Button asChild variant="outline">
                  <Link href={`${path}#${SECTION_ID}`}>{t("newest")}</Link>
                </Button>
              )}
              {thread.next && (
                <Button asChild variant="outline">
                  <Link
                    href={`${path}?${COMMENTS_PARAM}=${thread.next}#${SECTION_ID}`}
                  >
                    {t("older")}
                  </Link>
                </Button>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
