import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getSharedFolder } from "@/lib/folders/queries";

export const metadata: Metadata = {
  title: "Story App",
  robots: { index: false, follow: false },
};

export default async function SharedFolderPage({
  params,
}: PageProps<"/s/f/[token]">) {
  // Without a request-time API the page could be cached, and the link would outlive "Stop sharing".
  await connection();
  const { token } = await params;
  const folder = await getSharedFolder(token);
  if (!folder) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">{folder.name}</h1>
      {folder.chapters.length === 0 ? (
        <p className="text-muted-foreground">No chapters yet.</p>
      ) : (
        <ol aria-label="Chapters" className="flex flex-col gap-2">
          {folder.chapters.map((chapter, index) => (
            <li key={index}>
              <Link
                href={`/s/f/${token}/${index + 1}`}
                className="hover:underline"
              >
                {index + 1}. {chapter.title}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
