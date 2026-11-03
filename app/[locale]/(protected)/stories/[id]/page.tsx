import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { getEditorFolder } from "@/lib/folders/queries";
import { getUserSettings } from "@/lib/settings/queries";
import { getStory } from "@/lib/stories/queries";
import { Editor } from "./editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("editor") };
}

export default async function StoryPage({
  params,
}: PageProps<"/[locale]/stories/[id]">) {
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });

  const { id } = await params;
  const story = await getStory(user.userId, id);
  if (!story) notFound();
  const [folder, settings] = await Promise.all([
    story.folderName === null
      ? null
      : getEditorFolder(user.userId, story.folderId),
    getUserSettings(user.userId),
  ]);

  // Keyed by id: moving to another chapter must not keep this chapter's text in state.
  return (
    <Editor
      key={story.id}
      story={story}
      folder={folder}
      userId={user.userId}
      settings={settings.editor}
    />
  );
}
