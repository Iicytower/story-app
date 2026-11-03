import type { Metadata } from "next";
import Form from "next/form";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { LocalDate } from "@/components/local-date";
import { TagChips } from "@/components/tag-chips";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { listFolders } from "@/lib/folders/queries";
import { listStories } from "@/lib/stories/queries";
import { buildSnippet } from "@/lib/stories/search";
import { listUserTags } from "@/lib/tags/queries";
import { parseTagFilter, tagFilterHref } from "@/lib/tags/tags";
import { reorderFolder, setFolderSort } from "../folders/actions";
import { CreateFolderDialog } from "../folders/create-folder-dialog";
import { ReorderButtons } from "../folders/reorder-buttons";
import { SortSelect } from "../folders/sort-select";
import { CreateStoryDialog } from "./create-story-dialog";
import { DeleteStoryButton } from "./delete-story-button";
import { ImportDialog } from "./import-dialog";

const SORT_OPTIONS = [
  { value: "updated", label: "Last updated" },
  { value: "manual", label: "Manual" },
  { value: "alpha", label: "A–Z" },
];

export const metadata: Metadata = { title: "Stories – Story App" };

export default async function StoriesPage({
  searchParams,
}: PageProps<"/[locale]/stories">) {
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });

  const { q, tag } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const selectedTags = parseTagFilter(tag);
  const [{ sort, folders }, userTags] = await Promise.all([
    listFolders(user.userId),
    listUserTags(user.userId),
  ]);
  // A selected tag that no longer exists stays visible, so it can be turned off.
  const filterTags = [...new Set([...userTags, ...selectedTags])];
  // The most recently active folder, whatever order the list is shown in.
  const defaultFolder = folders.reduce<(typeof folders)[number] | undefined>(
    (latest, folder) =>
      !latest || folder.lastActivityAt > latest.lastActivityAt
        ? folder
        : latest,
    undefined,
  );

  const searchPath = getPathname({
    href: "/stories",
    locale: await getLocale(),
  });
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Folders</h1>
        <SortSelect
          label="Sort folders"
          value={sort}
          options={SORT_OPTIONS}
          action={setFolderSort}
        />
        <CreateFolderDialog />
        <ImportDialog
          folderNames={folders.map((folder) => folder.name)}
          defaultFolder={defaultFolder?.name ?? ""}
        />
        <CreateStoryDialog
          folderNames={folders.map((folder) => folder.name)}
          defaultFolder={defaultFolder?.name ?? ""}
        />
      </div>
      <Form action={searchPath} role="search">
        <Input
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search title and content in all folders, press Enter"
          aria-label="Search stories"
        />
        {selectedTags.map((selected) => (
          <input key={selected} type="hidden" name="tag" value={selected} />
        ))}
      </Form>
      {filterTags.length > 0 && (
        <nav aria-label="Filter by tag" className="flex flex-wrap gap-1">
          {filterTags.map((filterTag) => {
            const active = selectedTags.includes(filterTag);
            return (
              <Link
                key={filterTag}
                href={tagFilterHref(query, selectedTags, filterTag)}
                aria-current={active ? "true" : undefined}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/70"
                }`}
              >
                {filterTag}
              </Link>
            );
          })}
        </nav>
      )}
      {query || selectedTags.length > 0 ? (
        <SearchResults userId={user.userId} query={query} tags={selectedTags} />
      ) : folders.length === 0 ? (
        <p className="text-muted-foreground">
          No folders yet. Create a folder or a new story.
        </p>
      ) : (
        <ul
          aria-label="Folders"
          className="flex flex-col divide-y rounded-lg border"
        >
          {folders.map((folder, index) => (
            <li key={folder.id} className="flex items-center gap-1 pr-3">
              <Link
                href={`/folders/${folder.id}`}
                className="hover:bg-muted/50 flex min-w-0 flex-1 items-baseline gap-4 px-4 py-3"
              >
                <span className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium">{folder.name}</span>
                  <TagChips tags={folder.tags} />
                </span>
                <span className="text-muted-foreground text-sm">
                  {folder.chapterCount}{" "}
                  {folder.chapterCount === 1 ? "chapter" : "chapters"}
                </span>
                <span className="text-muted-foreground w-28 text-right text-sm">
                  <LocalDate iso={folder.lastActivityAt} />
                </span>
              </Link>
              {sort === "manual" && (
                <ReorderButtons
                  name={folder.name}
                  isFirst={index === 0}
                  isLast={index === folders.length - 1}
                  action={reorderFolder.bind(null, folder.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function SearchResults({
  userId,
  query,
  tags,
}: {
  userId: string;
  query: string;
  tags: string[];
}) {
  const stories = await listStories(userId, query, tags);
  if (stories.length === 0) {
    return (
      <p className="text-muted-foreground">
        {query
          ? `No stories match "${query}"${tags.length > 0 ? " with the selected tags" : ""}.`
          : "No stories have the selected tags."}
      </p>
    );
  }
  return (
    <ul
      aria-label="Search results"
      className="flex flex-col divide-y rounded-lg border"
    >
      {stories.map((story) => {
        const snippet = buildSnippet(story.content, query);
        return (
          <li key={story.id} className="flex items-center gap-2 pr-3">
            <Link
              href={`/stories/${story.id}`}
              className="hover:bg-muted/50 flex min-w-0 flex-1 flex-col gap-1 px-4 py-3"
            >
              <span className="flex items-baseline gap-2">
                <span className="font-medium">{story.title}</span>
                <span className="text-muted-foreground text-xs">
                  in {story.folderName}
                </span>
              </span>
              <span className="text-muted-foreground line-clamp-2 text-sm">
                {snippet.before}
                {snippet.match && (
                  <mark className="text-foreground rounded-sm bg-yellow-200 dark:bg-yellow-500/40">
                    {snippet.match}
                  </mark>
                )}
                {snippet.after}
              </span>
              <TagChips tags={story.tags} folderTags={story.folderTags} />
            </Link>
            <DeleteStoryButton id={story.id} title={story.title} />
          </li>
        );
      })}
    </ul>
  );
}
