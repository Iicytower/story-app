import { escapeRegex } from "@/lib/stories/search";

export const MAX_QUERY_LENGTH = 100;
export const MAX_RESULTS = 50;
export const MAX_RECENT = 15;

interface PublishedFolder {
  _id: unknown;
  name: string;
  tags?: string[];
}

function foldersWithTag(folders: PublishedFolder[], tags: string[]) {
  return folders
    .filter((folder) => folder.tags?.some((tag) => tags.includes(tag)))
    .map(({ _id }) => _id);
}

// Only narrows the candidates: content still holds comments, so matchesPublicText has the last word.
// queryTags are the whole tags the query stands for (tagsForQuery, D79).
export function buildPublicFilter(
  query: string,
  tags: string[],
  folders: PublishedFolder[],
  queryTags: string[] = [],
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    folderId: { $in: folders.map(({ _id }) => _id) },
    publication: "public",
    deletedAt: null,
  };
  if (query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    filter.$or = [
      { title: pattern },
      { content: pattern },
      { tags: { $in: queryTags } },
      {
        folderId: {
          $in: [
            ...foldersWithTag(folders, queryTags),
            ...folders
              .filter(({ name }) => pattern.test(name))
              .map(({ _id }) => _id),
          ],
        },
      },
    ];
  }
  if (tags.length > 0) {
    filter.$and = tags.map((tag) => ({
      $or: [
        { tags: tag },
        { folderId: { $in: foldersWithTag(folders, [tag]) } },
      ],
    }));
  }
  return filter;
}

export function matchesPublicText(
  query: string,
  chapter: { title: string; folderName: string; text: string; tags: string[] },
  queryTags: string[],
): boolean {
  if (!query) return true;
  const pattern = new RegExp(escapeRegex(query), "i");
  return (
    pattern.test(chapter.title) ||
    pattern.test(chapter.folderName) ||
    pattern.test(chapter.text) ||
    chapter.tags.some((tag) => queryTags.includes(tag))
  );
}
