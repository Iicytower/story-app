import type { Metadata } from "next";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { after, connection } from "next/server";
import { retryDueCovers } from "@/lib/covers/mutations";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { AdultBadge } from "@/components/adult";
import { CoverImage } from "@/components/cover";
import { Button } from "@/components/ui/button";
import { ADULT_COOKIE } from "@/lib/adult/gate";
import { requireUser } from "@/lib/auth/session";
import { libraryEntry, listShelves } from "@/lib/library/queries";
import {
  getPublishedFolder,
  publishedFolderId,
  publishedReaderChapters,
} from "@/lib/publish/queries";
import { folderReading } from "@/lib/reading/queries";
import { LibraryPicker } from "../../../(protected)/library/library-picker";
import { seedShelves } from "../../../(protected)/library/starter";
import { BlurredCover } from "./adult-cover";
import { GuestLibraryButton } from "./guest-library-button";

// The picker needs the reader's shelves, so its first opening of a book page creates them too.
async function libraryPicker(userId: string, nickname: string, slug: string) {
  const folderId = (await publishedFolderId(nickname, slug))!;
  await seedShelves(userId);
  const [shelves, shelfIds] = await Promise.all([
    listShelves(userId),
    libraryEntry(userId, folderId),
  ]);
  return { folderId, shelves, shelfIds };
}

async function readerState(userId: string, nickname: string, slug: string) {
  const { folderId, chapters } = (await publishedReaderChapters(
    nickname,
    slug,
  ))!;
  const reading = await folderReading(userId, folderId, chapters);
  const newIds = new Set(reading.newChapterIds);
  return {
    continueAt: reading.continueAt,
    newPaths: new Set(
      chapters.filter(({ id }) => newIds.has(id)).map(({ path }) => path),
    ),
  };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]/[folder]">): Promise<Metadata> {
  const { nickname, folder: slug } = await params;
  const folder = await getPublishedFolder(nickname, slug);
  const t = await getTranslations();
  if (!folder) return { title: t("common.appName") };
  return {
    title: t("public.titleBy", {
      title: folder.name,
      nickname: folder.nickname,
    }),
    alternates: languageAlternates(await requestOrigin(), folder.path),
  };
}

export default async function PublishedFolderPage({
  params,
}: PageProps<"/[locale]/p/[nickname]/[folder]">) {
  // Without a request-time API the page could be cached and outlive "Unpublish".
  await connection();
  after(() => retryDueCovers());
  const { nickname, folder: slug } = await params;
  const folder = await getPublishedFolder(nickname, slug);
  if (!folder) notFound();
  if (folder.path !== `/p/${nickname}/${slug}`)
    redirect({ href: folder.path, locale: await getLocale() });
  const t = await getTranslations("public");
  const tCovers = await getTranslations("covers");
  const confirmed = (await cookies()).get(ADULT_COOKIE)?.value === "1";
  const cover = folder.cover;
  const coverAlt = tCovers("alt", { name: folder.name });
  const viewer = await requireUser();
  const [picker, reader] = viewer.ok
    ? await Promise.all([
        libraryPicker(viewer.userId, nickname, slug),
        readerState(viewer.userId, nickname, slug),
      ])
    : [null, null];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      {cover && (
        <div className="mb-6">
          {cover.adult && !confirmed ? (
            <BlurredCover path={cover.path} alt={coverAlt} size="lg" />
          ) : (
            <CoverImage path={cover.path} alt={coverAlt} size="lg" />
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">{folder.name}</h1>
        {folder.adult && <AdultBadge />}
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        {t("by", { nickname: folder.nickname })}
      </p>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {picker ? (
          <LibraryPicker
            folderId={picker.folderId}
            shelves={picker.shelves}
            shelfIds={picker.shelfIds}
          />
        ) : (
          <GuestLibraryButton path={folder.path} />
        )}
        {reader?.continueAt && (
          <Button
            asChild
            variant="outline"
            className="h-auto max-w-full min-w-0 shrink py-2 [overflow-wrap:anywhere] whitespace-normal"
          >
            <Link href={reader.continueAt.path}>
              {t("continue", { title: reader.continueAt.title })}
            </Link>
          </Button>
        )}
      </div>
      <ol aria-label={t("chapters")} className="flex flex-col gap-2">
        {folder.chapters.map((chapter, index) => (
          <li key={chapter.path} className="flex items-center gap-2">
            <Link
              href={chapter.path}
              className="min-w-0 [overflow-wrap:anywhere] hover:underline"
            >
              {index + 1}. {chapter.title}
            </Link>
            {chapter.adult && !folder.adult && <AdultBadge />}
            {reader?.newPaths.has(chapter.path) && (
              <span className="bg-primary text-primary-foreground shrink-0 rounded-sm px-1.5 text-xs leading-5 font-medium">
                {t("newChapter")}
              </span>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
