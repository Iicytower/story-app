import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { ForumShell, forumViewer } from "@/components/forum/forum-shell";
import { ThreadPage } from "@/components/forum/forum-views";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { getThread } from "@/lib/social/forums";

async function findThread(nickname: string, id: string) {
  const thread = await getThread(await forumViewer(), id);
  // The thread belongs to this author's forum; any other address is a 404.
  return thread?.place.scope === "author" &&
    thread.place.nickname.toLowerCase() === nickname.toLowerCase()
    ? thread
    : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]/forum/[thread]">): Promise<Metadata> {
  const { nickname, thread: id } = await params;
  const [thread, t] = await Promise.all([
    findThread(nickname, id),
    getTranslations(),
  ]);
  if (!thread) return { title: t("common.appName") };
  return {
    title: t("forums.pageTitle", { title: thread.title }),
    alternates: languageAlternates(await requestOrigin(), thread.path),
  };
}

export default async function AuthorThreadPage({
  params,
}: PageProps<"/[locale]/p/[nickname]/forum/[thread]">) {
  await connection();
  const { nickname, thread: id } = await params;
  const viewerId = await forumViewer();
  const thread = await findThread(nickname, id);
  if (!thread) notFound();
  return (
    <ForumShell viewerId={viewerId}>
      <ThreadPage viewerId={viewerId} thread={thread} />
    </ForumShell>
  );
}
