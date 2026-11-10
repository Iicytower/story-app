import type { Metadata } from "next";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { after } from "next/server";
import { AdultBadge } from "@/components/adult";
import { CoverImage } from "@/components/cover";
import { LocalDate } from "@/components/local-date";
import { TagChips } from "@/components/tag-chips";
import { SortableList } from "@/components/sortable-list";
import { requireUser } from "@/lib/auth/session";
import { retryDueCovers } from "@/lib/covers/mutations";
import { getFolder, listFolders } from "@/lib/folders/queries";
import { folderPublicPath, listPublicTags } from "@/lib/publish/queries";
import { buildSnippet } from "@/lib/stories/search";
import { listUserTags } from "@/lib/tags/queries";
import { toolsConfig } from "@/lib/tools/client";
import { listFolderVersions } from "@/lib/versions/queries";
import { moveChapter } from "../../stories/actions";
import { ChapterMenu } from "./chapter-menu";
import { CoverRejected } from "./cover-rejected";
import { FolderMenu } from "./folder-menu";
import { FolderNotes } from "./folder-notes";
import { FolderPublicLink } from "./folder-public-link";
import { FolderVersions } from "./versions/folder-versions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("folder") };
}

export default async function FolderPage({
  params,
}: PageProps<"/[locale]/folders/[id]">) {
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });

  const { id } = await params;
  const [folder, { folders }, userTags, publicTags] = await Promise.all([
    getFolder(user.userId, id),
    listFolders(user.userId),
    listUserTags(user.userId),
    listPublicTags(),
  ]);
  if (!folder) notFound();
  const tagOptions = { own: userTags, known: publicTags };
  after(() => retryDueCovers());
  const versions = await listFolderVersions(user.userId, folder.id);
  const otherFolders = folders.filter((other) => other.id !== folder.id);
  const publicPath = folder.published
    ? await folderPublicPath(user.userId, folder.id)
    : null;
  const unpublishedCount = folder.chapters.filter(
    ({ publication }) => publication !== "public",
  ).length;
  const t = await getTranslations("folders");
  const tCovers = await getTranslations("covers");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex gap-4">
        {folder.cover && (
          <CoverImage
            path={folder.cover.path}
            alt={tCovers("alt", { name: folder.name })}
            size="md"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            href="/stories"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            {t("allFolders")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{folder.name}</h1>
            {folder.adult.adult && <AdultBadge />}
            <span className="mr-auto" />
            <FolderMenu
              folder={{
                id: folder.id,
                name: folder.name,
                tags: folder.tags ?? [],
                chapterSort: folder.chapterSort,
                language: folder.language,
                chapterCount: folder.chapters.length,
              }}
              folders={folders.map(({ name, language }) => ({
                name,
                language,
              }))}
              tagOptions={tagOptions}
              isPublic={Boolean(folder.published)}
              adult={folder.adult}
              unpublishedCount={unpublishedCount}
              commentsDisabled={folder.commentsDisabled}
              cover={
                toolsConfig()
                  ? { current: folder.cover, pending: folder.coverPending }
                  : undefined
              }
            />
            {publicPath && <FolderPublicLink publicPath={publicPath} />}
          </div>
          <TagChips tags={folder.tags} />
          {folder.coverRejected && <CoverRejected folderId={folder.id} />}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        {folder.chapters.length === 0 ? (
          <p className="text-muted-foreground">{t("noChapters")}</p>
        ) : (
          <SortableList
            label={t("chapters")}
            sortable={folder.chapterSort === "manual"}
            action={moveChapter}
            className="flex h-fit flex-col divide-y rounded-lg border"
            itemClassName="flex items-center gap-1 pr-3"
            items={folder.chapters.map((chapter) => {
              const snippet = buildSnippet(chapter.content);
              return {
                id: chapter.id,
                name: chapter.title,
                content: (
                  <>
                    <Link
                      href={`/stories/${chapter.id}`}
                      className="hover:bg-muted/50 flex min-w-0 flex-1 flex-col gap-1 px-4 py-3"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{chapter.title}</span>
                        {chapter.adult.adult && <AdultBadge />}
                      </span>
                      <span className="text-muted-foreground line-clamp-2 text-sm">
                        {snippet.before}
                      </span>
                      <TagChips tags={chapter.tags} folderTags={folder.tags} />
                      <span className="text-muted-foreground text-xs">
                        <LocalDate iso={chapter.updatedAt} />
                      </span>
                    </Link>
                    <ChapterMenu
                      id={chapter.id}
                      title={chapter.title}
                      tags={chapter.tags ?? []}
                      folderTags={folder.tags ?? []}
                      tagOptions={tagOptions}
                      isPublic={
                        Boolean(folder.published) &&
                        chapter.publication === "public"
                      }
                      adult={chapter.adult}
                      otherFolders={otherFolders.map(({ id, name }) => ({
                        id,
                        name,
                      }))}
                    />
                  </>
                ),
              };
            })}
          />
        )}
        <div className="flex flex-col gap-6">
          <FolderNotes
            key={folder.id}
            folderId={folder.id}
            initialNotes={folder.notes}
            initialNotesUpdatedAt={folder.notesUpdatedAt}
            lang={folder.language}
          />
          <FolderVersions folderId={folder.id} versions={versions} />
        </div>
      </div>
    </div>
  );
}
