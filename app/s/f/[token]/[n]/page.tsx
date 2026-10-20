import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MarkdownPreview } from "@/components/markdown-preview";
import { getSharedChapter } from "@/lib/folders/queries";
import { stripComments } from "@/lib/stories/strip-comments";

export const metadata: Metadata = {
  title: "Story App",
  robots: { index: false, follow: false },
};

export default async function SharedChapterPage({
  params,
}: PageProps<"/s/f/[token]/[n]">) {
  await connection();
  const { token, n } = await params;
  const chapter = /^\d+$/.test(n)
    ? await getSharedChapter(token, Number(n))
    : null;
  if (!chapter) notFound();

  const nav = (
    <nav
      aria-label="Chapters"
      className="text-muted-foreground flex items-center gap-4 text-sm"
    >
      {chapter.previous && (
        <Link href={`/s/f/${token}/${chapter.previous.n}`} rel="prev">
          ← {chapter.previous.title}
        </Link>
      )}
      <Link href={`/s/f/${token}`} className="mx-auto">
        Contents
      </Link>
      {chapter.next && (
        <Link href={`/s/f/${token}/${chapter.next.n}`} rel="next">
          {chapter.next.title} →
        </Link>
      )}
    </nav>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <p className="text-muted-foreground text-sm">{chapter.folderName}</p>
      <h1 className="-mt-6 text-3xl font-bold">{chapter.title}</h1>
      <MarkdownPreview content={stripComments(chapter.content)} />
      {nav}
    </main>
  );
}
