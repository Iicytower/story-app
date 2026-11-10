import type { Types } from "mongoose";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { MAX_LIBRARY_ITEMS } from "@/lib/limits";
import { LibraryItem } from "@/lib/models/library-item";
import { Profile } from "@/lib/models/profile";
import { Shelf } from "@/lib/models/shelf";
import { findPublicBooks, type PublicBook } from "@/lib/publish/queries";
import { hiddenUserIdsFor } from "@/lib/social/permissions";

// A whole library fits in one view.
export const LIBRARY_VIEW_LIMIT = MAX_LIBRARY_ITEMS;

export interface ShelfView {
  id: string;
  name: string;
}

export interface LibraryBook extends PublicBook {
  folderId: string;
  shelfIds: string[];
}

// The starter shelves are created once per account, by the one request that sets the marker
// (D80); names come in the interface language of that request.
export async function ensureStarterShelves(
  userId: string,
  names: string[],
): Promise<void> {
  await connectDB();
  const seeded = await Profile.exists({
    userId,
    shelvesSeededAt: { $exists: true },
  });
  if (seeded) return;
  try {
    // No profile yet: the upsert creates it. A marked one misses the filter, and the upsert
    // then collides with it on the unique userId.
    await Profile.findOneAndUpdate(
      { userId, shelvesSeededAt: { $exists: false } },
      { $set: { shelvesSeededAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) return;
    throw error;
  }
  await Shelf.insertMany(names.map((name, order) => ({ userId, name, order })));
}

export async function listShelves(
  userId: string | Types.ObjectId,
): Promise<ShelfView[]> {
  await connectDB();
  const shelves = await Shelf.find({ userId })
    .sort({ order: 1, _id: 1 })
    .select({ name: 1 })
    .lean();
  return shelves.map(({ _id, name }) => ({ id: _id.toString(), name }));
}

// Only books readers can see now (D38): unpublished or deleted ones stay saved but are left out
// until they are public again.
export async function listLibraryBooks(
  userId: string | Types.ObjectId,
  viewerId: string | null,
): Promise<LibraryBook[]> {
  await connectDB();
  const [items, hidden] = await Promise.all([
    LibraryItem.find({ userId })
      .sort({ addedAt: -1, _id: -1 })
      .limit(LIBRARY_VIEW_LIMIT)
      .select({ folderId: 1, shelfIds: 1 })
      .lean(),
    hiddenUserIdsFor(viewerId),
  ]);
  const books = await findPublicBooks(
    items.map(({ folderId }) => folderId),
    hidden,
  );
  return items.flatMap(({ folderId, shelfIds }) => {
    const book = books.get(folderId.toString());
    return book
      ? [
          {
            ...book,
            folderId: folderId.toString(),
            shelfIds: shelfIds.map(String),
          },
        ]
      : [];
  });
}

// The Add to library picker on a book page.
export async function libraryEntry(
  userId: string,
  folderId: string,
): Promise<string[] | null> {
  await connectDB();
  const item = await LibraryItem.findOne({ userId, folderId })
    .select({ shelfIds: 1 })
    .lean();
  return item ? item.shelfIds.map(String) : null;
}

export async function isLibraryPublic(
  userId: string | Types.ObjectId,
): Promise<boolean> {
  await connectDB();
  const profile = await Profile.findOne({ userId })
    .select({ libraryPublic: 1 })
    .lean();
  return profile?.libraryPublic ?? true;
}

// Whether a reader may add the book: the same visibility as in the library views.
export async function isPublicBook(
  folderId: Types.ObjectId,
  viewerId: string,
): Promise<boolean> {
  const books = await findPublicBooks(
    [folderId],
    await hiddenUserIdsFor(viewerId),
  );
  return books.size === 1;
}
