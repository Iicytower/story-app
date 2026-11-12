import type { Metadata } from "next";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LocalDate } from "@/components/local-date";
import { requireUser } from "@/lib/auth/session";
import { getFolderVersion } from "@/lib/versions/queries";
import { RestoreForm } from "./restore-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("version") };
}

export default async function FolderVersionPage({
  params,
}: PageProps<"/[locale]/books/[id]/versions/[number]">) {
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });

  const { id, number } = await params;
  const version = /^\d+$/.test(number)
    ? await getFolderVersion(user.userId, id, Number(number))
    : null;
  if (!version) notFound();
  const t = await getTranslations("versions");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href={`/books/${version.folder.id}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {version.folder.name}
        </Link>
        <h1 className="text-2xl font-semibold">
          {t("versionName", { number: version.number, name: version.name })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t.rich("saved", {
            date: () => <LocalDate iso={version.createdAt} withTime />,
          })}
        </p>
      </div>
      <RestoreForm
        folderId={version.folder.id}
        number={version.number}
        comparison={version.comparison}
      />
    </div>
  );
}
