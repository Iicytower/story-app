import {
  CHAPTER_SLUG_FALLBACK,
  FOLDER_SLUG_FALLBACK,
  RESERVED_FOLDER_SLUGS,
  slugsById,
} from "./slugs";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import type { Types } from "mongoose";

type Id = string | Types.ObjectId;

// New, imported, moved and restored chapters: a draft must not go public with a folder that already is.
export async function publicationFor(
  folderId: Id,
): Promise<"hidden" | undefined> {
  const published = await Folder.exists({ _id: folderId, published: true });
  return published ? "hidden" : undefined;
}

// Update parts for a chapter arriving in a folder; old addresses belonged to the old folder.
// publishedAt stays: a chapter keeps its first publication date for good.
export async function arrivalUpdate(folderId: Id) {
  const publication = await publicationFor(folderId);
  return {
    set: publication ? { publication } : {},
    unset: {
      formerSlugs: 1,
      ...(!publication && { publication: 1 }),
    },
  };
}

// Call after chapters become public: only those never published before get a date.
export async function stampPublishedAt(
  filter: Record<string, unknown>,
): Promise<void> {
  // The chapters stamped here are the new ones of library readers (task 73): the "new chapter"
  // notification (task 81) reads them before the update.
  await Story.updateMany(
    { ...filter, publication: "public", publishedAt: { $exists: false } },
    { $set: { publishedAt: new Date() } },
    { timestamps: false },
  );
}

// Call after a title change: siblings are read with the old title to get the old address back.
export async function rememberChapterSlug(
  storyId: Id,
  userId: Id,
  folderId: Id,
  oldTitle: string,
): Promise<void> {
  const chapters = await Story.find({ userId, folderId, deletedAt: null })
    .select({ title: 1 })
    .lean();
  const id = storyId.toString();
  const slugs = slugsById(
    chapters.map(({ _id, title }) => ({
      id: _id.toString(),
      text: _id.toString() === id ? oldTitle : title,
    })),
    CHAPTER_SLUG_FALLBACK,
  );
  await Story.updateOne(
    { _id: storyId },
    { $addToSet: { formerSlugs: slugs.get(id) } },
    { timestamps: false },
  );
}

export async function rememberFolderSlug(
  folderId: Id,
  userId: Id,
  oldName: string,
): Promise<void> {
  const folders = await Folder.find({ userId, deletedAt: null })
    .select({ name: 1 })
    .lean();
  const id = folderId.toString();
  const slugs = slugsById(
    folders.map(({ _id, name }) => ({
      id: _id.toString(),
      text: _id.toString() === id ? oldName : name,
    })),
    FOLDER_SLUG_FALLBACK,
    RESERVED_FOLDER_SLUGS,
  );
  await Folder.updateOne(
    { _id: folderId },
    { $addToSet: { formerSlugs: slugs.get(id) } },
    { timestamps: false },
  );
}
