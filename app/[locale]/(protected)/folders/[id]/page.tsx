import type { Metadata } from "next";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LocalDate } from "@/components/local-date";
import { TagChips } from "@/components/tag-chips";
import { TagsDialog } from "@/components/tags-dialog";
import { requireUser } from "@/lib/auth/session";
import { getFolder, listFolders } from "@/lib/folders/queries";
import { folderPublicPath } from "@/lib/publish/queries";
import { buildSnippet } from "@/lib/stories/search";
import { listUserTags } from "@/lib/tags/queries";
import { listFolderVersions } from "@/lib/versions/queries";
import { CreateStoryDialog } from "../../stories/create-story-dialog";
import { reorderChapter, setStoryTags } from "../../stories/actions";
import { DeleteStoryButton } from "../../stories/delete-story-button";
import { ImportDialog } from "../../stories/import-dialog";
import { setChapterSort, setFolderTags } from "../actions";
import { ReorderButtons } from "../reorder-buttons";
import { SortSelect } from "../sort-select";
import { DeleteFolderButton } from "./delete-folder-button";
import { FolderNotes } from "./folder-notes";
import { FolderPublish } from "./folder-publish";
import { MoveStoryDialog } from "./move-story-dialog";
import { PublishChapterButton } from "./publish-chapter-button";
import { RenameFolderDialog } from "./rename-folder-dialog";
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
  const [folder, { folders }, userTags] = await Promise.all([
    getFolder(user.userId, id),
    listFolders(user.userId),
    listUserTags(user.userId),
  ]);
  if (!folder) notFound();
  const versions = await listFolderVersions(user.userId, folder.id);
  const otherFolders = folders.filter((other) => other.id !== folder.id);
  const publicPath = folder.published
    ? await folderPublicPath(user.userId, folder.id)
    : null;
  const unpublishedCount = folder.chapters.filter(
    ({ publication }) => publication !== "public",
  ).length;
  const t = await getTranslations("folders");
  const sortOptions = [
    { value: "created", label: t("sortNewest") },
    { value: "manual", label: t("sortManual") },
    { value: "alpha", label: t("sortAlpha") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/stories"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {t("allFolders")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-semibold">{folder.name}</h1>
          <SortSelect
            label={t("sortChapters")}
            value={folder.chapterSort}
            options={sortOptions}
            action={setChapterSort.bind(null, folder.id)}
          />
          <TagsDialog
            name={folder.name}
            tags={folder.tags}
            suggestions={userTags}
            action={setFolderTags.bind(null, folder.id)}
          />
          <FolderPublish
            id={folder.id}
            publicPath={publicPath}
            unpublishedCount={unpublishedCount}
          />
          <RenameFolderDialog id={folder.id} name={folder.name} />
          <DeleteFolderButton
            id={folder.id}
            name={folder.name}
            chapterCount={folder.chapters.length}
          />
          <ImportDialog folderId={folder.id} />
          <CreateStoryDialog
            folderNames={folders.map((f) => f.name)}
            defaultFolder={folder.name}
          />
        </div>
        <TagChips tags={folder.tags} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        {folder.chapters.length === 0 ? (
          <p className="text-muted-foreground">{t("noChapters")}</p>
        ) : (
          <ul
            aria-label={t("chapters")}
            className="flex h-fit flex-col divide-y rounded-lg border"
          >
            {folder.chapters.map((chapter, index) => {
              const snippet = buildSnippet(chapter.content);
              return (
                <li key={chapter.id} className="flex items-center gap-1 pr-3">
                  <Link
                    href={`/stories/${chapter.id}`}
                    className="hover:bg-muted/50 flex min-w-0 flex-1 flex-col gap-1 px-4 py-3"
                  >
                    <span className="font-medium">{chapter.title}</span>
                    <span className="text-muted-foreground line-clamp-2 text-sm">
                      {snippet.before}
                    </span>
                    <TagChips tags={chapter.tags} folderTags={folder.tags} />
                    <span className="text-muted-foreground text-xs">
                      <LocalDate iso={chapter.updatedAt} />
                    </span>
                  </Link>
                  {folder.chapterSort === "manual" && (
                    <ReorderButtons
                      name={chapter.title}
                      isFirst={index === 0}
                      isLast={index === folder.chapters.length - 1}
                      action={reorderChapter.bind(null, chapter.id)}
                    />
                  )}
                  <PublishChapterButton
                    id={chapter.id}
                    title={chapter.title}
                    isPublic={
                      Boolean(folder.published) &&
                      chapter.publication === "public"
                    }
                  />
                  <TagsDialog
                    compact
                    name={chapter.title}
                    tags={chapter.tags}
                    folderTags={folder.tags}
                    suggestions={userTags}
                    action={setStoryTags.bind(null, chapter.id)}
                  />
                  <MoveStoryDialog
                    id={chapter.id}
                    title={chapter.title}
                    folders={otherFolders.map(({ id, name }) => ({ id, name }))}
                  />
                  <DeleteStoryButton id={chapter.id} title={chapter.title} />
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-col gap-6">
          <FolderNotes
            key={folder.id}
            folderId={folder.id}
            initialNotes={folder.notes}
            initialNotesUpdatedAt={folder.notesUpdatedAt}
          />
          <FolderVersions folderId={folder.id} versions={versions} />
        </div>
      </div>
    </div>
  );
}
