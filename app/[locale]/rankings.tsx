import { getLocale, getTranslations } from "next-intl/server";
import { AdultBadge } from "@/components/adult";
import { PublicCover } from "@/components/cover";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import type { CoverView } from "@/lib/covers/queries";
import { getHomeRankings } from "@/lib/social/ranking-queries";
import { labelOf } from "@/lib/tags/predefined";
import { listPredefinedTags } from "@/lib/tags/queries";

interface Item {
  path: string;
  title: string;
  byline: string;
  adult: boolean;
  cover: CoverView | null;
  coverAlt: string;
}

function RankingList({
  labelledBy,
  items,
}: {
  labelledBy: string;
  items: Item[];
}) {
  return (
    <ul
      aria-labelledby={labelledBy}
      className="flex flex-col divide-y rounded-lg border"
    >
      {items.map((item) => (
        <li key={item.path}>
          <Link
            href={item.path}
            className="hover:bg-muted/50 flex min-w-0 items-center gap-3 px-4 py-3 break-words"
          >
            {item.cover && (
              <PublicCover cover={item.cover} alt={item.coverAlt} size="sm" />
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                  {item.title}
                </span>
                {item.adult && <AdultBadge />}
              </span>
              <span className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
                {item.byline}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: Item[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      <RankingList labelledBy={id} items={items} />
    </section>
  );
}

// Under "Recently published" (D54); it runs no search, so the search limit stays untouched.
export async function Rankings({ viewerId }: { viewerId: string | null }) {
  const [rankings, predefined, locale, t, tCovers] = await Promise.all([
    getHomeRankings(viewerId),
    listPredefinedTags(),
    getLocale(),
    getTranslations("home"),
    getTranslations("covers"),
  ]);
  const books = (list: typeof rankings.weekly): Item[] =>
    list.map((book) => ({
      path: book.path,
      title: book.name,
      byline: t("byAuthor", { nickname: book.nickname }),
      adult: book.adult,
      cover: book.cover,
      coverAlt: tCovers("alt", { name: book.name }),
    }));
  const tags = rankings.tags
    .map(({ key, books: list }) => ({
      key,
      label: labelOf(key, predefined, locale as Locale) ?? key,
      items: books(list),
    }))
    .toSorted((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <>
      <Section
        id="ranking-weekly"
        title={t("weekly")}
        items={books(rankings.weekly)}
      />
      <Section
        id="ranking-top-rated"
        title={t("topRated")}
        items={books(rankings.topRated)}
      />
      {rankings.followed && (
        <Section
          id="ranking-followed"
          title={t("followed")}
          items={rankings.followed.map((chapter) => ({
            path: chapter.path,
            title: chapter.title,
            byline: t("chapterIn", {
              book: chapter.book.name,
              nickname: chapter.book.nickname,
            }),
            adult: chapter.adult,
            cover: chapter.book.cover,
            coverAlt: tCovers("alt", { name: chapter.book.name }),
          }))}
        />
      )}
      {tags.length > 0 && (
        <section
          aria-labelledby="ranking-categories"
          className="flex flex-col gap-4"
        >
          <h2 id="ranking-categories" className="text-xl font-semibold">
            {t("categories")}
          </h2>
          {tags.map(({ key, label, items }, index) => (
            <div key={key} className="flex flex-col gap-2">
              {/* Tag keys may hold spaces, so ids use the position. */}
              <h3
                id={`ranking-category-${index}`}
                className="text-base font-medium"
              >
                {label}
              </h3>
              <RankingList
                labelledBy={`ranking-category-${index}`}
                items={items}
              />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
