import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { after, connection } from "next/server";
import type { ReactNode } from "react";
import { AdultBadge } from "@/components/adult";
import { PublicCover } from "@/components/cover";
import { Button } from "@/components/ui/button";
import { profilePath } from "@/components/user-link";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { retryDueCovers } from "@/lib/covers/mutations";
import { formatPublishedAt } from "@/lib/publish/published-date";
import { getFeed, parseFeedCursor } from "@/lib/social/feed";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("feed") };
}

const linkClass =
  "font-medium [overflow-wrap:anywhere] underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-current";

export default async function FeedPage({
  searchParams,
}: PageProps<"/[locale]/feed">) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale });
  after(() => retryDueCovers());
  const { after: afterParam } = await searchParams;
  const cursor = parseFeedCursor(afterParam);
  const { entries, next } = await getFeed(user.userId, cursor);
  const t = await getTranslations("feed");
  const tCovers = await getTranslations("covers");
  const now = new Date();
  const fullDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    // The long time style names the zone: the server renders in UTC.
    timeStyle: "long",
    timeZone: "UTC",
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {entries.length === 0 && !cursor && !next ? (
        <p className="text-muted-foreground">
          {t("empty")}{" "}
          <Link
            href="/"
            className="text-foreground underline underline-offset-4"
          >
            {t("emptyLink")}
          </Link>
        </p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground">{t("noOlder")}</p>
      ) : (
        <ul aria-label={t("entries")} className="flex flex-col gap-4">
          {entries.map((entry) => {
            const [single] = entry.chapters;
            const tags = {
              author: (chunks: ReactNode) => (
                <Link href={profilePath(entry.nickname)} className={linkClass}>
                  {chunks}
                </Link>
              ),
              chapter: (chunks: ReactNode) => (
                <Link href={single.path} className={linkClass}>
                  {chunks}
                </Link>
              ),
              book: (chunks: ReactNode) => (
                <Link href={entry.book.path} className={linkClass}>
                  {chunks}
                </Link>
              ),
            };
            return (
              <li
                key={entry.id}
                className="flex min-w-0 items-start gap-3 border-b pb-4"
              >
                {entry.book.cover && (
                  <PublicCover
                    cover={entry.book.cover}
                    alt={tCovers("alt", { name: entry.book.name })}
                    size="sm"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="min-w-0 [overflow-wrap:anywhere]">
                    {entry.chapters.length === 1
                      ? t.rich("chapterPublished", {
                          ...tags,
                          nickname: entry.nickname,
                          title: single.title,
                          bookName: entry.book.name,
                        })
                      : t.rich("chaptersPublished", {
                          ...tags,
                          nickname: entry.nickname,
                          count: entry.chapters.length,
                          bookName: entry.book.name,
                        })}
                    {entry.book.adult && (
                      <span className="ml-2 inline-block align-middle">
                        <AdultBadge />
                      </span>
                    )}
                  </p>
                  <time
                    dateTime={entry.createdAt.toISOString()}
                    title={fullDate.format(entry.createdAt)}
                    className="text-muted-foreground text-sm"
                  >
                    {formatPublishedAt(entry.createdAt, now, locale)}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(cursor || next) && (
        <nav aria-label={t("pages")} className="flex flex-wrap gap-2">
          {cursor && (
            <Button asChild variant="outline">
              <Link href="/feed">{t("newest")}</Link>
            </Button>
          )}
          {next && (
            <Button asChild variant="outline">
              <Link href={{ pathname: "/feed", query: { after: next } }}>
                {t("older")}
              </Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
