"use server";

import { Types } from "mongoose";
import { isFraction, isId, isString } from "@/lib/action-input";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import {
  countError,
  lengthError,
  MAX_MARKS_PER_ACCOUNT,
  MAX_MARKS_PER_CHAPTER,
  type LimitedField,
} from "@/lib/limits";
import { Folder } from "@/lib/models/folder";
import { ReaderMark, type ReaderMarkFields } from "@/lib/models/reader-mark";
import { ReadingProgress } from "@/lib/models/reading-progress";
import { Story } from "@/lib/models/story";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { toMarkView, type ReaderMarkView } from "@/lib/reading/marks";
import { isAuthorVisibleTo } from "@/lib/social/permissions";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const rateLimited = () => actionError("RATE_LIMITED", "tooManyAttempts");
const storyNotFound = () => actionError("NOT_FOUND", "storyNotFound");
const markNotFound = () => actionError("NOT_FOUND", "readerMarkNotFound");

// The same visibility as the library (D38, task 72): hidden authors' books are not found.
async function findVisibleStory(viewerId: string, storyId: string) {
  await connectDB();
  const story = await Story.findOne({
    _id: storyId,
    publication: "public",
    deletedAt: null,
  })
    .select({ folderId: 1, userId: 1 })
    .lean();
  if (!story) return null;
  const [folder, author] = await Promise.all([
    Folder.exists({
      _id: story.folderId,
      userId: story.userId,
      published: true,
      deletedAt: null,
    }),
    isAuthorVisibleTo(viewerId, story.userId),
  ]);
  return folder && author ? story : null;
}

// Called in the background every few seconds, so it does not refresh the page. A chapter
// scrolled to the end (position 1) is read.
export async function saveReadingPosition(
  storyId: string,
  position: number,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(storyId) || !isFraction(position)) {
    return actionError("INVALID_INPUT", "requestInvalid");
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.progress, user.userId))) {
    return rateLimited();
  }
  const story = await findVisibleStory(user.userId, storyId);
  if (!story) return storyNotFound();

  const key = {
    userId: new Types.ObjectId(user.userId),
    folderId: story.folderId,
  };
  const save = () =>
    ReadingProgress.updateOne(
      key,
      {
        $set: { lastStoryId: story._id, position },
        ...(position === 1 && { $addToSet: { readStoryIds: story._id } }),
      },
      { upsert: true },
    );
  // Two tabs at once: the other request inserted the entry, so this one updates it.
  await save().catch((error: unknown) => {
    if (!isDuplicateKeyError(error)) throw error;
    return save();
  });
  return { ok: true };
}

type MarkResult = ActionResult<{ mark: ReaderMarkView }>;

// A trimmed string within its limit, or the error to return.
async function limitedText(
  field: LimitedField,
  value: unknown,
): Promise<string | ActionError> {
  if (!isString(value)) return invalid();
  const trimmed = value.trim();
  const tooLong = lengthError(field, trimmed);
  return tooLong ? translateError(tooLong) : trimmed;
}

// Limits are checked before the save; parallel saves may pass them by a few (task 74).
async function createMark(
  userId: string,
  storyId: string,
  fields: Pick<ReaderMarkFields, "kind" | "position"> &
    Partial<Pick<ReaderMarkFields, "name" | "text" | "quote" | "prefix" | "suffix">>,
): Promise<MarkResult> {
  if (!(await takeUserAttempt(SOCIAL_LIMITS.marks, userId))) {
    return rateLimited();
  }
  const story = await findVisibleStory(userId, storyId);
  if (!story) return storyNotFound();
  const owner = new Types.ObjectId(userId);
  const [inChapter, inAccount] = await Promise.all([
    ReaderMark.countDocuments({ userId: owner, storyId: story._id }),
    ReaderMark.countDocuments({ userId: owner }),
  ]);
  if (inChapter >= MAX_MARKS_PER_CHAPTER) {
    return translateError(countError("tooManyChapterMarks"));
  }
  if (inAccount >= MAX_MARKS_PER_ACCOUNT) {
    return translateError(countError("tooManyMarks"));
  }
  const mark = await ReaderMark.create({
    ...fields,
    userId: owner,
    storyId: story._id,
    folderId: story.folderId,
  });
  return { ok: true, mark: toMarkView(mark.toObject()) };
}

// The scroll position of the chapter page with an optional name.
export async function addBookmark(
  storyId: string,
  position: number,
  name: string,
): Promise<MarkResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(storyId) || !isFraction(position)) return invalid();
  const checked = await limitedText("bookmarkName", name);
  if (!isString(checked)) return checked;
  return createMark(user.userId, storyId, {
    kind: "bookmark",
    position,
    ...(checked && { name: checked }),
  });
}

export interface NoteInput {
  quote: string;
  prefix: string;
  suffix: string;
  position: number;
  text: string;
}

// A selected passage of the rendered chapter text with its context (lib/social/anchor.ts).
export async function addNote(
  storyId: string,
  input: NoteInput,
): Promise<MarkResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (
    !isId(storyId) ||
    typeof input !== "object" ||
    input === null ||
    !isFraction(input.position) ||
    !isString(input.quote) ||
    !isString(input.prefix) ||
    !isString(input.suffix) ||
    !input.quote.trim()
  ) {
    return invalid();
  }
  // The quote and its context are kept as selected, so they match the text exactly.
  for (const [field, value] of [
    ["quote", input.quote],
    ["quoteContext", input.prefix],
    ["quoteContext", input.suffix],
  ] as const) {
    const tooLong = lengthError(field, value);
    if (tooLong) return translateError(tooLong);
  }
  const text = await limitedText("readerNote", input.text);
  if (!isString(text)) return text;
  return createMark(user.userId, storyId, {
    kind: "note",
    position: input.position,
    quote: input.quote,
    prefix: input.prefix,
    suffix: input.suffix,
    ...(text && { text }),
  });
}

// Renames a bookmark or changes a note's text; an empty value removes it. Visibility is not
// checked again, like the shelves of a library book (task 72).
export async function updateReaderMark(
  markId: string,
  value: string,
): Promise<MarkResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(markId) || !isString(value)) return invalid();
  await connectDB();
  // The length limit depends on the kind, so the mark is read before the rate limit.
  const mark = await ReaderMark.findOne({ _id: markId, userId: user.userId })
    .select({ kind: 1 })
    .lean();
  if (!mark) return markNotFound();
  const field = mark.kind === "bookmark" ? "name" : "text";
  const checked = await limitedText(
    mark.kind === "bookmark" ? "bookmarkName" : "readerNote",
    value,
  );
  if (!isString(checked)) return checked;
  if (!(await takeUserAttempt(SOCIAL_LIMITS.marks, user.userId))) {
    return rateLimited();
  }
  const updated = await ReaderMark.findOneAndUpdate(
    { _id: markId, userId: user.userId },
    checked ? { $set: { [field]: checked } } : { $unset: { [field]: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return markNotFound();
  return { ok: true, mark: toMarkView(updated) };
}

// Visibility is not checked again, like removing a library book (task 72).
export async function deleteReaderMark(markId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(markId)) return invalid();
  if (!(await takeUserAttempt(SOCIAL_LIMITS.marks, user.userId))) {
    return rateLimited();
  }
  await connectDB();
  const { deletedCount } = await ReaderMark.deleteOne({
    _id: markId,
    userId: user.userId,
  });
  return deletedCount === 1 ? { ok: true } : markNotFound();
}
