import type { mongo } from "mongoose";

export const id = "004-settings";
export const collections = ["users", "settings"];
// The old deployment keeps writing the sort mode to users during the build.
export const repeatable = true;

type LegacyUser = {
  _id: mongo.ObjectId;
  folderSort?: unknown;
  manualFolderOrder?: unknown;
  // Written only by unreleased builds of task 09 (local databases).
  settings?: {
    editorLayout?: unknown;
    mobileView?: unknown;
    theme?: unknown;
  } | null;
};

// A value still on users is newer than the one in settings: it was either never moved
// or written by the old deployment after the previous run.
export async function up(db: mongo.Db): Promise<void> {
  const users = db.collection<LegacyUser>("users");
  const legacy = await users
    .find({
      $or: [
        { folderSort: { $exists: true } },
        { manualFolderOrder: { $exists: true } },
        { settings: { $exists: true } },
      ],
    })
    .toArray();
  if (legacy.length === 0) return;

  const now = new Date();
  await db.collection("settings").bulkWrite(
    legacy.map((user) => {
      const moved = Object.fromEntries(
        Object.entries({
          "folders.sort": user.folderSort,
          "folders.manualOrder": user.manualFolderOrder,
          "editor.layout": user.settings?.editorLayout,
          "editor.mobileView": user.settings?.mobileView,
          "appearance.theme": user.settings?.theme,
        }).filter(([, value]) => value !== undefined),
      );
      return {
        updateOne: {
          filter: { userId: user._id },
          update: {
            $set: { ...moved, updatedAt: now },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      };
    }),
  );
  // Only if unchanged since the read: a newer value stays and moves on the next run.
  // null also matches a missing field.
  await users.bulkWrite(
    legacy.map((user) => ({
      updateOne: {
        filter: {
          _id: user._id,
          folderSort: user.folderSort ?? null,
          manualFolderOrder: user.manualFolderOrder ?? null,
          settings: user.settings ?? null,
        },
        update: {
          $unset: { folderSort: "", manualFolderOrder: "", settings: "" },
        },
      },
    })),
  );
}
