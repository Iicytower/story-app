import type { mongo } from "mongoose";

export const id = "003-positions";
export const collections = ["stories", "folders", "users"];
// The old deployment keeps creating folders and stories without positions during
// the build, and 002 keeps assigning such stories to Unsorted on every run.
export const repeatable = true;

type Positioned = {
  _id: mongo.ObjectId;
  userId: mongo.ObjectId;
  folderId?: mongo.ObjectId;
  position?: number;
};

export async function up(db: mongo.Db): Promise<void> {
  await db
    .collection("users")
    .updateMany(
      { folderSort: { $exists: false } },
      { $set: { folderSort: "updated", manualFolderOrder: false } },
    );
  await db
    .collection("folders")
    .updateMany(
      { chapterSort: { $exists: false } },
      { $set: { chapterSort: "created", manualChapterOrder: false } },
    );
  // Positions follow the default modes: most recently active folder and newest chapter first.
  await fillPositions(db.collection<Positioned>("folders"), "userId", {
    lastActivityAt: -1,
    _id: -1,
  });
  await fillPositions(db.collection<Positioned>("stories"), "folderId", {
    createdAt: -1,
    _id: -1,
  });
}

// Appends documents without a position after the existing ones of their group.
async function fillPositions(
  collection: mongo.Collection<Positioned>,
  groupBy: "userId" | "folderId",
  sort: mongo.Sort,
): Promise<void> {
  const missing = await collection
    .find({ position: { $exists: false }, [groupBy]: { $exists: true } })
    .sort(sort)
    .toArray();

  const groups = new Map<string, Positioned[]>();
  for (const doc of missing) {
    const key = doc[groupBy]!.toString();
    groups.set(key, [...(groups.get(key) ?? []), doc]);
  }

  for (const docs of groups.values()) {
    const last = await collection.findOne(
      { [groupBy]: docs[0][groupBy], position: { $exists: true } },
      { sort: { position: -1 }, projection: { position: 1 } },
    );
    const start = (last?.position ?? -1) + 1;
    await collection.bulkWrite(
      docs.map((doc, index) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { position: start + index } },
        },
      })),
    );
  }
}
