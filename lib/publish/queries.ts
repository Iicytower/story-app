import type { Types } from "mongoose";
import { cache } from "react";
import { findUserByNickname } from "@/lib/accounts";
import { isAdult } from "@/lib/adult/adult";
import { connectDB } from "@/lib/db";
import { findChaptersInOrder } from "@/lib/folders/queries";
import { chapterOrder, type ChapterSort } from "@/lib/folders/sort";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { buildSnippet, type Snippet } from "@/lib/stories/search";
import { stripComments } from "@/lib/stories/strip-comments";
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
  slugsById,
} from "./slugs";

export function folderSlugs(folders: { _id: Types.ObjectId; name: string }[]) {
  return slugsById(
    folders.map(({ _id, name }) => ({ id: _id.toString(), text: name })),
    FOLDER_SLUG_FALLBACK,
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

// Readers start from the first chapter, while the author's "Newest first" starts from the last.
function readingOrder<T>(chapters: T[], sort: ChapterSort | undefined): T[] {
  return (sort ?? "created") === "created" ? chapters.toReversed() : chapters;
}

// Public pages: never notes, tags or ids, and only public chapters of a published active folder.
// A folder with no public chapter left does not exist for readers.
const findPublishedFolder = cache(
  async (nickname: string, folderSlug: string) => {
    await connectDB();
    const author = await findUserByNickname(nickname);
    if (!author) return null;
    const userId = author._id.toString();
    const folders = await Folder.find({ userId, deletedAt: null })
      .select({
        name: 1,
        published: 1,
        formerSlugs: 1,
        chapterSort: 1,
        adult: 1,
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
      .select({ title: 1, publication: 1, formerSlugs: 1, adult: 1 })
      .lean();
    const path = `/p/${author.nickname}/${slugs.get(folder._id.toString())}`;
    const slugsOfChapters = chapterSlugs(chapters);
    const visible = readingOrder(chapters, folder.chapterSort)
      .filter(({ publication }) => publication === "public")
      .map(({ _id, title, formerSlugs, adult }) => {
        const slug = slugsOfChapters.get(_id.toString())!;
        return {
          _id,
          title,
          slug,
          formerSlugs,
          path: `${path}/${slug}`,
          adult: isAdult(adult) || isAdult(folder.adult),
        };
      });
    if (visible.length === 0) return null;
    return {
      nickname: author.nickname,
      name: folder.name,
      adult: isAdult(folder.adult),
      path,
      chapters: visible,
    };
  },
);

export const getPublishedFolder = cache(
  async (nickname: string, folderSlug: string) => {
    const folder = await findPublishedFolder(nickname, folderSlug);
    if (!folder) return null;
    return {
      ...folder,
      chapters: folder.chapters.map(({ title, path, adult }) => ({
        title,
        path,
        adult,
      })),
    };
  },
);

export const getPublishedChapter = cache(
  async (nickname: string, folderSlug: string, chapterSlug: string) => {
    const folder = await findPublishedFolder(nickname, folderSlug);
    if (!folder) return null;
    const { chapters } = folder;
    let index = chapters.findIndex(({ slug }) => slug === chapterSlug);
    if (index === -1) {
      index = chapters.findIndex(({ formerSlugs }) =>
        formerSlugs?.includes(chapterSlug),
      );
    }
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
      path: chapters[index].path,
      title: chapters[index].title,
      adult: chapters[index].adult,
      content: chapter.content,
      previous: link(chapters[index - 1]),
      next: link(chapters[index + 1]),
    };
  },
);

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
async function findSearchableFolders() {
  const folders = await Folder.find({ published: true, deletedAt: null })
    .select({ userId: 1, name: 1, tags: 1, adult: 1 })
    .lean();
  const authors = await User.find({
    _id: { $in: folders.map(({ userId }) => userId) },
    nickname: { $type: "string" },
  })
    .select({ nickname: 1 })
    .lean();
  const nicknames = new Map(
    authors.map(({ _id, nickname }) => [_id.toString(), nickname]),
  );
  return folders
    .filter(({ userId }) => nicknames.has(userId.toString()))
    .map((folder) => ({
      ...folder,
      nickname: nicknames.get(folder.userId.toString())!,
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
  nickname: string;
  path: string;
  tags: string[];
  folderTags: string[];
  adult: boolean;
  snippet: Snippet;
}

// Addresses come from the same slugs as the reader pages, which count private neighbours too.
async function findChapterPaths(
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
  const folders = await findSearchableFolders();
  const folderById = new Map(
    folders.map((folder) => [folder._id.toString(), folder]),
  );

  const hits = [];
  const cursor = Story.find(buildPublicFilter(query, tags, folders))
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
      matchesPublicText(query, {
        title: chapter.title,
        folderName: folder.name,
        text,
        tags: [...own, ...folderTags],
      })
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
    nickname: folder.nickname,
    path: paths.get(chapter._id.toString())!,
    tags: own,
    folderTags,
    adult: isAdult(chapter.adult) || isAdult(folder.adult),
    snippet: buildSnippet(text, query),
  }));
}

export interface RecentChapter extends PublicSearchResult {
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
      snippet: buildSnippet(stripComments(chapter.content)),
      publishedAt: chapter.publishedAt!,
    };
  });
}
