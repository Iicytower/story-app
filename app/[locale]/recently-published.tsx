import { getLocale, getTranslations } from "next-intl/server";
import { listRecentlyPublished } from "@/lib/publish/queries";
import { formatPublishedAt } from "@/lib/publish/published-date";
import { RecentList } from "./recent-list";

// Reads no chapter text for a query, so it does not use up the search limit.
export async function RecentlyPublished() {
  const [chapters, locale, t, tSearch, tCovers] = await Promise.all([
    listRecentlyPublished(),
    getLocale(),
    getTranslations("home"),
    getTranslations("search"),
    getTranslations("covers"),
  ]);
  const now = new Date();
  return (
    <section
      aria-labelledby="recently-published"
      className="flex flex-col gap-4"
    >
      <h2 id="recently-published" className="text-xl font-semibold">
        {t("recent")}
      </h2>
      {chapters.length === 0 ? (
        <p className="text-muted-foreground">{t("recentNone")}</p>
      ) : (
        <RecentList
          label={t("recent")}
          showMore={t("showMore")}
          chapters={chapters.map(
            ({ folderName, nickname, publishedAt, ...chapter }) => ({
              ...chapter,
              byline: tSearch("inFolderBy", { folder: folderName, nickname }),
              coverAlt: tCovers("alt", { name: folderName }),
              date: {
                iso: publishedAt.toISOString(),
                text: formatPublishedAt(publishedAt, now, locale),
              },
            }),
          )}
        />
      )}
    </section>
  );
}
