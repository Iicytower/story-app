import type { mongo } from "mongoose";

export const id = "005-tags";
export const collections = ["stories", "folders"];
// The old deployment keeps creating folders and stories without tags during the build.
export const repeatable = true;

export async function up(db: mongo.Db): Promise<void> {
  for (const name of collections) {
    await db
      .collection(name)
      .updateMany({ tags: { $exists: false } }, { $set: { tags: [] } });
  }
}
