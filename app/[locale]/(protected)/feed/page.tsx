import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { after, connection } from "next/server";
import { ChevronRight, ChevronsUp, Newspaper } from "lucide-react";
import { FeedEntry } from "@/components/feed-entry";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { retryDueCovers } from "@/lib/covers/mutations";
import { getFeed, parseFeedCursor } from "@/lib/social/feed";
import { PageContainer } from "@/components/page-container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("feed") };
}

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

  return (
    <PageContainer width="narrow">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {entries.length === 0 && !cursor && !next ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center">
          <Newspaper aria-hidden className="text-muted-foreground size-10" />
          <p className="text-muted-foreground max-w-prose">{t("empty")}</p>
          <Button asChild variant="outline">
            <Link href="/">{t("emptyLink")}</Link>
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground">{t("noOlder")}</p>
      ) : (
        <ul aria-label={t("entries")} className="flex flex-col gap-3">
          {entries.map((entry) => (
            <FeedEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
      {(cursor || next) && (
        <nav aria-label={t("pages")} className="flex flex-wrap gap-2">
          {cursor && (
            <Button asChild variant="outline">
              <Link href="/feed">
                <ChevronsUp aria-hidden />
                {t("newest")}
              </Link>
            </Button>
          )}
          {next && (
            <Button asChild variant="outline" className="ml-auto">
              <Link href={{ pathname: "/feed", query: { after: next } }}>
                {t("older")}
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          )}
        </nav>
      )}
    </PageContainer>
  );
}
