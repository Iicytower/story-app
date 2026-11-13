import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { ForumShell, forumViewer } from "@/components/forum/forum-shell";
import { ThreadList } from "@/components/forum/forum-views";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { categoryPath, findCategoryPlace } from "@/lib/social/forums";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forums/[category]">): Promise<Metadata> {
  const { category } = await params;
  const [place, t, locale] = await Promise.all([
    findCategoryPlace(category),
    getTranslations(),
    getLocale(),
  ]);
  if (!place) return { title: t("common.appName") };
  return {
    title: t("forums.pageTitle", {
      title: place.category.labels[locale === "pl" ? "pl" : "en"],
    }),
    alternates: languageAlternates(
      await requestOrigin(),
      categoryPath(category),
    ),
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/[locale]/forums/[category]">) {
  await connection();
  const { category } = await params;
  const [viewerId, place, locale] = await Promise.all([
    forumViewer(),
    findCategoryPlace(category),
    getLocale(),
  ]);
  if (!place) notFound();
  return (
    <ForumShell viewerId={viewerId}>
      <ThreadList
        viewerId={viewerId}
        place={place}
        title={place.category.labels[locale === "pl" ? "pl" : "en"]}
        path={categoryPath(category)}
      />
    </ForumShell>
  );
}
