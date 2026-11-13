import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { ForumShell, forumViewer } from "@/components/forum/forum-shell";
import { ThreadPage } from "@/components/forum/forum-views";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { getThread } from "@/lib/social/forums";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forums/t/[thread]">): Promise<Metadata> {
  const { thread: id } = await params;
  const [thread, t] = await Promise.all([
    getThread(await forumViewer(), id),
    getTranslations(),
  ]);
  if (!thread || thread.place.scope !== "global") {
    return { title: t("common.appName") };
  }
  return {
    title: t("forums.pageTitle", { title: thread.title }),
    alternates: languageAlternates(await requestOrigin(), thread.path),
  };
}

export default async function GlobalThreadPage({
  params,
}: PageProps<"/[locale]/forums/t/[thread]">) {
  await connection();
  const { thread: id } = await params;
  const viewerId = await forumViewer();
  const thread = await getThread(viewerId, id);
  if (!thread || thread.place.scope !== "global") notFound();
  return (
    <ForumShell viewerId={viewerId}>
      <ThreadPage viewerId={viewerId} thread={thread} />
    </ForumShell>
  );
}
