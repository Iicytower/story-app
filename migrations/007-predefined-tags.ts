import type { mongo } from "mongoose";

export const id = "007-predefined-tags";
// A new collection: there is nothing to back up.
export const collections: string[] = [];

// The starting list (D79); later changes go through scripts/predefined-tags.ts.
const TAGS: [key: string, en: string, pl: string][] = [
  ["fantasy", "Fantasy", "Fantasy"],
  ["sci-fi", "Science fiction", "Fantastyka naukowa"],
  ["horror", "Horror", "Horror"],
  ["crime", "Crime", "Kryminał"],
  ["thriller", "Thriller", "Thriller"],
  ["romance", "Romance", "Romans"],
  ["contemporary", "Contemporary", "Obyczajowe"],
  ["historical", "Historical", "Historyczne"],
  ["adventure", "Adventure", "Przygodowe"],
  ["humor", "Humor", "Humor"],
  ["drama", "Drama", "Dramat"],
  ["dystopia", "Dystopia", "Dystopia"],
  ["paranormal", "Paranormal", "Paranormalne"],
  ["fairy tale", "Fairy tale", "Baśń"],
  ["nonfiction", "Nonfiction", "Literatura faktu"],
  ["short story", "Short story", "Opowiadanie"],
  ["novel", "Novel", "Powieść"],
  ["flash fiction", "Flash fiction", "Miniatura"],
  ["poetry", "Poetry", "Poezja"],
  ["fanfiction", "Fanfiction", "Fanfik"],
  ["screenplay", "Screenplay", "Scenariusz"],
  ["essay", "Essay", "Esej"],
  ["diary", "Diary", "Pamiętnik"],
];

// Keeps entries already there, so labels changed by the script survive a rerun.
export async function up(db: mongo.Db): Promise<void> {
  await db.collection<{ _id: string }>("predefinedTags").bulkWrite(
    TAGS.map(([key, en, pl]) => ({
      updateOne: {
        filter: { _id: key },
        update: { $setOnInsert: { labels: { en, pl } } },
        upsert: true,
      },
    })),
  );
}
