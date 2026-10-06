import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
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

  return <Editor story={story} />;
}
