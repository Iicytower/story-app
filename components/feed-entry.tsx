import { BookOpen, MessageSquareReply, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AdultBadge } from "@/components/adult";
import { PublicCover } from "@/components/cover";
import { LocalDate } from "@/components/local-date";
import { UserAvatar } from "@/components/user-avatar";
import { profilePath } from "@/components/user-link";
import { Link } from "@/i18n/navigation";
import type { FeedEntry as Entry } from "@/lib/social/feed";

// One link of an entry stands out (5.2); the others show their underline on hover or focus.
const mainLinkClass =
  "text-base font-semibold [overflow-wrap:anywhere] underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-current";
const linkClass =
  "[overflow-wrap:anywhere] underline-offset-4 hover:underline focus-visible:underline";

export function FeedEntry({ entry }: { entry: Entry }) {
  const t = useTranslations("feed");
  const tCovers = useTranslations("covers");

  const kind =
    entry.type === "forumThread"
      ? { icon: MessagesSquare, label: t("kindThread") }
      : entry.type === "authorReply"
        ? { icon: MessageSquareReply, label: t("kindReply") }
        : {
            icon: BookOpen,
            label:
              entry.chapters.length === 1
                ? t("kindChapter")
                : t("kindChapters", { count: entry.chapters.length }),
          };
  const Icon = kind.icon;

  const chapterPath =
    entry.type === "chapterPublished"
      ? entry.chapters[0].path
      : entry.type === "authorReply"
        ? (entry.chapter?.path ?? entry.book.path)
        : "";
  const bookTag = (chunks: ReactNode) =>
    entry.type === "forumThread" ? null : (
      <Link href={entry.book.path} className={linkClass}>
        {chunks}
      </Link>
    );

  let main: ReactNode;
  let sub: ReactNode;
  if (entry.type === "forumThread") {
    main = (
      <Link href={entry.thread.path} className={mainLinkClass}>
        {entry.thread.title}
      </Link>
    );
    sub = t("inForum");
  } else if (entry.type === "authorReply") {
    main = (
      <Link href={entry.commentPath} className={mainLinkClass}>
        {t("replyLink")}
      </Link>
    );
    sub = entry.chapter
      ? t.rich("replyUnderChapter", {
          chapter: (chunks: ReactNode) => (
            <Link href={chapterPath} className={linkClass}>
              {chunks}
            </Link>
          ),
          book: bookTag,
          title: entry.chapter.title,
          bookName: entry.book.name,
        })
      : t.rich("replyUnderBook", { book: bookTag, bookName: entry.book.name });
  } else if (entry.chapters.length === 1) {
    main = (
      <Link href={chapterPath} className={mainLinkClass}>
        {entry.chapters[0].title}
      </Link>
    );
    sub = t.rich("inBook", { book: bookTag, bookName: entry.book.name });
  } else {
    main = (
      <Link href={entry.book.path} className={mainLinkClass}>
        {entry.book.name}
      </Link>
    );
  }

  return (
    <li className="bg-card hover:bg-accent/40 flex min-w-0 items-start gap-3 rounded-xl border p-4 transition-colors">
      <UserAvatar nickname={entry.nickname} src={entry.avatar} alt="" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
          <Link
            href={profilePath(entry.nickname)}
            className={`${linkClass} font-medium`}
          >
            {entry.nickname}
          </Link>
          <LocalDate
            iso={entry.createdAt.toISOString()}
            relative
            className="text-muted-foreground"
          />
        </div>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          <Icon aria-hidden className="size-3.5" />
          {kind.label}
        </span>
        <p className="min-w-0 [overflow-wrap:anywhere]">
          {main}
          {entry.type !== "forumThread" && entry.book.adult && (
            <span className="ml-2 inline-block align-middle">
              <AdultBadge />
            </span>
          )}
        </p>
        {sub && (
          <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
            {sub}
          </p>
        )}
      </div>
      {entry.type !== "forumThread" && entry.book.cover && (
        <PublicCover
          cover={entry.book.cover}
          alt={tCovers("alt", { name: entry.book.name })}
          size="sm"
        />
      )}
    </li>
  );
}
