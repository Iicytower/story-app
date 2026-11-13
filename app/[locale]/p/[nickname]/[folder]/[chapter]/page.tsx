import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { after, connection } from "next/server";
import { retryDueCovers } from "@/lib/covers/mutations";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { AdultBadge } from "@/components/adult";
import { AppShell } from "@/components/app-shell";
import { CoverImage } from "@/components/cover";
import { MarkdownPreview } from "@/components/markdown-preview";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { ADULT_COOKIE } from "@/lib/adult/gate";
import { requireUser } from "@/lib/auth/session";
import { getPublishedChapter, publishedChapterId } from "@/lib/publish/queries";
import { listChapterMarks, MARK_PARAM } from "@/lib/reading/marks";
import { CONTINUE_PARAM, savedPosition } from "@/lib/reading/queries";
import { COMMENTS_PARAM } from "@/lib/social/comments";
import { chapterReader, recordRead } from "@/lib/social/read-stats";
import { ownsPlace } from "@/lib/social/visibility";
import { stripComments } from "@/lib/stories/strip-comments";
import { ReportButton } from "@/components/report-dialog";
import { BlurredCover } from "../adult-cover";
import { PublicBreadcrumb } from "../../breadcrumb";
import { GuestTopBar } from "../../guest-top-bar";
import { Comments } from "../comments";
import { ChapterReactions } from "../reactions";
import { RatingSection } from "../ratings";
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
  // Behind the 18+ gate the reactions and comments wait with the text.
  const place = gated ? null : await publishedChapterId(nickname, folder, slug);
  const text = <MarkdownPreview content={stripComments(chapter.content)} />;
  const own =
    place !== null &&
    (await ownsPlace(viewer.ok ? viewer.userId : null, {
      type: "story",
      id: place.storyId,
    }));
  const tReports = await getTranslations("reports");
  // headers() is not available in after(), so the reader is known before it.
  const reader = place
    ? chapterReader(
        viewer.ok ? viewer.userId : null,
        place.authorId,
        await headers(),
      )
    : null;
  if (place && reader) {
    const { storyId, folderId, authorId } = place;
    after(() => recordRead({ storyId, folderId, authorId, reader }));
  }

  const content = (
    <PageContainer width="narrow" className="gap-8">
      <div className="flex flex-col gap-3">
        <PublicBreadcrumb
          nickname={chapter.nickname}
          folder={{ name: chapter.folderName, path: chapter.folderPath }}
        />
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold [overflow-wrap:anywhere]">
            {chapter.title}
          </h1>
          {chapter.adult && <AdultBadge />}
        </div>
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
      {/* Right under the text, before the reactions and ratings (D83). */}
      <nav
        aria-label={t("chapters")}
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
      >
        {chapter.previous && (
          <Button asChild variant="outline">
            <Link
              href={chapter.previous.path}
              rel="prev"
              title={chapter.previous.title}
            >
              <ArrowLeftIcon />
              {t("previous")}
            </Link>
          </Button>
        )}
        <Link
          href={chapter.folderPath}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {t("contents")}
        </Link>
        {chapter.next && (
          <Button asChild className="ml-auto">
            <Link
              href={chapter.next.path}
              rel="next"
              title={chapter.next.title}
            >
              {t("next")}
              <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </nav>
      {place && (
        <div className="flex flex-col gap-4">
          <ChapterReactions
            viewerId={viewer.ok ? viewer.userId : null}
            storyId={place.storyId}
            path={chapter.path}
          />
          <RatingSection
            viewerId={viewer.ok ? viewer.userId : null}
            target={{ type: "story", id: place.storyId }}
            path={chapter.path}
          />
          {!own && (
            <ReportButton
              target={viewer.ok ? { type: "story", id: place.storyId } : null}
              label={tReports("reportChapter")}
              callbackUrl={`/${await getLocale()}${chapter.path}`}
            />
          )}
        </div>
      )}
      {place && (
        <Comments
          viewerId={viewer.ok ? viewer.userId : null}
          target={place}
          path={chapter.path}
          after={query[COMMENTS_PARAM]}
        />
      )}
    </PageContainer>
  );

  return viewer.ok ? (
    <AppShell userId={viewer.userId}>{content}</AppShell>
  ) : (
    <main className="flex flex-1 flex-col">
      <GuestTopBar path={chapter.path} />
      {content}
    </main>
  );
}
