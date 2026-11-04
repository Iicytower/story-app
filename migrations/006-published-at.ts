import type { mongo } from "mongoose";

export const id = "006-published-at";
export const collections = ["stories"];
// The old deployment keeps publishing chapters without publishedAt during the build.
export const repeatable = true;

// Chapters public before task 49 have no publication date, so they all get the time of the run.
export async function up(db: mongo.Db): Promise<void> {
  const folders = await db
    .collection("folders")
    .find({ published: true, deletedAt: null })
    .project({ _id: 1 })
    .toArray();
  await db.collection("stories").updateMany(
    {
      folderId: { $in: folders.map(({ _id }) => _id) },
      publication: "public",
      deletedAt: null,
      publishedAt: { $exists: false },
    },
    { $set: { publishedAt: new Date() } },
  );
}
