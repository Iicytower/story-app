import { getLocale, getTranslations } from "next-intl/server";
import { AuthDialog } from "@/app/[locale]/auth/auth-dialog";
import { CommunityBanNotice } from "@/app/[locale]/p/[nickname]/[folder]/community-ban-notice";
import { ReactionBar } from "@/app/[locale]/p/[nickname]/[folder]/reaction-bar";
import {
  FollowThreadButton,
  NewPostForm,
  NewThreadForm,
  PostControls,
  RestoreButton,
} from "@/components/forum/forum-forms";
import { LocalDate } from "@/components/local-date";
import { CommentMenu } from "@/components/moderation-controls";
import { PlainMarkdown, SocialMarkdown } from "@/components/social-markdown";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { UserLink } from "@/components/user-link";
import { Link } from "@/i18n/navigation";
import { formatPublishedAt } from "@/lib/publish/published-date";
import {
  canWriteIn,
  type ForumPlace,
  listThreads,
  postAnchor,
  type PostView,
  threadPath,
  type ThreadView,
} from "@/lib/social/forums";
import { activeCommunityBan } from "@/lib/social/moderation";
import { getReactionSummaries } from "@/lib/social/reaction-summary";
import { EMPTY_SUMMARY, type ReactionSummary } from "@/lib/social/reactions";

function DateText({ value }: { value: string }) {
  return (
    <LocalDate iso={value} relative className="text-muted-foreground text-xs" />
  );
}

// The forum's threads, newest activity first, with the form for a new one (D80).
export async function ThreadList({
  viewerId,
  place,
  title,
  path,
}: {
  viewerId: string | null;
  place: ForumPlace;
  title: string;
  path: string;
}) {
  const t = await getTranslations("forums");
  const locale = await getLocale();
  const [threads, writable, ban] = await Promise.all([
    listThreads(viewerId, place),
    canWriteIn(viewerId, place),
    place.scope === "author"
      ? activeCommunityBan(viewerId, place.authorId)
      : null,
  ]);
  const basePath = threadPath(place, "").replace(/\/$/, "");
  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 px-4 py-8 sm:px-6">
      <nav aria-label={t("breadcrumbs")} className="text-sm">
        <Link
          href={place.scope === "global" ? "/forums" : `/p/${place.nickname}`}
          className="text-muted-foreground hover:underline"
        >
          {place.scope === "global" ? t("title") : place.nickname}
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">
        {title}
      </h1>
      <CommunityBanNotice ban={ban} />
      {writable ? (
        <NewThreadForm
          forum={
            place.scope === "global"
              ? { category: place.category.key }
              : { nickname: place.nickname }
          }
          basePath={basePath}
        />
      ) : (
        viewerId === null && (
          <AuthDialog
            callbackUrl={`/${locale}${path}`}
            trigger={
              <Button variant="outline" className="self-start">
                {t("signIn")}
              </Button>
            }
          />
        )
      )}
      {place.scope === "global" && place.category.adminOnly && (
        <p className="text-muted-foreground text-sm">{t("adminOnly")}</p>
      )}
      {threads.length === 0 ? (
        <p className="text-muted-foreground">{t("noThreads")}</p>
      ) : (
        <ul aria-label={t("threads")} className="flex flex-col divide-y">
          {threads.map((thread) => (
            <li key={thread.id} className="flex min-w-0 flex-col gap-1 py-3">
              <Link
                href={thread.path}
                className="font-medium [overflow-wrap:anywhere] hover:underline"
              >
                {thread.title}
              </Link>
              <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-3 text-xs">
                {thread.starter && (
                  <span>{t("startedBy", { nickname: thread.starter })}</span>
                )}
                <span>{t("posts", { count: thread.postCount })}</span>
                <span>
                  {t("lastPost")}{" "}
                  <DateText value={thread.lastPostAt} />
                </span>
                {thread.hidden && <span>{t("threadHidden")}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function PostItem({
  post,
  thread,
  now,
  reactions,
  signedIn,
  writable,
  locked,
}: {
  post: PostView;
  thread: ThreadView;
  now: Date;
  reactions: ReactionSummary;
  signedIn: boolean;
  writable: boolean;
  locked: boolean;
}) {
  const t = await getTranslations("forums");
  const locale = await getLocale();
  if (!post.author || post.body === null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm italic">
          {post.state === "hidden" ? t("postHidden") : t("postDeleted")}
        </p>
        {post.canRestore && (
          <RestoreButton
            kind="post"
            id={post.id}
            label={t("restorePost", {
              date: formatPublishedAt(new Date(post.createdAt), now, locale),
            })}
          />
        )}
      </div>
    );
  }
  // A deleted account keeps its posts, signed without a link (task 89).
  const deletedUser = post.author.nickname === null;
  const name = post.author.nickname ?? t("deletedUser");
  const headerId = `${postAnchor(post.id)}-by`;
  const date = formatPublishedAt(new Date(post.createdAt), now, locale);
  const callbackUrl = `/${locale}${thread.path}#${postAnchor(post.id)}`;
  return (
    <div className="flex min-w-0 gap-3">
      <UserAvatar nickname={name} src={post.author.avatar} alt="" size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p
            id={headerId}
            className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm"
          >
            {deletedUser ? (
              <span className="text-muted-foreground font-medium">{name}</span>
            ) : (
              <UserLink nickname={name} className="[overflow-wrap:anywhere]" />
            )}
            <DateText value={post.createdAt} />
            {post.edited && (
              <span className="text-muted-foreground text-xs">
                {t("edited")}
              </span>
            )}
          </p>
          <CommentMenu
            commentId={post.id}
            kind="post"
            headingId="thread-title"
            nickname={name}
            date={date}
            authorId={thread.moderatedAuthorId}
            canHide={post.canHide}
            canBan={post.canBan}
            canReport={!post.own}
            canBlock={signedIn && !post.own && !deletedUser}
            signedIn={signedIn}
            callbackUrl={callbackUrl}
          />
        </div>
        {post.quote &&
          (post.quote.nickname && post.quote.excerpt !== null ? (
            <blockquote
              aria-label={t("quoteOf", { nickname: post.quote.nickname })}
              className="text-muted-foreground flex min-w-0 flex-col gap-1 border-l-2 pl-3 text-sm"
            >
              <Link
                href={`#${postAnchor(post.quote.id)}`}
                className="self-start text-xs hover:underline"
              >
                {t("inReplyTo", { nickname: post.quote.nickname })}
              </Link>
              <PlainMarkdown content={post.quote.excerpt} />
            </blockquote>
          ) : (
            <p className="text-muted-foreground border-l-2 pl-3 text-sm italic">
              {t("quoteUnavailable")}
            </p>
          ))}
        <PostControls
          id={post.id}
          body={post.body}
          nickname={name}
          headerId={headerId}
          editable={post.editableUntil !== null}
          own={post.own}
          canQuote={writable}
        >
          <SocialMarkdown content={post.body} mentions={post.mentions} />
        </PostControls>
        <ReactionBar
          target={signedIn ? { type: "post", id: post.id } : null}
          summary={reactions}
          own={post.own}
          locked={locked}
          label={t("reactionsTo", { nickname: name })}
          callbackUrl={callbackUrl}
        />
      </div>
    </div>
  );
}

// A thread: its posts oldest first, each with reactions, quoting and the ⋮ menu (D80).
export async function ThreadPage({
  viewerId,
  thread,
}: {
  viewerId: string | null;
  thread: ThreadView;
}) {
  const t = await getTranslations("forums");
  const locale = await getLocale();
  const now = new Date();
  const signedIn = viewerId !== null;
  const { place } = thread;
  const [writable, ban, reactions] = await Promise.all([
    canWriteIn(viewerId, place),
    place.scope === "author"
      ? activeCommunityBan(viewerId, place.authorId)
      : null,
    getReactionSummaries(
      viewerId,
      "post",
      thread.posts
        .filter(({ state }) => state === "visible")
        .map(({ id }) => id),
    ),
  ]);
  const canPost = writable && !thread.hidden;
  const forumPath =
    place.scope === "global"
      ? `/forums/${place.category.key}`
      : `/p/${place.nickname}/forum`;
  const [first] = thread.posts;
  return (
    <article
      aria-labelledby="thread-title"
      className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <nav aria-label={t("breadcrumbs")} className="text-sm">
        <Link
          href={forumPath}
          className="text-muted-foreground [overflow-wrap:anywhere] hover:underline"
        >
          {place.scope === "global"
            ? place.category.labels[locale === "pl" ? "pl" : "en"]
            : t("authorForum", { nickname: place.nickname })}
        </Link>
      </nav>
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h1
            id="thread-title"
            tabIndex={-1}
            className="text-2xl font-semibold [overflow-wrap:anywhere] outline-none"
          >
            {thread.title}
          </h1>
          {thread.canHide && thread.starter && first && (
            <CommentMenu
              commentId={thread.id}
              kind="thread"
              headingId="thread-title"
              nickname={thread.starter}
              date={formatPublishedAt(new Date(first.createdAt), now, locale)}
              authorId={null}
              canHide
              canBan={false}
              canReport={false}
              canBlock={false}
              signedIn={signedIn}
              callbackUrl={`/${locale}${thread.path}`}
            />
          )}
        </div>
        {thread.hidden && (
          <div
            role="note"
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="text-muted-foreground">{t("threadHidden")}</span>
            {thread.canRestore && (
              <RestoreButton
                kind="thread"
                id={thread.id}
                label={t("restoreThread")}
              />
            )}
          </div>
        )}
        {signedIn && !thread.hidden && (
          <FollowThreadButton threadId={thread.id} followed={thread.followed} />
        )}
      </header>
      <CommunityBanNotice ban={ban} />
      <ol aria-label={t("postList")} className="flex flex-col gap-6">
        {thread.posts.map((post) => (
          <li
            key={post.id}
            id={postAnchor(post.id)}
            className="target:bg-muted/60 min-w-0 scroll-mt-4 target:rounded-md"
          >
            <PostItem
              post={post}
              thread={thread}
              now={now}
              reactions={reactions.get(post.id) ?? EMPTY_SUMMARY}
              signedIn={signedIn}
              writable={canPost}
              locked={ban !== null}
            />
          </li>
        ))}
      </ol>
      {canPost ? (
        <section
          aria-labelledby="new-post"
          className="flex flex-col gap-2 border-t pt-4"
        >
          <h2 id="new-post" className="font-semibold">
            {t("newPost")}
          </h2>
          <NewPostForm threadId={thread.id} />
        </section>
      ) : (
        !signedIn && (
          <AuthDialog
            callbackUrl={`/${locale}${thread.path}`}
            trigger={
              <Button variant="outline" className="self-start">
                {t("signIn")}
              </Button>
            }
          />
        )
      )}
    </article>
  );
}
