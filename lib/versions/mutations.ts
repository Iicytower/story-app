import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { isDuplicateKeyError } from "@/lib/db";
import { nextChapterPosition, touchFolder } from "@/lib/folders/mutations";
import { findChaptersInOrder } from "@/lib/folders/queries";
import { chapterOrder } from "@/lib/folders/sort";
import { ChapterContent } from "@/lib/models/chapter-content";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import { Story } from "@/lib/models/story";
import type { ChapterSort } from "@/lib/folders/sort";
import { type ChapterState, numberedTitle } from "./versions";

// JSON keeps the fields apart, so "a" + "bc" and "ab" + "c" hash differently.
function contentHash(storyId: Types.ObjectId, state: ChapterState): string {
  return createHash("sha256")
    .update(
      JSON.stringify([storyId.toString(), state.title, state.content]),
    )
    .digest("hex");
}

// Returns the new version's number, or null when the folder is not the user's active folder.
// Chapters are taken as stored: unsaved changes in an open editor are not included.
export async function saveVersion(
  userId: string,
  folderId: string,
  name: string,
): Promise<number | null> {
  const folder = await Folder.findOneAndUpdate(
    { _id: folderId, userId, deletedAt: null },
    { $inc: { versionCounter: 1 } },
    {
      returnDocument: "after",
      timestamps: false,
      projection: { versionCounter: 1, chapterSort: 1 },
    },
  ).lean();
  if (!folder) return null;
  const number = folder.versionCounter!;
  const chapterSort = folder.chapterSort ?? "created";
  const stories = await findChaptersInOrder(
    userId,
    folderId,
    chapterOrder(chapterSort),
  )
    .select({ title: 1, content: 1 })
    .lean();
  const contents = stories.map(({ _id, title, content }) => ({
    _id: contentHash(_id, { title, content }),
    userId: new Types.ObjectId(userId),
    storyId: _id,
    title,
    content,
  }));

  await FolderVersion.create({
    userId,
    folderId,
    number,
    name,
    chapterSort,
    chapters: stories.map((story, position) => ({
      storyId: story._id,
      title: story.title,
      position,
      contentId: contents[position]._id,
    })),
  });
  // Written after the version that points to them, see deleteVersion.
  if (contents.length > 0) {
    const usedAt = new Date();
    await ChapterContent.bulkWrite(
      contents.map(({ _id, ...state }) => ({
        updateOne: {
          filter: { _id },
          update: { $setOnInsert: state, $set: { usedAt } },
          upsert: true,
        },
      })),
    );
  }
  return number;
}

// Returns false when the version does not exist.
export async function deleteVersion(
  userId: string,
  folderId: string,
  number: number,
): Promise<boolean> {
  const startedAt = new Date();
  const version = await FolderVersion.findOneAndDelete({
    userId,
    folderId,
    number,
  }).lean();
  if (!version) return false;

  const ids = [...new Set(version.chapters.map((c) => c.contentId))];
  const stillUsed = new Set(
    await FolderVersion.distinct("chapters.contentId", {
      "chapters.contentId": { $in: ids },
    }),
  );
  const unused = ids.filter((id) => !stillUsed.has(id));
  // A version saved in the meantime may point to one of them without being found above;
  // its save sets usedAt after inserting the version, so such a content is newer than startedAt.
  if (unused.length > 0) {
    await ChapterContent.deleteMany({
      _id: { $in: unused },
      usedAt: { $lt: startedAt },
    });
  }
  return true;
}

async function withFreeTitle(
  title: string,
  write: (title: string) => Promise<unknown>,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await write(numberedTitle(title, attempt));
      return;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
}

// A chapter still in the folder gets the saved title and content with a new updatedAt, so an
// open editor gets CONFLICT instead of overwriting it; an unchanged one is left alone. A
// deleted one comes back (same id, so later comparisons still match it); one moved to another
// folder is copied back. Notes stay as they are. Returns the restored chapter's id.
async function restoreChapter(
  userId: string,
  folderId: string,
  storyId: Types.ObjectId,
  { title, content }: ChapterState,
): Promise<Types.ObjectId> {
  const story = await Story.findOne({ _id: storyId, userId })
    .select({
      folderId: 1,
      title: 1,
      content: 1,
      notes: 1,
      deletedAt: 1,
      updatedAt: 1,
    })
    .lean();
  const updatedAt = new Date(
    Math.max(Date.now(), (story?.updatedAt.getTime() ?? 0) + 1),
  );

  if (story && story.deletedAt === null && story.folderId.equals(folderId)) {
    if (story.title !== title || story.content !== content) {
      await withFreeTitle(title, (free) =>
        Story.updateOne(
          { _id: storyId },
          { $set: { title: free, content, updatedAt } },
          { timestamps: false },
        ),
      );
    }
    return storyId;
  }

  const position = await nextChapterPosition(userId, folderId);
  if (story && story.deletedAt !== null) {
    await withFreeTitle(title, (free) =>
      Story.updateOne(
        { _id: storyId },
        {
          $set: {
            folderId,
            position,
            title: free,
            content,
            updatedAt,
            deletedAt: null,
          },
          // The share link stopped working with the deletion; it does not come back.
          $unset: { shareToken: 1 },
        },
        { timestamps: false },
      ),
    );
    return storyId;
  }

  let id = storyId;
  await withFreeTitle(title, async (free) => {
    const copy = await Story.create({
      userId,
      folderId,
      position,
      title: free,
      content,
      notes: story?.notes ?? "",
    });
    id = copy._id;
  });
  return id;
}

export interface Restore {
  // Chapters of the version to bring back.
  chapters: { storyId: Types.ObjectId; contentId: string }[];
  // Current chapters of the folder to delete.
  remove: Types.ObjectId[];
  // Set when restoring the whole version: its sort mode and order, as all version chapters.
  order?: {
    chapterSort: ChapterSort;
    chapters: { storyId: Types.ObjectId }[];
  };
}

// The caller has checked the folder and that every id belongs to the version or the folder.
export async function restore(
  userId: string,
  folderId: string,
  { chapters, remove, order }: Restore,
): Promise<void> {
  if (remove.length > 0) {
    await Story.updateMany(
      { _id: { $in: remove }, userId, folderId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
  }

  const contents = await ChapterContent.find({
    _id: { $in: chapters.map((chapter) => chapter.contentId) },
    userId,
  }).lean();
  const byId = new Map(contents.map((content) => [content._id, content]));
  const restoredIds = new Map<string, Types.ObjectId>();
  for (const chapter of chapters) {
    restoredIds.set(
      chapter.storyId.toString(),
      await restoreChapter(
        userId,
        folderId,
        chapter.storyId,
        byId.get(chapter.contentId)!,
      ),
    );
  }

  if (order) {
    const manual = order.chapterSort === "manual";
    if (manual) {
      // Native driver: positions are organizational and keep updatedAt.
      await Story.collection.bulkWrite(
        order.chapters.map((chapter, position) => ({
          updateOne: {
            filter: { _id: restoredIds.get(chapter.storyId.toString())! },
            update: { $set: { position } },
          },
        })),
      );
    }
    await Folder.updateOne(
      { _id: folderId },
      {
        $set: {
          chapterSort: order.chapterSort,
          ...(manual && { manualChapterOrder: true }),
        },
      },
      { timestamps: false },
    );
  }
  await touchFolder(folderId);
}
