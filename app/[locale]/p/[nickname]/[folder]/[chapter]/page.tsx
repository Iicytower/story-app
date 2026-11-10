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
import { MarkdownPreview } from "@/components/markdown-preview";
import { ADULT_COOKIE } from "@/lib/adult/gate";
import { requireUser } from "@/lib/auth/session";
import { getPublishedChapter, publishedChapterId } from "@/lib/publish/queries";
import { listChapterMarks, MARK_PARAM } from "@/lib/reading/marks";
import { CONTINUE_PARAM, savedPosition } from "@/lib/reading/queries";
import { stripComments } from "@/lib/stories/strip-comments";
import { BlurredCover } from "../adult-cover";
import { AdultGate } from "./adult-gate";
import { GuestMarks } from "./guest-marks";
import { ReaderMarks } from "./reader-marks";
import { ReadingTracker } from "./reading-tracker";

// Only a signed-in reader's position is saved; Continue reading also scrolls back to it. Their
// bookmarks and notes are private (task 74).
async function tracker(
  userId: string,
  nickname: string,
  folder: string,
  slug: string,
  resume: boolean,
) {
  const { folderId, storyId } = (await publishedChapterId(
    nickname,
    folder,
    slug,
  ))!;
  const [resumeAt, marks] = await Promise.all([
    resume ? savedPosition(userId, folderId, storyId) : null,
    listChapterMarks(userId, storyId),
  ]);
  return { storyId, resumeAt, marks };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]/[folder]/[chapter]">): Promise<Metadata> {
  const { nickname, folder, chapter: slug } = await params;
  const chapter = await getPublishedChapter(nickname, folder, slug);
  const t = await getTranslations();
  if (!chapter) return { title: t("common.appName") };
  return {
    title: t("public.titleBy", {
      title: chapter.title,
      nickname: chapter.nickname,
    }),
    alternates: languageAlternates(await requestOrigin(), chapter.path),
  };
}

export default async function PublishedChapterPage({
  params,
  searchParams,
}: PageProps<"/[locale]/p/[nickname]/[folder]/[chapter]">) {
  await connection();
  after(() => retryDueCovers());
  const { nickname, folder, chapter: slug } = await params;
  const chapter = await getPublishedChapter(nickname, folder, slug);
  if (!chapter) notFound();
  if (chapter.path !== `/p/${nickname}/${folder}/${slug}`) {
    redirect({ href: chapter.path, locale: await getLocale() });
  }
  const t = await getTranslations("public");
  const tCovers = await getTranslations("covers");
  const confirmed = (await cookies()).get(ADULT_COOKIE)?.value === "1";
  const gated = chapter.adult && !confirmed;
  const { cover } = chapter;
  const coverAlt = tCovers("alt", { name: chapter.folderName });
  const viewer = await requireUser();
  const query = await searchParams;
  const reading =
    viewer.ok && !gated
      ? await tracker(
          viewer.userId,
          nickname,
          folder,
          slug,
          query[CONTINUE_PARAM] !== undefined,
        )
      : null;
  const focusMark = query[MARK_PARAM];
  const text = <MarkdownPreview content={stripComments(chapter.content)} />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <p className="text-muted-foreground text-sm">
        {t("folderBy", {
          folder: chapter.folderName,
          nickname: chapter.nickname,
        })}
      </p>
      <div className="-mt-6 flex items-center gap-3">
        <h1 className="text-3xl font-bold">{chapter.title}</h1>
        {chapter.adult && <AdultBadge />}
      </div>
      {cover &&
        (cover.adult && !confirmed ? (
          <BlurredCover path={cover.path} alt={coverAlt} size="md" />
        ) : (
          <CoverImage path={cover.path} alt={coverAlt} size="md" />
        ))}
      {gated ? (
        <AdultGate backPath={chapter.folderPath} />
      ) : reading ? (
        <ReaderMarks
          // Another chapter of the book starts with its own marks.
          key={reading.storyId}
          initialMarks={reading.marks}
          storyId={reading.storyId}
          focusId={typeof focusMark === "string" ? focusMark : null}
        >
          {text}
        </ReaderMarks>
      ) : viewer.ok ? (
        text
      ) : (
        <>
          {text}
          <GuestMarks path={chapter.path} />
        </>
      )}
      {reading && (
        <ReadingTracker storyId={reading.storyId} resumeAt={reading.resumeAt} />
      )}
      <nav
        aria-label={t("chapters")}
        className="text-muted-foreground flex items-center gap-4 text-sm"
      >
        {chapter.previous && (
          <Link href={chapter.previous.path} rel="prev">
            ← {chapter.previous.title}
          </Link>
        )}
        <Link href={chapter.folderPath} className="mx-auto">
          {t("contents")}
        </Link>
        {chapter.next && (
          <Link href={chapter.next.path} rel="next">
            {chapter.next.title} →
          </Link>
        )}
      </nav>
    </main>
  );
}
