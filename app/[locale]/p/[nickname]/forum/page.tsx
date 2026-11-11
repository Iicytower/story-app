import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { ForumShell, forumViewer } from "@/components/forum/forum-shell";
import { ThreadList } from "@/components/forum/forum-views";
import { redirect } from "@/i18n/navigation";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { authorForumPath, findAuthorForum } from "@/lib/social/forums";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]/forum">): Promise<Metadata> {
  const { nickname } = await params;
  const [place, t] = await Promise.all([
    findAuthorForum(await forumViewer(), nickname),
    getTranslations(),
  ]);
  if (!place) return { title: t("common.appName") };
  return {
    title: t("forums.pageTitle", {
      title: t("forums.authorForum", { nickname: place.nickname }),
    }),
    alternates: languageAlternates(
      await requestOrigin(),
      authorForumPath(place.nickname),
    ),
  };
}

// Every account with a nickname and a public book has one (task 87); otherwise 404.
export default async function AuthorForumPage({
  params,
}: PageProps<"/[locale]/p/[nickname]/forum">) {
  await connection();
  const { nickname } = await params;
  const viewerId = await forumViewer();
  const place = await findAuthorForum(viewerId, nickname);
  if (!place) notFound();
  if (place.nickname !== nickname) {
    redirect({
      href: authorForumPath(place.nickname),
      locale: await getLocale(),
    });
  }
  const t = await getTranslations("forums");
  return (
    <ForumShell viewerId={viewerId}>
      <ThreadList
        viewerId={viewerId}
        place={place}
        title={t("authorForum", { nickname: place.nickname })}
        path={authorForumPath(place.nickname)}
      />
    </ForumShell>
  );
}
