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
import { getPublishedChapter } from "@/lib/publish/queries";
import { stripComments } from "@/lib/stories/strip-comments";
import { BlurredCover } from "../adult-cover";
import { AdultGate } from "./adult-gate";

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
      ) : (
        <MarkdownPreview content={stripComments(chapter.content)} />
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
