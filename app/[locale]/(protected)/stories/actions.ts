"use server";

import { Types } from "mongoose";
import { refresh } from "next/cache";
import { isBoolean, isId, isIsoDate, isString } from "@/lib/action-input";
import type { ActionResult, ValidationError } from "@/lib/action-result";
import { chapterAdultState } from "@/lib/adult/adult";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import type { ErrorKey, ErrorValues } from "@/lib/i18n/messages";
import {
  findOrCreateFolder,
  moveToIndex,
  nextChapterPosition,
  nextFolderPosition,
  savePositions,
  touchFolder,
} from "@/lib/folders/mutations";
import { canAddFolder, chapterRoom } from "@/lib/folders/limits";
import { findChaptersInOrder } from "@/lib/folders/queries";
import { chapterOrder, isPositionIndex } from "@/lib/folders/sort";
import {
  importTextBytes,
  MAX_IMPORT_CHAPTERS,
  MAX_IMPORT_TEXT_BYTES,
  MAX_IMPORT_TITLE_LENGTH,
  type ImportedChapter,
} from "@/lib/import/limits";
import {
  countError,
  lengthError,
  MAX_CONTENT_LENGTH,
  MAX_NOTES_LENGTH,
} from "@/lib/limits";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { parseStoredProofreading } from "@/lib/proofreading/stored";
import {
  arrivalUpdate,
  publicationFor,
  stampPublishedAt,
  rememberChapterSlug,
} from "@/lib/publish/mutations";
import { chapterPublicPath } from "@/lib/publish/queries";
import {
  exceedsTagLimit,
  normalizeTags,
  TAG_LIMIT_ERROR,
} from "@/lib/tags/tags";
import { numberedTitle } from "@/lib/versions/versions";

const NOT_FOUND = () => actionError("NOT_FOUND", "storyNotFound");

const FOLDER_NOT_FOUND = () => actionError("NOT_FOUND", "folderNotFound");

const DUPLICATE_TITLE = () => actionError("DUPLICATE_TITLE", "duplicateTitle");

const INVALID_REQUEST = () => actionError("INVALID_INPUT", "requestInvalid");

const TOO_MANY_FOLDERS = () => translateError(countError("tooManyFolders"));

const TOO_MANY_CHAPTERS = () => translateError(countError("tooManyChapters"));

// The folder is picked by name; a name the user has no folder for creates one.
export async function createStory(
  title: string,
  folderName: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(title) || !isString(folderName)) return INVALID_REQUEST();

  // Both checked before the folder is created, so a rejected story leaves no empty folder behind.
  const trimmed = title.trim();
  if (!trimmed) {
    return actionError("EMPTY_TITLE", "titleRequired");
  }
  const trimmedFolder = folderName.trim();
  if (!trimmedFolder) {
    return actionError("EMPTY_NAME", "folderRequired");
  }
  const tooLong =
    lengthError("title", trimmed) ?? lengthError("folderName", trimmedFolder);
  if (tooLong) return translateError(tooLong);

  await connectDB();
  const folderId = await findOrCreateFolder(user.userId, trimmedFolder);
  if (!folderId) return TOO_MANY_FOLDERS();
  if ((await chapterRoom(user.userId, folderId)) < 1) {
    return TOO_MANY_CHAPTERS();
  }
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
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE();
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

function invalidImport(key: ErrorKey, values?: ErrorValues): ValidationError {
  return { ok: false, error: "INVALID_INPUT", key, values };
}

// The browser parses the file, so nothing here can be taken from it on trust.
function checkImport(
  chapters: ImportedChapter[],
  folderNotes: string,
): ValidationError | null {
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
    return invalidImport("nothingToImport");
  }
  if (chapters.length > MAX_IMPORT_CHAPTERS) {
    return invalidImport("importTooManyChapters", { max: MAX_IMPORT_CHAPTERS });
  }
  if (chapters.some(({ title }) => !title.trim())) {
    return { ok: false, error: "EMPTY_TITLE", key: "titleRequired" };
  }
  if (chapters.some(({ title }) => title.length > MAX_IMPORT_TITLE_LENGTH)) {
    return invalidImport("importTitleTooLong", {
      max: MAX_IMPORT_TITLE_LENGTH,
    });
  }
  const long = chapters.find(({ content }) => lengthError("content", content));
  if (long) {
    return invalidImport("importChapterTooLong", {
      title: long.title,
      max: MAX_CONTENT_LENGTH,
    });
  }
  const longNotes = chapters.find(({ notes }) => lengthError("notes", notes));
  if (longNotes) {
    return invalidImport("importNotesTooLong", {
      title: longNotes.title,
      max: MAX_NOTES_LENGTH,
    });
  }
  const folderNotesError = lengthError("folderNotes", folderNotes.trim());
  if (folderNotesError) return folderNotesError;
  if (importTextBytes(chapters, folderNotes) > MAX_IMPORT_TEXT_BYTES) {
    return { ok: false, error: "TOO_LARGE", key: "importTooLarge" };
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
  if (problem) return translateError(problem);

  await connectDB();
  let folderId: Types.ObjectId;
  let notesToAppend = folderNotes.trim();
  if (target?.kind === "folder") {
    if (!isId(target.id)) return FOLDER_NOT_FOUND();
    const folder = await Folder.exists({
      _id: target.id,
      userId: user.userId,
      deletedAt: null,
    });
    if (!folder) return FOLDER_NOT_FOUND();
    folderId = folder._id;
  } else {
    const name = typeof target?.name === "string" ? target.name.trim() : "";
    if (!name) {
      return actionError("EMPTY_NAME", "folderRequired");
    }
    const tooLong = lengthError("folderName", name);
    if (tooLong) return translateError(tooLong);
    if (target.kind === "new") {
      if (!(await canAddFolder(user.userId))) return TOO_MANY_FOLDERS();
      folderId = await createNumberedFolder(user.userId, name, notesToAppend);
      notesToAppend = "";
    } else {
      const found = await findOrCreateFolder(user.userId, name);
      if (!found) return TOO_MANY_FOLDERS();
      folderId = found;
    }
  }
  if ((await chapterRoom(user.userId, folderId)) < chapters.length) {
    return TOO_MANY_CHAPTERS();
  }
  if (notesToAppend) {
    const existing = await Folder.findById(folderId)
      .select({ notes: 1 })
      .lean();
    const joined = `${existing?.notes ?? ""}\n\n${notesToAppend}`;
    const tooLong = lengthError("folderNotes", joined);
    if (tooLong) return translateError(tooLong);
  }

  let ids: Types.ObjectId[];
  try {
    ids = await insertChapters(user.userId, folderId, chapters);
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE();
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
  if (!isId(id)) return NOT_FOUND();
  if (!isId(folderId)) return FOLDER_NOT_FOUND();

  await connectDB();
  const folder = await Folder.findOne({
    _id: folderId,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ tags: 1 })
    .lean();
  if (!folder) return FOLDER_NOT_FOUND();
  const story = await Story.findOne({
    _id: id,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ tags: 1, folderId: 1 })
    .lean();
  if (!story) return NOT_FOUND();
  if (exceedsTagLimit(story.tags, folder.tags)) {
    return translateError(TAG_LIMIT_ERROR);
  }
  if (
    !story.folderId?.equals(folder._id) &&
    (await chapterRoom(user.userId, folderId)) < 1
  ) {
    return TOO_MANY_CHAPTERS();
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
    if (matchedCount === 0) return NOT_FOUND();
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE();
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
  if (!isId(id)) return NOT_FOUND();
  const normalized = normalizeTags(tags);
  if (!normalized.ok) return translateError(normalized);

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const story = await Story.findOne(owned).select({ folderId: 1 }).lean();
  if (!story) return NOT_FOUND();
  const folder = await Folder.findOne({
    _id: story.folderId,
    deletedAt: null,
  })
    .select({ tags: 1 })
    .lean();
  if (exceedsTagLimit(normalized.tags, folder?.tags)) {
    return translateError(TAG_LIMIT_ERROR);
  }
  const { matchedCount } = await Story.updateOne(
    owned,
    { $set: { tags: normalized.tags } },
    { timestamps: false },
  );
  if (matchedCount === 0) return NOT_FOUND();

  refresh();
  return { ok: true };
}

export async function moveChapter(
  id: string,
  index: number,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(id)) return NOT_FOUND();
  if (!isPositionIndex(index)) {
    return actionError("INVALID_INPUT", "optionUnavailable");
  }

  await connectDB();
  const story = await Story.findOne({
    _id: id,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ folderId: 1 })
    .lean();
  if (!story) return NOT_FOUND();
  const chapters = await findChaptersInOrder(
    user.userId,
    story.folderId.toString(),
    chapterOrder("manual"),
  )
    .select({ position: 1 })
    .lean();
  await savePositions(Story, moveToIndex(chapters, id, index)!);

  refresh();
  return { ok: true };
}

export async function deleteStory(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(id)) return NOT_FOUND();

  await connectDB();
  const { matchedCount } = await Story.updateOne(
    { _id: id, userId: user.userId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  if (matchedCount === 0) return NOT_FOUND();

  refresh();
  return { ok: true };
}

export async function saveStory(
  id: string,
  title: string,
  content: string,
  notes: string,
  expectedUpdatedAt: string,
  // The chapter's proofreading (task 55): null clears it, undefined leaves it as it is.
  proofreading?: unknown,
): Promise<ActionResult<{ updatedAt: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(id)) return NOT_FOUND();
  if (
    !isString(title) ||
    !isString(content) ||
    !isString(notes) ||
    !isIsoDate(expectedUpdatedAt)
  ) {
    return INVALID_REQUEST();
  }

  const trimmed = title.trim();
  if (!trimmed) {
    return actionError("EMPTY_TITLE", "titleRequired");
  }
  // Rejects only a save still over the limit, so a longer text stored before can be shortened.
  const tooLong =
    lengthError("title", trimmed) ??
    lengthError("content", content) ??
    lengthError("notes", notes);
  if (tooLong) return translateError(tooLong);
  const parsed =
    proofreading === undefined
      ? undefined
      : parseStoredProofreading(proofreading);
  if (parsed === "invalid") {
    return actionError("INVALID_INPUT", "proofreadingInvalid");
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
      {
        $set: {
          title: trimmed,
          content,
          notes,
          updatedAt,
          ...(parsed && { proofreading: parsed }),
        },
        ...(parsed === null && { $unset: { proofreading: 1 } }),
      },
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
    if (isDuplicateKeyError(error)) return DUPLICATE_TITLE();
    throw error;
  }

  const current = await Story.findOne(owned).select({ updatedAt: 1 }).lean();
  if (!current) return NOT_FOUND();
  if (current.updatedAt.getTime() !== expected.getTime()) {
    return actionError("CONFLICT", "storyConflict");
  }
  return actionError("EMPTY_CONTENT", "contentCleared");
}

// Publishing never touches updatedAt: an open editor sends it as expectedUpdatedAt on the next save.
export async function setChapterPublished(
  id: string,
  enabled: boolean,
): Promise<ActionResult<{ publicPath: string | null }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(id)) return NOT_FOUND();
  if (!isBoolean(enabled)) return INVALID_REQUEST();

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const story = await Story.findOne(owned).select({ folderId: 1 }).lean();
  if (!story) return NOT_FOUND();
  const folder = await Folder.findOne({
    _id: story.folderId,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ published: 1 })
    .lean();
  if (!folder) return NOT_FOUND();

  if (!enabled) {
    await Story.updateOne(
      owned,
      { $set: { publication: "hidden" } },
      { timestamps: false },
    );
    refresh();
    return { ok: true, publicPath: null };
  }

  // Publishing one chapter is publishing the folder with the rest off, also those public
  // before an Unpublish; a folder already published keeps its other chapters' settings.
  if (!folder.published) {
    await Story.updateMany(
      {
        userId: user.userId,
        folderId: folder._id,
        deletedAt: null,
        _id: { $ne: id },
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
  await stampPublishedAt(owned);
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

// Never touches updatedAt, like publishing (D67).
export async function setStoryAdult(
  id: string,
  adult: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(id)) return NOT_FOUND();
  if (!isBoolean(adult)) return INVALID_REQUEST();

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const story = await Story.findOne(owned)
    .select({ folderId: 1, adult: 1 })
    .lean();
  if (!story) return NOT_FOUND();
  const folder = await Folder.findOne({
    _id: story.folderId,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ adult: 1 })
    .lean();
  if (!folder) return NOT_FOUND();
  const { lock } = chapterAdultState(story.adult, folder.adult);
  if (!adult && lock) {
    return actionError(
      "ADULT_LOCKED",
      lock === "auto" ? "adultLockedByImage" : "adultLockedByFolder",
    );
  }
  await Story.updateOne(
    owned,
    { $set: { "adult.manual": adult } },
    { timestamps: false },
  );

  refresh();
  return { ok: true };
}
