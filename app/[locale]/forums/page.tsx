import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { ForumShell, forumViewer } from "@/components/forum/forum-shell";
import { Link } from "@/i18n/navigation";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import {
  categoryPath,
  FORUMS_PATH,
  listForumCategories,
} from "@/lib/social/forums";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("forums"),
    alternates: languageAlternates(await requestOrigin(), FORUMS_PATH),
  };
}

export default async function ForumsPage() {
  await connection();
  const viewerId = await forumViewer();
  const [categories, t, locale] = await Promise.all([
    listForumCategories(),
    getTranslations("forums"),
    getLocale(),
  ]);
  const lang = locale === "pl" ? "pl" : "en";
  return (
    <ForumShell viewerId={viewerId}>
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <ul aria-label={t("categories")} className="flex flex-col divide-y">
          {categories.map((category) => (
            <li key={category.key} className="py-3">
              <Link
                href={categoryPath(category.key)}
                className="font-medium [overflow-wrap:anywhere] hover:underline"
              >
                {category.labels[lang]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ForumShell>
  );
}
