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
import { type ChapterState, numberedTitle } from "./versions";

// JSON keeps the fields apart, so "a" + "bc" and "ab" + "c" hash differently.
function contentHash(storyId: Types.ObjectId, state: ChapterState): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        storyId.toString(),
        state.title,
        state.content,
        state.notes,
      ]),
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
      projection: { versionCounter: 1, notes: 1, chapterSort: 1 },
    },
  ).lean();
  if (!folder) return null;
  const number = folder.versionCounter!;
  const stories = await findChaptersInOrder(
    userId,
    folderId,
    chapterOrder(folder.chapterSort ?? "created"),
  )
    .select({ title: 1, content: 1, notes: 1 })
    .lean();
  const contents = stories.map(({ _id, title, content, notes }) => ({
    _id: contentHash(_id, { title, content, notes }),
    userId: new Types.ObjectId(userId),
    storyId: _id,
    title,
    content,
    notes,
  }));

  await FolderVersion.create({
    userId,
    folderId,
    number,
    name,
    folderNotes: folder.notes,
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

// A chapter still in the folder gets the saved state with a new updatedAt, so an open editor
// gets CONFLICT instead of overwriting it. A deleted one comes back (same id, so later
// comparisons still match it); one moved to another folder is copied back.
async function restoreChapter(
  userId: string,
  folderId: string,
  storyId: Types.ObjectId,
  { title, content, notes }: ChapterState,
): Promise<void> {
  const story = await Story.findOne({ _id: storyId, userId })
    .select({ folderId: 1, deletedAt: 1, updatedAt: 1 })
    .lean();
  const updatedAt = new Date(
    Math.max(Date.now(), (story?.updatedAt.getTime() ?? 0) + 1),
  );

  if (story && story.deletedAt === null && story.folderId.equals(folderId)) {
    await withFreeTitle(title, (free) =>
      Story.updateOne(
        { _id: storyId },
        { $set: { title: free, content, notes, updatedAt } },
        { timestamps: false },
      ),
    );
    return;
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
            notes,
            updatedAt,
            deletedAt: null,
          },
          // The share link stopped working with the deletion; it does not come back.
          $unset: { shareToken: 1 },
        },
        { timestamps: false },
      ),
    );
    return;
  }

  await withFreeTitle(title, (free) =>
    Story.create({ userId, folderId, position, title: free, content, notes }),
  );
}

// The caller has checked the folder and that storyIds are in the version.
export async function restoreChapters(
  userId: string,
  folderId: string,
  chapters: { storyId: Types.ObjectId; contentId: string }[],
): Promise<void> {
  const contents = await ChapterContent.find({
    _id: { $in: chapters.map((chapter) => chapter.contentId) },
    userId,
  }).lean();
  const byId = new Map(contents.map((content) => [content._id, content]));
  for (const chapter of chapters) {
    await restoreChapter(
      userId,
      folderId,
      chapter.storyId,
      byId.get(chapter.contentId)!,
    );
  }
  await touchFolder(folderId);
}
