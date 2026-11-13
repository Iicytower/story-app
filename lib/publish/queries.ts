import type { Types } from "mongoose";
import { cache } from "react";
import { findUserByNickname } from "@/lib/accounts";
import { isAdult } from "@/lib/adult/adult";
import { coversOf, type CoverView } from "@/lib/covers/queries";
import { connectDB } from "@/lib/db";
import { findChaptersInOrder } from "@/lib/folders/queries";
import { chapterOrder } from "@/lib/folders/sort";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { NOT_DELETED, User } from "@/lib/models/user";
import { requireUser } from "@/lib/auth/session";
import { isBanActive, notGloballyBanned } from "@/lib/social/permissions";
import { buildSnippet, type Snippet } from "@/lib/stories/search";
import { stripComments } from "@/lib/stories/strip-comments";
import { tagsForQuery } from "@/lib/tags/predefined";
import { listPredefinedTags } from "@/lib/tags/queries";
import { inheritedOnly } from "@/lib/tags/tags";
import {
  buildPublicFilter,
  matchesPublicText,
  MAX_RECENT,
  MAX_RESULTS,
} from "./search";
import {
  CHAPTER_SLUG_FALLBACK,
  FOLDER_SLUG_FALLBACK,
  RESERVED_FOLDER_SLUGS,
  slugsById,
} from "./slugs";

export function folderSlugs(folders: { _id: Types.ObjectId; name: string }[]) {
  return slugsById(
    folders.map(({ _id, name }) => ({ id: _id.toString(), text: name })),
    FOLDER_SLUG_FALLBACK,
    RESERVED_FOLDER_SLUGS,
  );
}

// Hidden chapters count too, so hiding one does not change its neighbour's address.
export function chapterSlugs(
  chapters: { _id: Types.ObjectId; title: string }[],
) {
  return slugsById(
    chapters.map(({ _id, title }) => ({ id: _id.toString(), text: title })),
    CHAPTER_SLUG_FALLBACK,
  );
}

// Public pages: never notes, tags or ids, and only public chapters of a published active folder.
// A folder with no public chapter left does not exist for readers.
// The admin finds a banned author's books too (task 88); readers do not.
async function loadPublishedFolder(
  nickname: string,
  folderSlug: string,
  withBanned: boolean,
) {
  await connectDB();
  const author = await findUserByNickname(nickname);
  if (!author) return null;
  const userId = author._id.toString();
  // A globally banned author's books are hidden from others while the ban lasts (D80); the
  // session is read only then, so the pages of everyone else stay as they are.
  if (!withBanned && isBanActive(author.globalBan, new Date())) {
    const viewer = await requireUser();
    if (!viewer.ok || viewer.userId !== userId) return null;
  }
  const folders = await Folder.find({ userId, deletedAt: null })
    .select({
      name: 1,
      published: 1,
      formerSlugs: 1,
      chapterSort: 1,
      adult: 1,
      coverId: 1,
    })
    .lean();
  const slugs = folderSlugs(folders);
  const folder =
    folders.find(
      ({ _id, published }) =>
        published && slugs.get(_id.toString()) === folderSlug,
    ) ??
    folders.find(
      ({ published, formerSlugs }) =>
        published && formerSlugs?.includes(folderSlug),
    );
  if (!folder) return null;

  const chapters = await findChaptersInOrder(
    userId,
    folder._id.toString(),
    chapterOrder(folder.chapterSort ?? "created"),
  )
    .select({
      title: 1,
      publication: 1,
      formerSlugs: 1,
      adult: 1,
      publishedAt: 1,
    })
    .lean();
  const path = `/p/${author.nickname}/${slugs.get(folder._id.toString())}`;
  const slugsOfChapters = chapterSlugs(chapters);
  const visible = chapters
    .filter(({ publication }) => publication === "public")
    .map(({ _id, title, formerSlugs, adult, publishedAt }) => {
      const slug = slugsOfChapters.get(_id.toString())!;
      return {
        _id,
        title,
        slug,
        formerSlugs,
        publishedAt,
        path: `${path}/${slug}`,
        adult: isAdult(adult) || isAdult(folder.adult),
      };
    });
  if (visible.length === 0) return null;
  const covers = await coversOf([folder]);
  return {
    id: folder._id.toString(),
    authorId: userId,
    nickname: author.nickname,
    name: folder.name,
    adult: isAdult(folder.adult),
    cover: covers.get(folder._id.toString()) ?? null,
    path,
    chapters: visible,
  };
}

const findPublishedFolder = cache((nickname: string, folderSlug: string) =>
  loadPublishedFolder(nickname, folderSlug, false),
);

// For the admin's 18+ mark by a public address (task 88), also of a globally banned author.
export async function publicTargetIds(
  nickname: string,
  folderSlug: string,
  chapterSlug?: string,
): Promise<{ folderId: string; storyId: string | null } | null> {
  const folder = await loadPublishedFolder(nickname, folderSlug, true);
  if (!folder) return null;
  if (!chapterSlug) return { folderId: folder.id, storyId: null };
  const index = chapterIndex(folder.chapters, chapterSlug);
  if (index === -1) return null;
  return {
    folderId: folder.id,
    storyId: folder.chapters[index]._id.toString(),
  };
}

export const getPublishedFolder = cache(
  async (nickname: string, folderSlug: string) => {
    const folder = await findPublishedFolder(nickname, folderSlug);
    if (!folder) return null;
    return {
      nickname: folder.nickname,
      name: folder.name,
      adult: folder.adult,
      cover: folder.cover,
      path: folder.path,
      chapters: folder.chapters.map(({ title, path, adult }) => ({
        title,
        path,
        adult,
      })),
    };
  },
);

// Only for a signed-in reader's library picker (task 72); public content carries no ids.
export async function publishedFolderId(
  nickname: string,
  folderSlug: string,
): Promise<string | null> {
  return (await findPublishedFolder(nickname, folderSlug))?.id ?? null;
}

export interface ReaderChapter {
  id: string;
  title: string;
  path: string;
  publishedAt?: Date;
}

// Only for a signed-in reader's progress (task 73), like publishedFolderId.
export async function publishedReaderChapters(
  nickname: string,
  folderSlug: string,
): Promise<{ folderId: string; chapters: ReaderChapter[] } | null> {
  const folder = await findPublishedFolder(nickname, folderSlug);
  if (!folder) return null;
  return {
    folderId: folder.id,
    chapters: folder.chapters.map(({ _id, title, path, publishedAt }) => ({
      id: _id.toString(),
      title,
      path,
      publishedAt,
    })),
  };
}

function chapterIndex(
  chapters: { slug: string; formerSlugs?: string[] }[],
  chapterSlug: string,
): number {
  const index = chapters.findIndex(({ slug }) => slug === chapterSlug);
  return index !== -1
    ? index
    : chapters.findIndex(({ formerSlugs }) =>
        formerSlugs?.includes(chapterSlug),
      );
}

// Only for the reading position of a signed-in reader (task 73).
export async function publishedChapterId(
  nickname: string,
  folderSlug: string,
  chapterSlug: string,
): Promise<{ folderId: string; storyId: string; authorId: string } | null> {
  const folder = await findPublishedFolder(nickname, folderSlug);
  if (!folder) return null;
  const index = chapterIndex(folder.chapters, chapterSlug);
  if (index === -1) return null;
  return {
    folderId: folder.id,
    authorId: folder.authorId,
    storyId: folder.chapters[index]._id.toString(),
  };
}

export const getPublishedChapter = cache(
  async (nickname: string, folderSlug: string, chapterSlug: string) => {
    const folder = await findPublishedFolder(nickname, folderSlug);
    if (!folder) return null;
    const { chapters } = folder;
    const index = chapterIndex(chapters, chapterSlug);
    if (index === -1) return null;
    const chapter = await Story.findOne({
      _id: chapters[index]._id,
      deletedAt: null,
    })
      .select({ content: 1 })
      .lean();
    if (!chapter) return null;
    const link = (near?: { title: string; path: string }) =>
      near ? { title: near.title, path: near.path } : null;
    return {
      nickname: folder.nickname,
      folderName: folder.name,
      folderPath: folder.path,
      cover: folder.cover,
      path: chapters[index].path,
      title: chapters[index].title,
      adult: chapters[index].adult,
      content: chapter.content,
      previous: link(chapters[index - 1]),
      next: link(chapters[index + 1]),
    };
  },
);

export interface AuthorBook {
  name: string;
  path: string;
  adult: boolean;
  cover: CoverView | null;
}

// The author's books on the profile (task 70): the same visibility as the contents page (D38).
// Slugs come from every active folder, so they match the addresses of the contents pages.
export async function listAuthorBooks(
  userId: Types.ObjectId,
  nickname: string,
): Promise<AuthorBook[]> {
  await connectDB();
  const folders = await Folder.find({ userId, deletedAt: null })
    .select({ name: 1, published: 1, adult: 1, coverId: 1 })
    .lean();
  const published = folders.filter(({ published }) => published);
  if (published.length === 0) return [];
  const withPublic: Types.ObjectId[] = await Story.distinct("folderId", {
    userId,
    folderId: { $in: published.map(({ _id }) => _id) },
    publication: "public",
    deletedAt: null,
  });
  const publicIds = new Set(withPublic.map(String));
  const visible = published
    .filter(({ _id }) => publicIds.has(String(_id)))
    .toSorted((a, b) => a.name.localeCompare(b.name, "pl"));
  const slugs = folderSlugs(folders);
  const covers = await coversOf(visible);
  return visible.map((folder) => ({
    name: folder.name,
    path: `/p/${nickname}/${slugs.get(folder._id.toString())}`,
    adult: isAdult(folder.adult),
    cover: covers.get(folder._id.toString()) ?? null,
  }));
}

export interface PublicBook extends AuthorBook {
  nickname: string;
}

// Books of many authors at once (the library, task 72), with the visibility of the contents page
// (D38): a published active folder with a public chapter, by an author with a nickname who is
// not hidden from the viewer. Keyed by folder id; invisible folders are left out.
export async function findPublicBooks(
  folderIds: Types.ObjectId[],
  hidden: Types.ObjectId[],
): Promise<Map<string, PublicBook>> {
  if (folderIds.length === 0) return new Map();
  await connectDB();
  const candidates = await Folder.find({
    _id: { $in: folderIds },
    userId: { $nin: hidden },
    published: true,
    deletedAt: null,
  })
    .select({ userId: 1, name: 1, adult: 1, coverId: 1 })
    .lean();
  if (candidates.length === 0) return new Map();
  const [withPublic, authors] = await Promise.all([
    // userId first, so the query uses the { userId, folderId, title } index.
    Story.distinct("folderId", {
      userId: { $in: candidates.map(({ userId }) => userId) },
      folderId: { $in: candidates.map(({ _id }) => _id) },
      publication: "public",
      deletedAt: null,
    }) as Promise<Types.ObjectId[]>,
    User.find({
      _id: { $in: candidates.map(({ userId }) => userId) },
      nickname: { $type: "string" },
      ...NOT_DELETED,
    })
      .select({ nickname: 1 })
      .lean(),
  ]);
  const publicIds = new Set(withPublic.map(String));
  const nicknames = new Map(
    authors.map(({ _id, nickname }) => [_id.toString(), nickname!]),
  );
  const visible = candidates.filter(
    ({ _id, userId }) =>
      publicIds.has(_id.toString()) && nicknames.has(userId.toString()),
  );
  if (visible.length === 0) return new Map();
  // Slugs come from every active folder of the author, as on the contents page.
  const [siblings, covers] = await Promise.all([
    Folder.find({
      userId: { $in: [...new Set(visible.map(({ userId }) => userId))] },
      deletedAt: null,
    })
      .select({ userId: 1, name: 1 })
      .lean(),
    coversOf(visible),
  ]);
  const byAuthor = Map.groupBy(siblings, ({ userId }) => userId.toString());
  const slugs = new Map(
    [...byAuthor].map(([authorId, folders]) => [
      authorId,
      folderSlugs(folders),
    ]),
  );
  return new Map(
    visible.map((folder) => {
      const authorId = folder.userId.toString();
      const nickname = nicknames.get(authorId)!;
      const slug = slugs.get(authorId)!.get(folder._id.toString());
      return [
        folder._id.toString(),
        {
          name: folder.name,
          nickname,
          path: `/p/${nickname}/${slug}`,
          adult: isAdult(folder.adult),
          cover: covers.get(folder._id.toString()) ?? null,
        },
      ];
    }),
  );
}

export async function folderPublicPath(
  userId: string,
  folderId: string,
): Promise<string> {
  const [author, folders] = await Promise.all([
    User.findById(userId).select({ nickname: 1 }).lean(),
    Folder.find({ userId, deletedAt: null }).select({ name: 1 }).lean(),
  ]);
  return `/p/${author!.nickname}/${folderSlugs(folders).get(folderId)}`;
}

export async function chapterPublicPath(
  userId: string,
  folderId: string,
  storyId: string,
): Promise<string> {
  const [base, chapters] = await Promise.all([
    folderPublicPath(userId, folderId),
    Story.find({ userId, folderId, deletedAt: null })
      .select({ title: 1 })
      .lean(),
  ]);
  return `${base}/${chapterSlugs(chapters).get(storyId)}`;
}

// Accounts from before task 36 may have no nickname yet, so they have no public address.
// Globally banned authors are left out of the search, its tags and the recent list (D80).
async function findSearchableFolders() {
  const folders = await Folder.find({ published: true, deletedAt: null })
    .select({
      userId: 1,
      name: 1,
      description: 1,
      tags: 1,
      adult: 1,
      coverId: 1,
    })
    .lean();
  const authors = await User.find({
    _id: { $in: folders.map(({ userId }) => userId) },
    nickname: { $type: "string" },
    ...NOT_DELETED,
    ...notGloballyBanned(new Date()),
  })
    .select({ nickname: 1 })
    .lean();
  const nicknames = new Map(
    authors.map(({ _id, nickname }) => [_id.toString(), nickname]),
  );
  const searchable = folders.filter(({ userId }) =>
    nicknames.has(userId.toString()),
  );
  const covers = await coversOf(searchable);
  return searchable.map((folder) => ({
    ...folder,
    nickname: nicknames.get(folder.userId.toString())!,
    cover: covers.get(folder._id.toString()) ?? null,
  }));
}

// Only tags of public chapters: anything else would reveal unpublished work.
export async function listPublicTags(): Promise<string[]> {
  await connectDB();
  const folders = await findSearchableFolders();
  const chapters = await Story.find(buildPublicFilter("", [], folders))
    .select({ folderId: 1, tags: 1 })
    .lean();
  const tagsOfFolder = new Map(
    folders.map(({ _id, tags }) => [_id.toString(), tags ?? []]),
  );
  const tags = chapters.flatMap(({ folderId, tags: own }) => [
    ...(own ?? []),
    ...(tagsOfFolder.get(folderId.toString()) ?? []),
  ]);
  return [...new Set(tags)].toSorted((a, b) => a.localeCompare(b, "pl"));
}

export interface PublicSearchResult {
  title: string;
  folderName: string;
  folderDescription: string;
  nickname: string;
  path: string;
  tags: string[];
  folderTags: string[];
  adult: boolean;
  cover: CoverView | null;
  snippet: Snippet;
}

// Addresses come from the same slugs as the reader pages, which count private neighbours too.
export async function findChapterPaths(
  chapters: {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    folderId: Types.ObjectId;
  }[],
  nicknames: Map<string, string>,
) {
  const [folders, siblings] = await Promise.all([
    Folder.find({
      userId: { $in: chapters.map(({ userId }) => userId) },
      deletedAt: null,
    })
      .select({ userId: 1, name: 1 })
      .lean(),
    Story.find({
      folderId: { $in: chapters.map(({ folderId }) => folderId) },
      deletedAt: null,
    })
      .select({ folderId: 1, title: 1 })
      .lean(),
  ]);
  const slugsOfFolder = (userId: Types.ObjectId) =>
    folderSlugs(folders.filter((folder) => folder.userId.equals(userId)));
  const slugsOfChapter = (folderId: Types.ObjectId) =>
    chapterSlugs(
      siblings.filter((sibling) => sibling.folderId.equals(folderId)),
    );
  return new Map(
    chapters.map(({ _id, userId, folderId }) => {
      const nickname = nicknames.get(userId.toString());
      const folder = slugsOfFolder(userId).get(folderId.toString());
      const chapter = slugsOfChapter(folderId).get(_id.toString());
      return [_id.toString(), `/p/${nickname}/${folder}/${chapter}`];
    }),
  );
}

export async function searchPublishedChapters(
  query: string,
  tags: string[],
): Promise<PublicSearchResult[]> {
  await connectDB();
  const [folders, predefined] = await Promise.all([
    findSearchableFolders(),
    listPredefinedTags(),
  ]);
  const folderById = new Map(
    folders.map((folder) => [folder._id.toString(), folder]),
  );
  const queryTags = tagsForQuery(query, predefined);

  const hits = [];
  const cursor = Story.find(buildPublicFilter(query, tags, folders, queryTags))
    .select({
      userId: 1,
      folderId: 1,
      title: 1,
      content: 1,
      tags: 1,
      adult: 1,
    })
    .sort({ updatedAt: -1, _id: 1 })
    .lean()
    .cursor();
  for await (const chapter of cursor) {
    const folder = folderById.get(chapter.folderId.toString())!;
    const text = stripComments(chapter.content);
    const own = chapter.tags ?? [];
    const folderTags = inheritedOnly(own, folder.tags);
    if (
      matchesPublicText(
        query,
        {
          title: chapter.title,
          folderName: folder.name,
          text,
          tags: [...own, ...folderTags],
        },
        queryTags,
      )
    ) {
      hits.push({ chapter, folder, text, own, folderTags });
      if (hits.length === MAX_RESULTS) break;
    }
  }

  const paths = await findChapterPaths(
    hits.map(({ chapter }) => chapter),
    new Map(
      folders.map(({ userId, nickname }) => [userId.toString(), nickname]),
    ),
  );
  return hits.map(({ chapter, folder, text, own, folderTags }) => ({
    title: chapter.title,
    folderName: folder.name,
    folderDescription: folder.description ?? "",
    nickname: folder.nickname,
    path: paths.get(chapter._id.toString())!,
    tags: own,
    folderTags,
    adult: isAdult(chapter.adult) || isAdult(folder.adult),
    cover: folder.cover,
    snippet: buildSnippet(text, query),
  }));
}

// The description is shown in search results only (task 98).
export interface RecentChapter extends Omit<
  PublicSearchResult,
  "folderDescription"
> {
  publishedAt: Date;
}

export async function listRecentlyPublished(): Promise<RecentChapter[]> {
  await connectDB();
  const folders = await findSearchableFolders();
  const folderById = new Map(
    folders.map((folder) => [folder._id.toString(), folder]),
  );
  const chapters = await Story.find({
    ...buildPublicFilter("", [], folders),
    publishedAt: { $type: "date" },
  })
    .select({
      userId: 1,
      folderId: 1,
      title: 1,
      content: 1,
      tags: 1,
      adult: 1,
      publishedAt: 1,
    })
    .sort({ publishedAt: -1, _id: -1 })
    .limit(MAX_RECENT)
    .lean();

  const paths = await findChapterPaths(
    chapters,
    new Map(
      folders.map(({ userId, nickname }) => [userId.toString(), nickname]),
    ),
  );
  return chapters.map((chapter) => {
    const folder = folderById.get(chapter.folderId.toString())!;
    const own = chapter.tags ?? [];
    return {
      title: chapter.title,
      folderName: folder.name,
      nickname: folder.nickname,
      path: paths.get(chapter._id.toString())!,
      tags: own,
      folderTags: inheritedOnly(own, folder.tags),
      adult: isAdult(chapter.adult) || isAdult(folder.adult),
      cover: folder.cover,
      snippet: buildSnippet(stripComments(chapter.content)),
      publishedAt: chapter.publishedAt!,
    };
  });
}
