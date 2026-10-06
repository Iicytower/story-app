import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MarkdownPreview } from "@/components/markdown-preview";
import { getSharedStory } from "@/lib/stories/queries";
import { stripComments } from "@/lib/stories/strip-comments";

export const metadata: Metadata = {
  title: "Story App",
  robots: { index: false, follow: false },
};

export default async function SharedStoryPage({
  params,
}: PageProps<"/s/[token]">) {
  // Without a request-time API the page could be cached, and the link would outlive "Stop sharing".
  await connection();
  const { token } = await params;
  const story = await getSharedStory(token);
  if (!story) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">{story.title}</h1>
      <MarkdownPreview content={stripComments(story.content)} />
    </main>
  );
}
