import type { Metadata } from "next";
import Form from "next/form";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { LocalDate } from "@/components/local-date";
import { SortableList } from "@/components/sortable-list";
import { AdultBadge } from "@/components/adult";
import { CoverImage } from "@/components/cover";
import { TagChips } from "@/components/tag-chips";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { retryDueCovers } from "@/lib/covers/mutations";
import { listFolders } from "@/lib/folders/queries";
import { listStories } from "@/lib/stories/queries";
import { buildSnippet } from "@/lib/stories/search";
import { listUserTags } from "@/lib/tags/queries";
import { parseTagFilter, tagFilterHref } from "@/lib/tags/tags";
import { moveFolder } from "../folders/actions";
import { FolderRowMenu } from "../folders/folder-row-menu";
import { StoriesMenu } from "./stories-menu";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("stories") };
}

export default async function StoriesPage({
  searchParams,
}: PageProps<"/[locale]/stories">) {
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });
  after(() => retryDueCovers());

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
  const t = await getTranslations("folders");
  const tCovers = await getTranslations("covers");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">{t("title")}</h1>
        <StoriesMenu
          sort={sort}
          folders={folders.map(({ name, language }) => ({ name, language }))}
          defaultFolder={defaultFolder?.name ?? ""}
        />
      </div>
      <Form action={searchPath} role="search">
        <Input
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
        />
        {selectedTags.map((selected) => (
          <input key={selected} type="hidden" name="tag" value={selected} />
        ))}
      </Form>
      {filterTags.length > 0 && (
        <nav aria-label={t("filterByTag")} className="flex flex-wrap gap-1">
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
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <SortableList
          label={t("listLabel")}
          sortable={sort === "manual"}
          action={moveFolder}
          className="flex flex-col divide-y rounded-lg border"
          itemClassName="flex items-center gap-1 pr-3"
          items={folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            content: (
              <>
                <Link
                  href={`/folders/${folder.id}`}
                  className="hover:bg-muted/50 flex min-w-0 flex-1 items-center gap-4 px-4 py-3"
                >
                  {folder.cover && (
                    <CoverImage
                      path={folder.cover.path}
                      alt={tCovers("alt", { name: folder.name })}
                      size="sm"
                    />
                  )}
                  <span className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-medium">{folder.name}</span>
                    {folder.adult.adult && <AdultBadge />}
                    <TagChips tags={folder.tags} />
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {t("chapterCount", { count: folder.chapterCount })}
                  </span>
                  <span className="text-muted-foreground w-28 text-right text-sm">
                    <LocalDate iso={folder.lastActivityAt} />
                  </span>
                </Link>
                <FolderRowMenu
                  id={folder.id}
                  name={folder.name}
                  tags={folder.tags ?? []}
                  userTags={userTags}
                  isPublic={Boolean(folder.published)}
                  adult={folder.adult}
                  chapterCount={folder.chapterCount}
                />
              </>
            ),
          }))}
        />
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
  const t = await getTranslations("folders");
  if (stories.length === 0) {
    return (
      <p className="text-muted-foreground">
        {!query
          ? t("noTagMatch")
          : tags.length > 0
            ? t("noMatchWithTags", { query })
            : t("noMatch", { query })}
      </p>
    );
  }
  return (
    <ul
      aria-label={t("results")}
      className="flex flex-col divide-y rounded-lg border"
    >
      {stories.map((story) => {
        const snippet = buildSnippet(story.content, query);
        return (
          <li key={story.id}>
            <Link
              href={`/stories/${story.id}`}
              className="hover:bg-muted/50 flex flex-col gap-1 px-4 py-3"
            >
              <span className="flex items-baseline gap-2">
                <span className="font-medium">{story.title}</span>
                {story.adult && <AdultBadge />}
                <span className="text-muted-foreground text-xs">
                  {t("inFolder", { folder: story.folderName })}
                </span>
              </span>
              <span className="text-muted-foreground line-clamp-2 text-sm">
                {snippet.before}
                {snippet.match && (
                  <mark className="text-foreground bg-highlight rounded-sm">
                    {snippet.match}
                  </mark>
                )}
                {snippet.after}
              </span>
              <TagChips tags={story.tags} folderTags={story.folderTags} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
