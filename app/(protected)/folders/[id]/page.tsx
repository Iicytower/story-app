import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LocalDate } from "@/components/local-date";
import { requireUser } from "@/lib/auth/session";
import { getFolder, listFolders } from "@/lib/folders/queries";
import { buildSnippet } from "@/lib/stories/search";
import { listFolderVersions } from "@/lib/versions/queries";
import { CreateStoryDialog } from "../../stories/create-story-dialog";
import { reorderChapter } from "../../stories/actions";
import { DeleteStoryButton } from "../../stories/delete-story-button";
import { ImportDialog } from "../../stories/import-dialog";
import { setChapterSort } from "../actions";
import { ReorderButtons } from "../reorder-buttons";
import { SortSelect } from "../sort-select";
import { DeleteFolderButton } from "./delete-folder-button";
import { FolderNotes } from "./folder-notes";
import { FolderShare } from "./folder-share";
import { MoveStoryDialog } from "./move-story-dialog";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { FolderVersions } from "./versions/folder-versions";

const SORT_OPTIONS = [
  { value: "created", label: "Newest first" },
  { value: "manual", label: "Manual" },
  { value: "alpha", label: "A–Z" },
];

export const metadata: Metadata = { title: "Folder – Story App" };

export default async function FolderPage({
  params,
}: PageProps<"/folders/[id]">) {
  const user = await requireUser();
  if (!user.ok) redirect("/login");

  const { id } = await params;
  const [folder, { folders }] = await Promise.all([
    getFolder(user.userId, id),
    listFolders(user.userId),
  ]);
  if (!folder) notFound();
  const versions = await listFolderVersions(user.userId, folder.id);
  const otherFolders = folders.filter((other) => other.id !== folder.id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/stories"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← All folders
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-semibold">{folder.name}</h1>
          <SortSelect
            label="Sort chapters"
            value={folder.chapterSort}
            options={SORT_OPTIONS}
            action={setChapterSort.bind(null, folder.id)}
          />
          <FolderShare id={folder.id} shareToken={folder.shareToken} />
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
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        {folder.chapters.length === 0 ? (
          <p className="text-muted-foreground">
            No chapters yet. Create the first one.
          </p>
        ) : (
          <ul
            aria-label="Chapters"
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
