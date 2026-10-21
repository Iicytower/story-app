import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LocalDate } from "@/components/local-date";
import { requireUser } from "@/lib/auth/session";
import { getFolderVersion } from "@/lib/versions/queries";
import { RestoreForm } from "./restore-form";

export const metadata: Metadata = { title: "Version – Story App" };

export default async function FolderVersionPage({
  params,
}: PageProps<"/folders/[id]/versions/[number]">) {
  const user = await requireUser();
  if (!user.ok) redirect("/login");

  const { id, number } = await params;
  const version = /^\d+$/.test(number)
    ? await getFolderVersion(user.userId, id, Number(number))
    : null;
  if (!version) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href={`/folders/${version.folder.id}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {version.folder.name}
        </Link>
        <h1 className="text-2xl font-semibold">
          Version {version.number}: {version.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Saved <LocalDate iso={version.createdAt} withTime />. Changes are
          shown from this version to the current text.
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
