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
import { ADULT_COOKIE } from "@/lib/adult/gate";
import { getPublishedFolder } from "@/lib/publish/queries";
import { BlurredCover } from "./adult-cover";

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

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      {cover && (
        <div className="mb-6">
          {cover.adult && !confirmed ? (
            <BlurredCover path={cover.path} alt={coverAlt} />
          ) : (
            <CoverImage path={cover.path} alt={coverAlt} size="lg" />
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">{folder.name}</h1>
        {folder.adult && <AdultBadge />}
      </div>
      <p className="text-muted-foreground mb-8 text-sm">
        {t("by", { nickname: folder.nickname })}
      </p>
      <ol aria-label={t("chapters")} className="flex flex-col gap-2">
        {folder.chapters.map((chapter, index) => (
          <li key={chapter.path} className="flex items-center gap-2">
            <Link href={chapter.path} className="hover:underline">
              {index + 1}. {chapter.title}
            </Link>
            {chapter.adult && !folder.adult && <AdultBadge />}
          </li>
        ))}
      </ol>
    </main>
  );
}
