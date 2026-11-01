"use server";

import { isObjectIdOrHexString, Types } from "mongoose";
import { refresh } from "next/cache";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import {
  findOrCreateFolder,
  moveInList,
  nextChapterPosition,
  nextFolderPosition,
  savePositions,
  touchFolder,
} from "@/lib/folders/mutations";
import { findChaptersInOrder } from "@/lib/folders/queries";
import { chapterOrder, isDirection, type Direction } from "@/lib/folders/sort";
import {
  importTextBytes,
  MAX_IMPORT_CHAPTERS,
  MAX_IMPORT_TEXT_BYTES,
  MAX_IMPORT_TITLE_LENGTH,
  type ImportedChapter,
} from "@/lib/import/limits";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import {
  arrivalUpdate,
  publicationFor,
  rememberChapterSlug,
} from "@/lib/publish/mutations";
import { chapterPublicPath } from "@/lib/publish/queries";
import {
  exceedsTagLimit,
  normalizeTags,
  TAG_LIMIT_MESSAGE,
} from "@/lib/tags/tags";
import { numberedTitle } from "@/lib/versions/versions";

const NOT_FOUND: ActionError = {
  ok: false,
  error: "NOT_FOUND",
  message: "This story does not exist or has been deleted.",
};

const FOLDER_NOT_FOUND: ActionError = {
  ok: false,
  error: "NOT_FOUND",
  message: "This folder does not exist or has been deleted.",
};

const DUPLICATE_TITLE: ActionError = {
  ok: false,
  error: "DUPLICATE_TITLE",
  message: "A story with this title already exists in this folder.",
};

// The folder is picked by name; a name the user has no folder for creates one.
export async function createStory(
  title: string,
  folderName: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;

  // Both checked before the folder is created, so a rejected story leaves no empty folder behind.
  const trimmed = title.trim();
  if (!trimmed) {
    return { ok: false, error: "EMPTY_TITLE", message: "Title is required." };
  }
  const trimmedFolder = folderName.trim();
  if (!trimmedFolder) {
    return { ok: false, error: "EMPTY_NAME", message: "Folder is required." };
  }

  await connectDB();
  const folderId = await findOrCreateFolder(user.userId, trimmedFolder);
  try {
    const story = await Story.create({
      userId: user.userId,
      folderId,
      title: trimmed,
      position: await nextChapterPosition(user.userId, folderId),
      publication: await publicationFor(folderId),
    });
    await touchFolder(folderId);
    return { ok: true, id: story._id.toString() };
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE;
    throw error;
  }
}

export type ImportTarget =
  // Adds to a folder the user is looking at.
  | { kind: "folder"; id: string }
  // A picked or typed name, as in createStory.
  | { kind: "named"; name: string }
  // Always a new folder, with " (2)" when the name is taken.
  | { kind: "new"; name: string };

function invalidImport(message: string): ActionError {
  return { ok: false, error: "INVALID_INPUT", message };
}

// The browser parses the file, so nothing here can be taken from it on trust.
function checkImport(
  chapters: ImportedChapter[],
  folderNotes: string,
): ActionError | null {
  const isText = (value: unknown) => typeof value === "string";
  const valid =
    Array.isArray(chapters) &&
    isText(folderNotes) &&
    chapters.every(
      (chapter) =>
        isText(chapter?.title) &&
        isText(chapter?.content) &&
        isText(chapter?.notes),
    );
  if (!valid || chapters.length === 0) {
    return invalidImport("There is nothing to import.");
  }
  if (chapters.length > MAX_IMPORT_CHAPTERS) {
    return invalidImport(
      `A file can have at most ${MAX_IMPORT_CHAPTERS} chapters.`,
    );
  }
  if (chapters.some(({ title }) => !title.trim())) {
    return { ok: false, error: "EMPTY_TITLE", message: "Title is required." };
  }
  if (chapters.some(({ title }) => title.length > MAX_IMPORT_TITLE_LENGTH)) {
    return invalidImport(
      `A title can have at most ${MAX_IMPORT_TITLE_LENGTH} characters.`,
    );
  }
  if (importTextBytes(chapters, folderNotes) > MAX_IMPORT_TEXT_BYTES) {
    return {
      ok: false,
      error: "TOO_LARGE",
      message: "This text is too large to import.",
    };
  }
  return null;
}

async function createNumberedFolder(
  userId: string,
  name: string,
  notes: string,
): Promise<Types.ObjectId> {
  for (let attempt = 1; ; attempt++) {
    try {
      const folder = await Folder.create({
        userId,
        name: numberedTitle(name, attempt),
        notes,
        position: await nextFolderPosition(userId),
        // Keeps the file's order, which "Newest first" would reverse.
        chapterSort: "manual",
        manualChapterOrder: true,
      });
      return folder._id;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
}

async function insertChapters(
  userId: string,
  folderId: Types.ObjectId,
  chapters: ImportedChapter[],
): Promise<Types.ObjectId[]> {
  const existing = await Story.find({ userId, folderId, deletedAt: null })
    .select({ title: 1 })
    .lean();
  const taken = new Set(existing.map(({ title }) => title));
  const start = await nextChapterPosition(userId, folderId);
  const publication = await publicationFor(folderId);
  const now = Date.now();
  const documents = chapters.map(({ title, content, notes }, index) => {
    const trimmed = title.trim();
    let attempt = 1;
    while (taken.has(numberedTitle(trimmed, attempt))) attempt++;
    const unique = numberedTitle(trimmed, attempt);
    taken.add(unique);
    return {
      _id: new Types.ObjectId(),
      userId,
      folderId,
      title: unique,
      content,
      notes,
      position: start + index,
      ...(publication && { publication }),
      // Separate times keep the order in "Newest first" reproducible.
      createdAt: new Date(now + index),
      updatedAt: new Date(now + index),
    };
  });
  const ids = documents.map(({ _id }) => _id);
  try {
    await Story.insertMany(documents, { timestamps: false });
  } catch (error) {
    // A title taken in the meantime must not leave half of the file behind.
    await Story.deleteMany({ _id: { $in: ids } });
    throw error;
  }
  return ids;
}

export async function importStories(
  target: ImportTarget,
  chapters: ImportedChapter[],
  folderNotes: string,
): Promise<ActionResult<{ folderId: string; storyId: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const problem = checkImport(chapters, folderNotes);
  if (problem) return problem;

  await connectDB();
  let folderId: Types.ObjectId;
  let notesToAppend = folderNotes.trim();
  if (target?.kind === "folder") {
    if (!isObjectIdOrHexString(target.id)) return FOLDER_NOT_FOUND;
    const folder = await Folder.exists({
      _id: target.id,
      userId: user.userId,
      deletedAt: null,
    });
    if (!folder) return FOLDER_NOT_FOUND;
    folderId = folder._id;
  } else {
    const name = typeof target?.name === "string" ? target.name.trim() : "";
    if (!name) {
      return { ok: false, error: "EMPTY_NAME", message: "Folder is required." };
    }
    if (target.kind === "new") {
      folderId = await createNumberedFolder(user.userId, name, notesToAppend);
      notesToAppend = "";
    } else {
      folderId = await findOrCreateFolder(user.userId, name);
    }
  }

  let ids: Types.ObjectId[];
  try {
    ids = await insertChapters(user.userId, folderId, chapters);
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE;
    throw error;
  }
  if (notesToAppend) {
    await Folder.updateOne(
      { _id: folderId },
      [
        {
          $set: {
            notes: {
              $cond: [
                { $eq: [{ $trim: { input: "$notes" } }, ""] },
                notesToAppend,
                { $concat: ["$notes", "\n\n", notesToAppend] },
              ],
            },
            notesUpdatedAt: "$$NOW",
          },
        },
      ],
      { updatePipeline: true },
    );
  }
  await touchFolder(folderId);

  refresh();
  return {
    ok: true,
    folderId: folderId.toString(),
    storyId: ids[0].toString(),
  };
}

// Organizational change: keeps the story's updatedAt, so an open editor does not get CONFLICT.
export async function moveStory(
  id: string,
  folderId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;
  if (!isObjectIdOrHexString(folderId)) return FOLDER_NOT_FOUND;

  await connectDB();
  const folder = await Folder.findOne({
    _id: folderId,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ tags: 1 })
    .lean();
  if (!folder) return FOLDER_NOT_FOUND;
  const story = await Story.findOne({
    _id: id,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ tags: 1 })
    .lean();
  if (!story) return NOT_FOUND;
  if (exceedsTagLimit(story.tags, folder.tags)) {
    return { ok: false, error: "INVALID_INPUT", message: TAG_LIMIT_MESSAGE };
  }
  const arrival = await arrivalUpdate(folderId);
  try {
    const { matchedCount } = await Story.updateOne(
      { _id: id, userId: user.userId, deletedAt: null },
      {
        $set: {
          folderId,
          position: await nextChapterPosition(user.userId, folderId),
          ...arrival.set,
        },
        $unset: arrival.unset,
      },
      { timestamps: false },
    );
    if (matchedCount === 0) return NOT_FOUND;
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE;
    throw error;
  }
  await touchFolder(folderId);

  refresh();
  return { ok: true };
}

// Organizational change, like moveStory: an open editor must not get CONFLICT.
export async function setStoryTags(
  id: string,
  tags: string[],
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;
  const normalized = normalizeTags(tags);
  if (!normalized.ok) return normalized;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const story = await Story.findOne(owned).select({ folderId: 1 }).lean();
  if (!story) return NOT_FOUND;
  const folder = await Folder.findOne({
    _id: story.folderId,
    deletedAt: null,
  })
    .select({ tags: 1 })
    .lean();
  if (exceedsTagLimit(normalized.tags, folder?.tags)) {
    return { ok: false, error: "INVALID_INPUT", message: TAG_LIMIT_MESSAGE };
  }
  const { matchedCount } = await Story.updateOne(
    owned,
    { $set: { tags: normalized.tags } },
    { timestamps: false },
  );
  if (matchedCount === 0) return NOT_FOUND;

  refresh();
  return { ok: true };
}

export async function reorderChapter(
  id: string,
  direction: Direction,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;
  if (!isDirection(direction)) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "This option is not available. Reload the page and try again.",
    };
  }

  await connectDB();
  const story = await Story.findOne({
    _id: id,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ folderId: 1 })
    .lean();
  if (!story) return NOT_FOUND;
  const chapters = await findChaptersInOrder(
    user.userId,
    story.folderId.toString(),
    chapterOrder("manual"),
  )
    .select({ position: 1 })
    .lean();
  await savePositions(Story, moveInList(chapters, id, direction)!);

  refresh();
  return { ok: true };
}

export async function deleteStory(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const { matchedCount } = await Story.updateOne(
    { _id: id, userId: user.userId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  if (matchedCount === 0) return NOT_FOUND;

  refresh();
  return { ok: true };
}

export async function saveStory(
  id: string,
  title: string,
  content: string,
  notes: string,
  expectedUpdatedAt: string,
): Promise<ActionResult<{ updatedAt: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  const trimmed = title.trim();
  if (!trimmed) {
    return { ok: false, error: "EMPTY_TITLE", message: "Title is required." };
  }

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const expected = new Date(expectedUpdatedAt);
  // Strictly later than expected, so a parallel save with the same expectedUpdatedAt cannot match.
  const updatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
  try {
    // Conflict and empty-content checks live in the filter to make them atomic with the write.
    const story = await Story.findOneAndUpdate(
      {
        ...owned,
        updatedAt: expected,
        ...(!content.trim() && { content: /^\s*$/ }),
      },
      { $set: { title: trimmed, content, notes, updatedAt } },
      {
        timestamps: false,
        projection: { folderId: 1, title: 1, publication: 1 },
      },
    ).lean();
    if (story) {
      // Only the folder's lastActivityAt; notesUpdatedAt stays, so folder notes never conflict.
      if (story.folderId) await touchFolder(story.folderId, updatedAt);
      if (story.publication === "public" && story.title !== trimmed) {
        await rememberChapterSlug(id, user.userId, story.folderId, story.title);
      }
      return { ok: true, updatedAt: updatedAt.toISOString() };
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE;
    throw error;
  }

  const current = await Story.findOne(owned).select({ updatedAt: 1 }).lean();
  if (!current) return NOT_FOUND;
  if (current.updatedAt.getTime() !== expected.getTime()) {
    return {
      ok: false,
      error: "CONFLICT",
      message:
        "This story was changed in another tab or on another device. Reload the page to get the latest version.",
    };
  }
  return {
    ok: false,
    error: "EMPTY_CONTENT",
    message:
      "The story content cannot be cleared completely. Your changes were not saved.",
  };
}

// Publishing never touches updatedAt: an open editor sends it as expectedUpdatedAt on the next save.
export async function setChapterPublished(
  id: string,
  enabled: boolean,
): Promise<ActionResult<{ publicPath: string | null }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const story = await Story.findOne(owned).select({ folderId: 1 }).lean();
  if (!story) return NOT_FOUND;
  const folder = await Folder.findOne({
    _id: story.folderId,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ published: 1 })
    .lean();
  if (!folder) return NOT_FOUND;

  if (!enabled) {
    await Story.updateOne(
      owned,
      { $set: { publication: "hidden" } },
      { timestamps: false },
    );
    refresh();
    return { ok: true, publicPath: null };
  }

  // Publishing one chapter is publishing the folder with the rest off; a folder
  // already published keeps its other chapters' settings.
  if (!folder.published) {
    await Story.updateMany(
      {
        userId: user.userId,
        folderId: folder._id,
        deletedAt: null,
        _id: { $ne: id },
        publication: { $exists: false },
      },
      { $set: { publication: "hidden" } },
      { timestamps: false },
    );
  }
  await Story.updateOne(
    owned,
    { $set: { publication: "public" } },
    { timestamps: false },
  );
  if (!folder.published) {
    await Folder.updateOne(
      { _id: folder._id },
      { $set: { published: true } },
      { timestamps: false },
    );
  }

  refresh();
  return {
    ok: true,
    publicPath: await chapterPublicPath(user.userId, folder._id.toString(), id),
  };
}
