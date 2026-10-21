import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getEditorFolder } from "@/lib/folders/queries";
import { getUserSettings } from "@/lib/settings/queries";
import { getStory } from "@/lib/stories/queries";
import { Editor } from "./editor";

export const metadata: Metadata = { title: "Editor – Story App" };

export default async function StoryPage({
  params,
}: PageProps<"/stories/[id]">) {
  const user = await requireUser();
  if (!user.ok) redirect("/login");

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
