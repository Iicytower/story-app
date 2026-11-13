"use server";

import { Types } from "mongoose";
import { refresh } from "next/cache";
import { isBoolean, isId, isString } from "@/lib/action-input";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { isPublicBook } from "@/lib/library/queries";
import {
  countError,
  lengthError,
  MAX_LIBRARY_ITEMS,
  MAX_SHELVES,
} from "@/lib/limits";
import { Folder } from "@/lib/models/folder";
import { LibraryItem } from "@/lib/models/library-item";
import { Profile } from "@/lib/models/profile";
import { Shelf } from "@/lib/models/shelf";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { notifyLater } from "@/lib/social/notify";
import { seedShelves } from "./starter";

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= MAX_SHELVES && value.every(isId);

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const shelfNotFound = () => actionError("NOT_FOUND", "shelfNotFound");
const bookNotFound = () => actionError("NOT_FOUND", "libraryBookNotFound");
const rateLimited = () => actionError("RATE_LIMITED", "tooManyAttempts");

// Another account's shelf does not exist for this one (D1).
async function ownShelfIds(
  userId: string,
  shelfIds: string[],
): Promise<Types.ObjectId[] | null> {
  const unique = [...new Set(shelfIds)];
  if (unique.length === 0) return [];
  const own = await Shelf.find({ _id: { $in: unique }, userId })
    .select({ _id: 1 })
    .lean();
  return own.length === unique.length ? own.map(({ _id }) => _id) : null;
}

async function checkShelfName(name: unknown): Promise<ActionError | string> {
  if (!isString(name)) return invalid();
  const trimmed = name.trim();
  if (!trimmed) return actionError("EMPTY_NAME", "shelfNameRequired");
  const tooLong = lengthError("shelfName", trimmed);
  return tooLong ? translateError(tooLong) : trimmed;
}

// Only a book readers can see now (D38); saving it again only updates its shelves.
export async function addToLibrary(
  folderId: string,
  shelfIds: string[],
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(folderId) || !isIdList(shelfIds)) return invalid();
  await connectDB();
  const folder = new Types.ObjectId(folderId);
  if (!(await isPublicBook(folder, user.userId))) return bookNotFound();
  const shelves = await ownShelfIds(user.userId, shelfIds);
  if (!shelves) return shelfNotFound();
  if (!(await takeUserAttempt(SOCIAL_LIMITS.library, user.userId))) {
    return rateLimited();
  }

  const key = { userId: new Types.ObjectId(user.userId), folderId: folder };
  if (
    !(await LibraryItem.exists(key)) &&
    (await LibraryItem.countDocuments({ userId: key.userId })) >=
      MAX_LIBRARY_ITEMS
  ) {
    return translateError(countError("tooManyLibraryItems"));
  }
  const save = () =>
    LibraryItem.updateOne(
      key,
      { $set: { shelfIds: shelves }, $setOnInsert: { addedAt: new Date() } },
      { upsert: true },
    );
  // Two clicks at once: the other request inserted the item, so this one updates it.
  const result = await save().catch((error: unknown) => {
    if (!isDuplicateKeyError(error)) throw error;
    return save();
  });
  if (result.upsertedCount === 1) {
    // The "added to library" statistic (task 83) goes here.
    notifyLater(
      async () => {
        const book = await Folder.findById(folder).select({ userId: 1 }).lean();
        return book ? [book.userId] : [];
      },
      { type: "library", actorId: user.userId, folderId: folder },
    );
  }

  refresh();
  return { ok: true };
}

export async function removeFromLibrary(
  folderId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(folderId)) return invalid();
  await connectDB();
  if (!(await takeUserAttempt(SOCIAL_LIMITS.library, user.userId))) {
    return rateLimited();
  }
  const { deletedCount } = await LibraryItem.deleteOne({
    userId: user.userId,
    folderId,
  });
  if (deletedCount === 0) return bookNotFound();

  refresh();
  return { ok: true };
}

// Also for a book that is no longer public: the reader still owns the saved item.
export async function setItemShelves(
  folderId: string,
  shelfIds: string[],
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(folderId) || !isIdList(shelfIds)) return invalid();
  await connectDB();
  const shelves = await ownShelfIds(user.userId, shelfIds);
  if (!shelves) return shelfNotFound();
  if (!(await takeUserAttempt(SOCIAL_LIMITS.library, user.userId))) {
    return rateLimited();
  }
  const { matchedCount } = await LibraryItem.updateOne(
    { userId: user.userId, folderId },
    { $set: { shelfIds: shelves } },
  );
  if (matchedCount === 0) return bookNotFound();

  refresh();
  return { ok: true };
}

export async function createShelf(
  name: string,
): Promise<ActionResult<{ shelf: { id: string; name: string } }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const checked = await checkShelfName(name);
  if (typeof checked !== "string") return checked;
  await connectDB();
  // The starter shelves count towards the limit, so they come first.
  await seedShelves(user.userId);
  const [count, last] = await Promise.all([
    Shelf.countDocuments({ userId: user.userId }),
    Shelf.findOne({ userId: user.userId })
      .sort({ order: -1 })
      .select({ order: 1 })
      .lean(),
  ]);
  if (count >= MAX_SHELVES) {
    return translateError(countError("tooManyShelves"));
  }
  const shelf = await Shelf.create({
    userId: user.userId,
    name: checked,
    order: (last?.order ?? -1) + 1,
  });

  refresh();
  return { ok: true, shelf: { id: shelf._id.toString(), name: shelf.name } };
}

export async function renameShelf(
  shelfId: string,
  name: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(shelfId)) return invalid();
  const checked = await checkShelfName(name);
  if (typeof checked !== "string") return checked;
  await connectDB();
  const { matchedCount } = await Shelf.updateOne(
    { _id: shelfId, userId: user.userId },
    { $set: { name: checked } },
  );
  if (matchedCount === 0) return shelfNotFound();

  refresh();
  return { ok: true };
}

// The books stay in the library, on their other shelves or on none.
export async function deleteShelf(shelfId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(shelfId)) return invalid();
  await connectDB();
  const { deletedCount } = await Shelf.deleteOne({
    _id: shelfId,
    userId: user.userId,
  });
  if (deletedCount === 0) return shelfNotFound();
  await LibraryItem.updateMany(
    { userId: user.userId, shelfIds: shelfId },
    { $pull: { shelfIds: new Types.ObjectId(shelfId) } },
  );

  refresh();
  return { ok: true };
}

// The client sends every shelf of the account in the new order.
export async function reorderShelves(
  shelfIds: string[],
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isIdList(shelfIds)) return invalid();
  await connectDB();
  const shelves = await ownShelfIds(user.userId, shelfIds);
  if (!shelves) return shelfNotFound();
  const total = await Shelf.countDocuments({ userId: user.userId });
  if (shelves.length !== shelfIds.length || total !== shelfIds.length) {
    return actionError("CONFLICT", "requestInvalid");
  }
  await Shelf.bulkWrite(
    shelfIds.map((id, order) => ({
      updateOne: {
        filter: {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(user.userId),
        },
        update: { $set: { order } },
      },
    })),
  );

  refresh();
  return { ok: true };
}

export async function setLibraryPublic(
  libraryPublic: boolean,
): Promise<ActionResult<{ libraryPublic: boolean }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isBoolean(libraryPublic)) return invalid();
  await connectDB();
  const save = () =>
    Profile.updateOne(
      { userId: user.userId },
      { $set: { libraryPublic } },
      { upsert: true },
    );
  // The first save of a profile inserts it; two at once (two tabs) can both try.
  await save().catch((error: unknown) => {
    if (!isDuplicateKeyError(error)) throw error;
    return save();
  });

  refresh();
  return { ok: true, libraryPublic };
}
