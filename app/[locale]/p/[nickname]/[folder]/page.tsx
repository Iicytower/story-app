import type { Metadata } from "next";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublishedFolder } from "@/lib/publish/queries";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]/[folder]">): Promise<Metadata> {
  const { nickname, folder: slug } = await params;
  const folder = await getPublishedFolder(nickname, slug);
  return {
    title: folder ? `${folder.name} by ${folder.nickname}` : "Story App",
  };
}

export default async function PublishedFolderPage({
  params,
}: PageProps<"/[locale]/p/[nickname]/[folder]">) {
  // Without a request-time API the page could be cached and outlive "Unpublish".
  await connection();
  const { locale, nickname, folder: slug } = await params;
  const folder = await getPublishedFolder(nickname, slug);
  if (!folder) notFound();
  if (folder.path !== `/p/${nickname}/${slug}`)
    redirect({ href: folder.path, locale });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">{folder.name}</h1>
      <p className="text-muted-foreground mb-8 text-sm">by {folder.nickname}</p>
      <ol aria-label="Chapters" className="flex flex-col gap-2">
        {folder.chapters.map((chapter, index) => (
          <li key={chapter.path}>
            <Link href={chapter.path} className="hover:underline">
              {index + 1}. {chapter.title}
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
