import { getTranslations } from "next-intl/server";
import { getHomeRankings } from "@/lib/social/ranking-queries";
import { HomeCarousel, type CardItem } from "./home-carousel";

// Under "Recently published" (D54); it runs no search, so the search limit stays untouched.
export async function Rankings({ viewerId }: { viewerId: string | null }) {
  const [rankings, t, tCovers] = await Promise.all([
    getHomeRankings(viewerId),
    getTranslations("home"),
    getTranslations("covers"),
  ]);
  const books = (list: typeof rankings.weekly): CardItem[] =>
    list.map((book) => ({
      path: book.path,
      title: book.name,
      byline: t("byAuthor", { nickname: book.nickname }),
      adult: book.adult,
      cover: book.cover,
      coverAlt: tCovers("alt", { name: book.name }),
    }));

  return (
    <>
      <HomeCarousel
        id="ranking-weekly"
        title={t("weekly")}
        items={books(rankings.weekly)}
      />
      <HomeCarousel
        id="ranking-top-rated"
        title={t("topRated")}
        items={books(rankings.topRated)}
      />
    </>
  );
}
