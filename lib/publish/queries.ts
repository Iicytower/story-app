import type { Types } from "mongoose";
import { cache } from "react";
import { findUserByNickname } from "@/lib/accounts";
import { connectDB } from "@/lib/db";
import { findChaptersInOrder } from "@/lib/folders/queries";
import { chapterOrder, type ChapterSort } from "@/lib/folders/sort";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import {
  CHAPTER_SLUG_FALLBACK,
  FOLDER_SLUG_FALLBACK,
  slugsById,
} from "./slugs";

function folderSlugs(folders: { _id: Types.ObjectId; name: string }[]) {
  return slugsById(
    folders.map(({ _id, name }) => ({ id: _id.toString(), text: name })),
    FOLDER_SLUG_FALLBACK,
  );
}

// Hidden chapters count too, so hiding one does not change its neighbour's address.
function chapterSlugs(chapters: { _id: Types.ObjectId; title: string }[]) {
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
      .select({ name: 1, published: 1, formerSlugs: 1, chapterSort: 1 })
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
      .select({ title: 1, publication: 1, formerSlugs: 1 })
      .lean();
    const path = `/p/${author.nickname}/${slugs.get(folder._id.toString())}`;
    const slugsOfChapters = chapterSlugs(chapters);
    const visible = readingOrder(chapters, folder.chapterSort)
      .filter(({ publication }) => publication === "public")
      .map(({ _id, title, formerSlugs }) => {
        const slug = slugsOfChapters.get(_id.toString())!;
        return { _id, title, slug, formerSlugs, path: `${path}/${slug}` };
      });
    if (visible.length === 0) return null;
    return {
      nickname: author.nickname,
      name: folder.name,
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
      chapters: folder.chapters.map(({ title, path }) => ({ title, path })),
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
